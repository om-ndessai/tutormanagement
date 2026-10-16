// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (the dialog's
// state, its autosave and its three saves: Save draft, Post, Record/Save changes). Lifted out of
// `record-session-sheet.tsx` for UI upgrades U4, so the record sheet (Finance, and editing a lesson)
// and the record step flow (`record-lesson-flow.tsx`) write up a lesson the same way: one form
// state, the 3-second autosave into the writer's own draft, and recording consuming that draft.
//
// It never shows a toast itself, except the "kept as a draft" one on the way out (the screen has
// gone by then): a toast over a step flow swallows the next tap (U3), so each caller says the
// outcome where it can be seen.
import {
  sessionDraftInputSchema,
  sessionInputSchema,
  sessionUpdateSchema,
  type ApiOk,
  type Assignment,
  type SessionDraft,
  type SessionDraftInput,
  type TutoringSession,
} from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useToast } from '@/components/toast';
import { useDictationSession } from '@/features/dictation/dictation-provider';
import { normaliseTopicCodes } from '@/features/dictation/topic-codes';
import { useTopicIndex } from '@/features/progress/api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAutosaveDraft, usePostDraft, useRecordSession, useSaveDraft, useUpdateSession } from '../api';
import { likelyAssessorRole } from '../session-notes';
import { organizationToday } from '../session-ranges';
import { useDraftAutosave, withDraft } from './use-draft-autosave';
import {
  emptyForm,
  formBody,
  formFromDraft,
  formFromSession,
  hasContent,
  issuesToErrors,
  prefilledForm,
  toUpdatePayload,
  type RecordPrefill,
  useSessionForm,
} from './use-session-form';

/** The shared schema's limits: each part of the write-up, and the notes (P3's length refusal). */
export const PART_MAX = 2000;
export const NOTES_MAX = 4000;

export const CHOOSE_STUDENT = 'Choose which student this session was with.';

/** What a save did, for the caller to say. */
export type WriteUpOutcome =
  | { kind: 'recorded'; session: TutoringSession }
  | { kind: 'updated'; session: TutoringSession }
  | { kind: 'posted' }
  | { kind: 'draft-saved'; picked: boolean };

export interface SessionWriteUpOptions {
  assignments: Assignment[];
  /** Editing this lesson on the record: no autosave, a PATCH. */
  existing: TutoringSession | null;
  /** An unposted write-up being picked back up; never together with `existing`. */
  draft: SessionDraft | null;
  /** A new lesson, filled in from a scheduled one. */
  prefill?: RecordPrefill;
  /** A save was refused: the caller may also say so out loud (the sheet toasts; a flow does not). */
  onFail?: (message: string) => void;
}

export function useSessionWriteUp({ assignments, existing, draft, prefill, onFail }: SessionWriteUpOptions) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = organizationToday(useOrgTimeZone());
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isEdit = existing !== null;
  const isDraft = draft !== null;

  const { values, set, current } = useSessionForm(() =>
    existing
      ? formFromSession(existing, assignments, user?.id)
      : draft
        ? formFromDraft(draft, assignments)
        : prefill
          ? prefilledForm(today, assignments, prefill)
          : emptyForm(today, assignments),
  );
  const [submitErrors, setErrors] = useState<Record<string, string>>({});
  // What the draft schema said about the last body the autosave looked at; answered by an edit.
  const [autosaveErrors, setAutosaveErrors] = useState<Record<string, string>>({});
  // One object per change, not per render: a step flow opens the step owning a new refusal.
  const errors = useMemo(() => ({ ...autosaveErrors, ...submitErrors }), [autosaveErrors, submitErrors]);
  // The reason the last save failed, said by the button (a sheet covers the app's toasts).
  const [failure, setFailure] = useState<string | null>(null);
  const record = useRecordSession();
  const update = useUpdateSession();
  const saveDraft = useSaveDraft();
  const postDraft = usePostDraft();
  const autosaveDraft = useAutosaveDraft();
  const dictation = useDictationSession();
  // Spoken curriculum codes become the catalogue's, but only codes that exist (P3).
  const { topics } = useTopicIndex();
  const normalise = useCallback(
    (text: string) => normaliseTopicCodes(text, new Set(topics.keys())),
    [topics],
  );
  const saving = record.isPending || update.isPending || saveDraft.isPending || postDraft.isPending;

  const assignment = assignments.find((a) => a.id === values.assignmentId);
  /** The pairing the write-up names: the one chosen, else the draft's own. */
  const pair = assignment
    ? { tutor_user_id: assignment.tutor_user_id, student_user_id: assignment.student_user_id }
    : draft
      ? { tutor_user_id: draft.tutor_user_id, student_user_id: draft.student_user_id }
      : null;

  const autosave = useDraftAutosave({
    enabled: !isEdit,
    initialDraftId: draft?.id ?? null,
    getBody: () => {
      // Only what is settled: interim dictation never reaches form state (P3).
      const now = current();
      return pair && (isDraft || hasContent(now)) ? (formBody(now, pair) as SessionDraftInput) : null;
    },
    save: async (id, input) => {
      const result = await autosaveDraft.mutateAsync({ id, input });
      // Keeps the cached list in step with every quiet save, so "Continue" opens what was kept.
      queryClient.setQueryData<ApiOk<SessionDraft[]>>(['session-drafts'], (list) =>
        withDraft(list, result.data),
      );
      return result;
    },
    onInvalid: setAutosaveErrors,
    onValid: () => setAutosaveErrors({}),
    onKeptAsDraft: () => toast.success('Your write-up is kept as a draft. Pick it up from Drafts.'),
  });
  const studentId = existing?.student_user_id ?? assignment?.student_user_id ?? draft?.student_user_id;

  /** Whose assessment the form is holding, for wording the question. */
  const myRole =
    existing && user
      ? likelyAssessorRole(existing, user)
      : isAdmin && assignment && assignment.tutor_user_id !== user?.id
        ? 'admin'
        : 'tutor';

  function fail(message: string, fieldErrors: Record<string, string>) {
    setErrors(fieldErrors);
    setFailure(message);
    onFail?.(message);
  }

  /** A choice of student answers the one complaint about it. */
  function chooseAssignment(id: string) {
    set('assignmentId', id);
    setFailure(null);
    setErrors(({ assignment: _a, student_user_id: _s, ...rest }) => rest);
  }

  function clearFailure() {
    setErrors({});
    setFailure(null);
  }

  /**
   * Keeps the write-up without posting it. Nobody else can see a draft, so this is the safe
   * button: it never puts an unfinished note in front of a family, and it never bills anything.
   */
  async function saveAsDraft(): Promise<WriteUpOutcome | null> {
    clearFailure();
    // The last words of a dictation land first, so they are in what is kept (P3).
    await dictation.stopAndFlush();
    const now = current();
    if (!pair) {
      fail(CHOOSE_STUDENT, { assignment: CHOOSE_STUDENT });
      return null;
    }
    const input = formBody(now, pair) as SessionDraftInput;
    const parsed = sessionDraftInputSchema.safeParse(input);
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
      return null;
    }
    await autosave.settle();
    try {
      await saveDraft.mutateAsync({ id: autosave.draftId() ?? undefined, input });
      return { kind: 'draft-saved', picked: isDraft };
    } catch (error) {
      autosave.resume();
      if (error instanceof ApiRequestError) fail(error.message, error.fieldErrors);
      else fail('Could not save the draft.', {});
      return null;
    }
  }

  /** Saves any edits, then posts: one button, because the writer pressed post. */
  async function postTheDraft(): Promise<WriteUpOutcome | null> {
    if (!draft || !pair) return null;
    const input = formBody(current(), pair) as SessionDraftInput;
    const parsed = sessionDraftInputSchema.safeParse(input);
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
      return null;
    }
    await autosave.settle();
    try {
      // Brings the draft up to date first. Quietly: posting is the action, and is what the log
      // records.
      await autosaveDraft.mutateAsync({ id: draft.id, input });
      await postDraft.mutateAsync(draft.id);
      return { kind: 'posted' };
    } catch (error) {
      autosave.resume();
      if (error instanceof ApiRequestError) fail(error.message, error.fieldErrors);
      else fail('Could not post the draft.', {});
      return null;
    }
  }

  /** Records a new lesson, posts a draft, or saves changes to a lesson on the record. */
  async function submit(): Promise<WriteUpOutcome | null> {
    clearFailure();
    // The last words of a dictation land first, so they are in what is recorded (P3).
    await dictation.stopAndFlush();
    const now = current();

    if (isDraft) return postTheDraft();

    if (!isEdit && !assignment) {
      fail(CHOOSE_STUDENT, { assignment: CHOOSE_STUDENT });
      return null;
    }

    try {
      if (existing) {
        const input = toUpdatePayload(now, existing, user?.id);
        const parsed = sessionUpdateSchema.safeParse(input);
        if (!parsed.success) {
          fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
          return null;
        }
        const result = await update.mutateAsync({ id: existing.id, input });
        return { kind: 'updated', session: result.data };
      }
      const input = formBody(now, {
        tutor_user_id: assignment!.tutor_user_id,
        student_user_id: assignment!.student_user_id,
      });
      const parsed = sessionInputSchema.safeParse(input);
      if (!parsed.success) {
        fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
        return null;
      }
      // Lets an autosave on its way land, then records from the draft it made, which the
      // server deletes in the same request: one write-up never becomes a session and a draft.
      await autosave.settle();
      const fromDraft = autosave.draftId();
      const result = await record.mutateAsync({
        ...parsed.data,
        ...(fromDraft ? { from_draft_id: fromDraft } : {}),
      });
      // The server deleted that draft; `useRecordSession`'s invalidations (copied from the web)
      // do not cover the drafts list, so it is refreshed here.
      if (fromDraft) void queryClient.invalidateQueries({ queryKey: ['session-drafts'] });
      return { kind: 'recorded', session: result.data };
    } catch (error) {
      // Not recorded, so keep the write-up safe again.
      if (!isEdit) autosave.resume();
      if (error instanceof ApiRequestError) fail(error.message, error.fieldErrors);
      else fail('Could not save the session.', {});
      return null;
    }
  }

  return {
    values,
    set,
    current,
    today,
    isAdmin,
    isEdit,
    isDraft,
    assignment,
    pair,
    studentId,
    myRole,
    errors,
    failure,
    saving,
    savingDraft: saveDraft.isPending,
    autosave,
    dictation,
    normalise,
    chooseAssignment,
    clearFailure,
    saveAsDraft,
    submit,
  };
}

export type SessionWriteUp = ReturnType<typeof useSessionWriteUp>;

/** What each outcome says, once the screen it came from has gone. */
export function outcomeMessage(outcome: WriteUpOutcome): string {
  switch (outcome.kind) {
    case 'recorded':
      return 'Session recorded.';
    case 'updated':
      return 'Session updated.';
    case 'posted':
      return 'Session recorded. Everyone concerned can see it now.';
    case 'draft-saved':
      return outcome.picked ? 'Draft saved.' : 'Saved as a draft. Only you can see it.';
  }
}
