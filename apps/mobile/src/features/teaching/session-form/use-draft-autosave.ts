// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (the autosave:
// `runAutosave`, `settleAutosave`, the final save in `handleOpenChange`).
//
// While a lesson is being written up -- a new one, or a draft picked back up, never a session
// already on the record -- the form saves into the writer's own draft every few seconds, quietly:
// no audit line, nobody else can read it, nothing is billed. Recording then consumes that draft
// (`from_draft_id`), so one write-up never becomes two records.
//
// Two additions on the phone: the body is checked against the shared draft schema before it is
// sent (an SSN-shaped note shows its sentence under the field instead of a 400 every 3 s), and the
// app going to the background saves too, as a phone is put away mid-sentence.
import { DRAFT_AUTOSAVE_INTERVAL_MS, sessionDraftInputSchema, type SessionDraftInput } from '@tmi/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { issuesToErrors } from './use-session-form';

export type AutosaveState =
  { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'failed' };

export interface DraftAutosaveOptions {
  /** False while editing a lesson on the record: that one is posted, and is never a draft. */
  enabled: boolean;
  /** The body to keep, or null while there is nothing worth keeping (no words, no pairing). */
  getBody: () => SessionDraftInput | null;
  /** Saves the draft: a POST without an id, a PATCH with one, both `?autosave=true`. */
  save: (id: string | undefined, body: SessionDraftInput) => Promise<{ data: { id: string } }>;
  /** The draft being picked back up, if any. */
  initialDraftId?: string | null;
  /** The schema refused the body: its field errors, keyed as the server keys them. */
  onInvalid: (errors: Record<string, string>) => void;
  /** The body passed the schema: any earlier complaint from here is answered. */
  onValid: () => void;
  /** Closing left a NEW write-up as a draft: tell the writer where to find it. */
  onKeptAsDraft?: () => void;
  intervalMs?: number;
}

export function useDraftAutosave(options: DraftAutosaveOptions) {
  const { enabled, initialDraftId = null, intervalMs = DRAFT_AUTOSAVE_INTERVAL_MS } = options;

  const draftIdRef = useRef<string | null>(initialDraftId);
  const lastSavedRef = useRef<string | null>(null);
  const lastTriedRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const stoppedRef = useRef(false);
  const mountedRef = useRef(true);
  const [state, setState] = useState<AutosaveState>({ kind: 'idle' });

  // The interval reads the latest form through a ref, so it is set up once per opening rather
  // than on every keystroke.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const report = useCallback((next: AutosaveState) => {
    if (mountedRef.current) setState(next);
  }, []);

  /** One quiet save, if anything changed since the last. Never two at once. */
  const run = useCallback(() => {
    const { enabled: on, getBody, save, onInvalid, onValid } = latest.current;
    if (!on || stoppedRef.current || inFlightRef.current) return;
    const body = getBody();
    if (!body) return;
    const json = JSON.stringify(body);
    // Unchanged since the last save -- or the same thing just failed, which would only fail
    // again (an end before the start, say) until it changes.
    if (json === lastSavedRef.current || json === lastTriedRef.current) return;
    lastTriedRef.current = json;

    const parsed = sessionDraftInputSchema.safeParse(body);
    if (!parsed.success) {
      onInvalid(issuesToErrors(parsed.error.issues));
      report({ kind: 'failed' });
      return;
    }
    onValid();
    report({ kind: 'saving' });

    inFlightRef.current = save(draftIdRef.current ?? undefined, body)
      .then((result) => {
        draftIdRef.current = result.data.id;
        lastSavedRef.current = json;
        report({ kind: 'saved', at: new Date() });
      })
      .catch(() => report({ kind: 'failed' }))
      .finally(() => {
        inFlightRef.current = null;
      });
  }, [report]);

  // A draft picked back up is already saved as it opens: no PATCH until something changes.
  useEffect(() => {
    if (!initialDraftId) return;
    const body = latest.current.getBody();
    if (body) lastSavedRef.current = JSON.stringify(body);
    // Once, as the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, run]);

  // Leaving the app is the moment a write-up is most likely to be forgotten.
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') run();
    });
    return () => subscription.remove();
  }, [enabled, run]);

  // Closing without recording (Cancel, a swipe down, Android back): whatever was typed since the
  // last autosave is saved too, and a new write-up's writer is told where to find it. The sheet
  // has gone by then, so this runs from refs; the mutation and the root toast outlive it.
  useEffect(
    () => () => {
      mountedRef.current = false;
      if (!latest.current.enabled || stoppedRef.current) return;
      void (async () => {
        await inFlightRef.current;
        run();
        stoppedRef.current = true;
        await inFlightRef.current;
        if (!initialDraftId && draftIdRef.current) latest.current.onKeptAsDraft?.();
      })();
    },
    // Once, on the way out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Stops autosaving and lets a save already on its way land first. */
  const settle = useCallback(async () => {
    stoppedRef.current = true;
    await inFlightRef.current;
  }, []);

  /** Not recorded after all: keep the write-up safe again. */
  const resume = useCallback(() => {
    stoppedRef.current = false;
  }, []);

  /** The draft this write-up is being kept in, once there is one. */
  const draftId = useCallback(() => draftIdRef.current, []);

  return { state, run, settle, resume, draftId };
}
