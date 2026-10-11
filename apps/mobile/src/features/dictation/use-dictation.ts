// A field's side of dictation (P3): commits settled phrases only, refuses an SSN-shaped one (or one
// that would complete an SSN with what is already there) and one past the field's length, and stops
// when the field goes away, loses focus or the app goes to the background.
import { containsSsn, SSN_REJECTED_MESSAGE } from '@tmi/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { haptics } from '@/lib/haptics';
import { appendTranscript } from './append-transcript';
import { useDictationSession, type DictationOwner, type DictationPhase } from './dictation-provider';

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+$)/g, ',');

export function tooLongMessage(maxLength: number): string {
  return `That would make this part longer than ${thousands(maxLength)} characters.`;
}

/** The pure decision for one final phrase: the next value, or why it is refused. */
export function commitFinal(
  value: string,
  transcript: string,
  maxLength: number,
  normalise?: (text: string) => string,
): { next: string } | { refused: string } {
  const heard = normalise ? normalise(transcript) : transcript;
  const next = appendTranscript(value, heard);
  if (containsSsn(heard) || (containsSsn(next) && !containsSsn(value)))
    return { refused: SSN_REJECTED_MESSAGE };
  if (next.length > maxLength) return { refused: tooLongMessage(maxLength) };
  return { next };
}

export interface UseDictationOptions {
  /** Unique among the fields on screen: the field's testID. */
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  normalise?: (text: string) => string;
}

export function useDictation({ key, label, value, onChange, maxLength, normalise }: UseDictationOptions) {
  const session = useDictationSession();
  const [message, setMessage] = useState<string | null>(null);
  const mine = session.ownerKey === key;
  const phase: DictationPhase = mine ? session.phase : 'idle';

  // What the field holds, including a phrase committed a moment ago that React has not rendered.
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);

  const latest = useRef({ label, onChange, maxLength, normalise });
  useLayoutEffect(() => {
    latest.current = { label, onChange, maxLength, normalise };
  });

  const [owner] = useState<DictationOwner>(() => ({
    key,
    get label() {
      return latest.current.label;
    },
    onFinal(text: string) {
      const { onChange: change, maxLength: max, normalise: norm } = latest.current;
      const base = valueRef.current;
      const result = commitFinal(base, text, max, norm);
      if ('refused' in result) return result.refused;
      if (result.next !== base) {
        valueRef.current = result.next;
        change(result.next);
      }
      return null;
    },
    onMessage: (next: string | null) => setMessage(next),
  }));

  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  });

  const toggle = useCallback(() => {
    const current = sessionRef.current;
    if (current.ownerKey === key && current.phase !== 'idle') {
      void current.stopAndFlush();
      return;
    }
    setMessage(null);
    // Before the microphone is live: iOS silences haptics while it is.
    haptics.impact();
    void current.begin(owner);
  }, [key, owner]);

  const stopAndFlush = useCallback(async () => {
    const current = sessionRef.current;
    if (current.ownerKey === key) await current.stopAndFlush();
  }, [key]);

  // Navigating away stops listening; the last words still land here.
  useFocusEffect(
    useCallback(
      () => () => {
        const current = sessionRef.current;
        if (current.ownerKey === key) current.stop();
      },
      [key],
    ),
  );

  // The field going away (the sheet closed): the phrase in flight is dropped, with the field.
  useEffect(
    () => () => {
      const current = sessionRef.current;
      if (current.ownerKey === key) current.abort();
    },
    [key],
  );

  return {
    phase,
    listening: phase === 'listening' || phase === 'finishing',
    interim: mine ? session.interim : '',
    message,
    clearMessage: () => setMessage(null),
    toggle,
    stopAndFlush,
  };
}
