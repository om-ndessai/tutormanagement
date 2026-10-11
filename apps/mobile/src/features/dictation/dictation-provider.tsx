// One dictation at a time, app-wide (P3). Mounted inside the organization layout, so switching
// organization or signing out unmounts it, which aborts whatever was listening. A field owns the
// session it started; results are routed to that owner only, and only FINAL text is ever handed to
// it -- interim words are shown under the field and never reach form state, so no autosave can post
// half a sentence. Nothing here logs, stores or sends a transcript.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';

import { useOffline } from '@/components/connectivity';
import { haptics } from '@/lib/haptics';
import * as speech from '@/lib/speech';
import { errorMessage } from './dictation-copy';
import { prepareDictation } from './dictation-dialogs';

export type DictationPhase = 'idle' | 'preparing' | 'listening' | 'finishing';

/** A field taking part in dictation. Its callbacks are read when an event arrives, so keep them current. */
export interface DictationOwner {
  key: string;
  /** The field's label, for "Added to …". */
  label: string;
  /** A settled phrase. Returns a refusal (said under the field; dictation stops) or null. */
  onFinal: (text: string) => string | null;
  /** A message under the field, or null to clear it. */
  onMessage: (message: string | null) => void;
}

interface DictationState {
  ownerKey: string | null;
  phase: DictationPhase;
  interim: string;
}

interface DictationApi extends DictationState {
  /** Starts dictating into `owner`, first stopping (and flushing) anyone else's dictation. */
  begin: (owner: DictationOwner) => Promise<void>;
  /** Stops listening and waits for the last words to land (at most 1.5 s). */
  stopAndFlush: () => Promise<void>;
  /** Stops listening; the last words land when the recognizer settles. */
  stop: () => void;
  /** Drops whatever is in flight: nothing more reaches any field. */
  abort: () => void;
}

const IDLE: DictationState = { ownerKey: null, phase: 'idle', interim: '' };
/** Stops by itself after this long with nothing heard, and after this long regardless. */
export const SILENCE_MS = 20_000;
export const MAX_SESSION_MS = 5 * 60_000;
export const FLUSH_TIMEOUT_MS = 1_500;

const DictationContext = createContext<DictationApi | null>(null);

/** Waits for a screen reader to finish saying "Listening", so it is not transcribed (1 s at most). */
async function announceListening(): Promise<void> {
  let reader = false;
  try {
    reader = await AccessibilityInfo.isScreenReaderEnabled();
  } catch {
    reader = false;
  }
  if (!reader) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, 1000);
    const subscription =
      Platform.OS === 'ios' ? AccessibilityInfo.addEventListener('announcementFinished', done) : null;
    function done() {
      clearTimeout(timer);
      subscription?.remove();
      resolve();
    }
    AccessibilityInfo.announceForAccessibility('Listening');
  });
}

export function DictationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DictationState>(IDLE);
  const offline = useOffline();
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  const owner = useRef<DictationOwner | null>(null);
  const phase = useRef<DictationPhase>('idle');
  const unsubscribe = useRef<(() => void) | null>(null);
  const waiters = useRef<(() => void)[]>([]);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ceiling = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** How this session is ending, for the haptic after `end`. */
  const ending = useRef<'user' | 'refused' | 'error' | null>(null);
  /** A begin was cancelled while its dialogs were still up. */
  const cancelled = useRef(false);
  const mounted = useRef(true);

  const update = useCallback((next: Partial<DictationState>) => {
    if (mounted.current) setState((before) => ({ ...before, ...next }));
  }, []);

  const setPhase = useCallback(
    (next: DictationPhase) => {
      phase.current = next;
      update({ phase: next });
    },
    [update],
  );

  const clearTimers = useCallback(() => {
    if (silence.current) clearTimeout(silence.current);
    if (ceiling.current) clearTimeout(ceiling.current);
    silence.current = null;
    ceiling.current = null;
  }, []);

  const settle = useCallback(() => {
    clearTimers();
    unsubscribe.current?.();
    unsubscribe.current = null;
    const how = ending.current;
    ending.current = null;
    owner.current = null;
    phase.current = 'idle';
    if (mounted.current) setState(IDLE);
    if (how === 'refused' || how === 'error') haptics.error();
    else if (how === 'user') haptics.selection();
    const resolve = waiters.current;
    waiters.current = [];
    resolve.forEach((done) => done());
  }, [clearTimers]);

  const armSilence = useCallback(() => {
    if (silence.current) clearTimeout(silence.current);
    silence.current = setTimeout(() => {
      if (phase.current === 'listening') {
        setPhase('finishing');
        speech.stop();
      }
    }, SILENCE_MS);
  }, [setPhase]);

  const onEvent = useCallback(
    (event: speech.SpeechEvent) => {
      const target = owner.current;
      switch (event.type) {
        case 'start':
          if (phase.current === 'preparing') setPhase('listening');
          AccessibilityInfo.announceForAccessibility('Listening');
          armSilence();
          return;
        case 'interim':
          update({ interim: event.text });
          armSilence();
          return;
        case 'final': {
          update({ interim: '' });
          armSilence();
          if (!target || ending.current === 'refused') return;
          const refusal = target.onFinal(event.text);
          if (refusal) {
            ending.current = 'refused';
            target.onMessage(refusal);
            AccessibilityInfo.announceForAccessibility(refusal);
            speech.abort();
          } else if (event.text.trim()) {
            AccessibilityInfo.announceForAccessibility(`Added to ${target.label}`);
          }
          return;
        }
        case 'error': {
          const message = errorMessage(event.code);
          if (message && ending.current !== 'refused') {
            ending.current = 'error';
            target?.onMessage(message);
            AccessibilityInfo.announceForAccessibility(message);
          }
          return;
        }
        case 'end':
          settle();
          return;
      }
    },
    [armSilence, setPhase, settle, update],
  );

  const stopAndFlush = useCallback(async () => {
    if (phase.current === 'idle') return;
    if (phase.current === 'preparing' && !unsubscribe.current) {
      // Still asking: nothing was said yet.
      cancelled.current = true;
      return;
    }
    const ended = new Promise<void>((resolve) => {
      waiters.current.push(resolve);
      setTimeout(resolve, FLUSH_TIMEOUT_MS);
    });
    if (!ending.current) ending.current = 'user';
    setPhase('finishing');
    speech.stop();
    await ended;
  }, [setPhase]);

  const stop = useCallback(() => {
    if (phase.current === 'idle') return;
    if (phase.current === 'preparing' && !unsubscribe.current) {
      cancelled.current = true;
      return;
    }
    if (!ending.current) ending.current = 'user';
    setPhase('finishing');
    speech.stop();
  }, [setPhase]);

  const abort = useCallback(() => {
    if (phase.current === 'idle') return;
    cancelled.current = true;
    owner.current = null;
    if (unsubscribe.current) speech.abort();
  }, []);

  const begin = useCallback(
    async (next: DictationOwner) => {
      if (phase.current !== 'idle') await stopAndFlush();
      cancelled.current = false;
      owner.current = next;
      ending.current = null;
      phase.current = 'preparing';
      update({ ownerKey: next.key, phase: 'preparing', interim: '' });
      next.onMessage(null);

      const ready = await prepareDictation({ offline: offlineRef.current });
      // Another field may have taken over meanwhile; then this one leaves the session alone.
      const ours = () => owner.current === next || owner.current === null;
      if (!ready.ok || cancelled.current || owner.current !== next) {
        if (!ready.ok && ready.message) next.onMessage(ready.message);
        if (ours()) settle();
        return;
      }
      await announceListening();
      if (cancelled.current || owner.current !== next) {
        if (ours()) settle();
        return;
      }
      unsubscribe.current = speech.subscribe(onEvent);
      ceiling.current = setTimeout(() => {
        if (phase.current === 'listening') {
          ending.current = ending.current ?? 'user';
          setPhase('finishing');
          speech.stop();
        }
      }, MAX_SESSION_MS);
      try {
        await speech.start(ready.mode);
      } catch {
        next.onMessage(errorMessage('unknown'));
        settle();
      }
    },
    [onEvent, setPhase, settle, stopAndFlush, update],
  );

  // The app going to the background stops listening (iOS ends the audio session anyway); the
  // final usually lands on return, and the next autosave tick keeps it.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') stop();
    });
    return () => subscription.remove();
  }, [stop]);

  // Leaving the organization (or signing out): nothing in flight survives.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (phase.current !== 'idle') speech.abort();
      unsubscribe.current?.();
      clearTimers();
    };
  }, [clearTimers]);

  const api = useMemo<DictationApi>(
    () => ({ ...state, begin, stopAndFlush, stop, abort }),
    [state, begin, stopAndFlush, stop, abort],
  );
  return <DictationContext value={api}>{children}</DictationContext>;
}

/** The app's dictation session; a no-op outside the provider (a screen that cannot dictate). */
export function useDictationSession(): DictationApi {
  return use(DictationContext) ?? NO_DICTATION;
}

const NO_DICTATION: DictationApi = {
  ...IDLE,
  begin: async () => undefined,
  stopAndFlush: async () => undefined,
  stop: () => undefined,
  abort: () => undefined,
};
