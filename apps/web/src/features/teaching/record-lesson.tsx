import { useEffect, useState } from 'react';
import { CheckCircle2Icon, FileEditIcon, Loader2Icon, MapPinIcon, PencilLineIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SESSION_MODE_LABELS,
  formatClockTime,
  formatDuration,
  formatMinutesOfDay,
  lessonWhen,
  sessionInputSchema,
  zonedClockParts,
  type LessonDraftRef,
  type LessonOwed,
  type SessionDraft,
  type SessionMode,
  type TutoringSession,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useLessonsOwed, useMyDrafts, useRecordSession } from './api';
import { SessionFormDialog } from './session-form-dialog';

/**
 * A lesson the schedule knows about, as every door to recording it hands it over (Phase 75, JF30): Next up, the
 * home's To record, the Sessions page's To record and the lessons still owed. No money.
 */
export interface KnownLesson {
  tutor_user_id: string;
  tutor_name?: string;
  student_user_id: string;
  student_name: string;
  occurs_on: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  /** By NAME and kind only (R16). */
  place?: { name: string; kind: 'physical' | 'virtual' } | null;
  /** The reader's own draft of it, when the door knows (JF19). */
  draft?: LessonDraftRef | null;
}

/** Where recording stands: nothing open, the lessons still owed, one known lesson, or the full form. */
export type RecordFlow =
  | { kind: 'closed' }
  | { kind: 'owed' }
  | { kind: 'lesson'; lesson: KnownLesson }
  | { kind: 'form'; lesson: KnownLesson | null; draftId?: string | null; existing?: TutoringSession | null };

export const RECORD_CLOSED: RecordFlow = { kind: 'closed' };

export function knownFromOwed(row: LessonOwed): KnownLesson {
  return {
    tutor_user_id: row.tutor_user_id,
    tutor_name: row.tutor_name,
    student_user_id: row.student_user_id,
    student_name: row.student_name,
    occurs_on: row.occurs_on,
    start_time: row.start_time,
    end_time: row.end_time,
    mode: row.mode,
    place: row.place,
    draft: row.draft,
  };
}

/** The reader's own draft of a known lesson: the door's ref, else one of theirs of the same tutor, student and day. */
function draftFor(lesson: KnownLesson, drafts: readonly SessionDraft[]): SessionDraft | LessonDraftRef | null {
  if (lesson.draft) return drafts.find((row) => row.id === lesson.draft!.id) ?? lesson.draft;
  return (
    drafts.find(
      (row) =>
        row.tutor_user_id === lesson.tutor_user_id &&
        row.student_user_id === lesson.student_user_id &&
        row.occurred_on === lesson.occurs_on,
    ) ?? null
  );
}

/** Today on the space's clock. */
export function useOrgToday(): string {
  const timeZone = useOrgTimeZone();
  return zonedClockParts(new Date().toISOString(), timeZone).day;
}

/** "12:43 PM" today, else "Nov 3, 12:43 PM" -- on the space's clock. */
function useSavedWhen(iso: string): string {
  const timeZone = useOrgTimeZone();
  const today = useOrgToday();
  const parts = zonedClockParts(iso, timeZone);
  const time = formatMinutesOfDay(parts.minutesOfDay);
  if (parts.day === today) return time;
  const date = new Date(`${parts.day}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${date}, ${time}`;
}

/** Phase 75 (JF19): "Draft saved 12:43 PM · Continue" -- the reader's own draft of this lesson, one tap away. */
export function DraftMark({
  draft,
  onContinue,
  testId,
  size = 'sm',
}: {
  draft: LessonDraftRef;
  onContinue: () => void;
  testId?: string;
  size?: 'sm' | 'lg';
}) {
  const when = useSavedWhen(draft.updated_at);
  return (
    <Button
      size={size}
      variant="outline"
      className={size === 'lg' ? 'rounded-full' : undefined}
      onClick={onContinue}
      data-testid={testId}
    >
      <FileEditIcon />
      {`Draft saved ${when} · Continue`}
    </Button>
  );
}

/**
 * The record flow's dialogs, held by the page that opens them (the home, the Sessions page): the lessons still owed,
 * "Record a lesson" for one known lesson, and the full form -- for a draft picked back up, a lesson written up, or
 * "Another lesson" (blank, no date). Opening a known lesson that has a draft opens the draft: never a second one.
 */
export function LessonRecorder({
  flow: asked,
  onFlow,
  showMoney = false,
}: {
  flow: RecordFlow;
  onFlow: (flow: RecordFlow) => void;
  showMoney?: boolean;
}) {
  const drafts = useMyDrafts();
  const list = drafts.data?.data ?? [];
  const close = () => onFlow(RECORD_CLOSED);

  // A known lesson with the reader's draft of it opens that draft, whichever door it came through.
  const lessonDraft = asked.kind === 'lesson' ? draftFor(asked.lesson, list) : null;
  const flow: RecordFlow =
    asked.kind === 'lesson' && lessonDraft ? { kind: 'form', lesson: asked.lesson, draftId: lessonDraft.id } : asked;

  // The form's draft, once the reader's drafts have loaded (the door may know only its id) -- held as it was when the
  // form opened: each autosave puts a new copy in the list, and the form must not refill itself from it mid-typing.
  const wantedDraftId = flow.kind === 'form' ? (flow.draftId ?? null) : null;
  const [heldDraft, setHeldDraft] = useState<SessionDraft | null>(null);
  useEffect(() => {
    if (!wantedDraftId) {
      if (heldDraft) setHeldDraft(null);
      return;
    }
    if (heldDraft?.id === wantedDraftId) return;
    const found = list.find((row) => row.id === wantedDraftId);
    if (found) setHeldDraft(found);
  }, [wantedDraftId, list, heldDraft]);
  const formDraft = wantedDraftId && heldDraft?.id === wantedDraftId ? heldDraft : null;
  const waitingForDraft =
    Boolean(wantedDraftId) && !formDraft && (drafts.isPending || list.some((row) => row.id === wantedDraftId));
  const formOpen = flow.kind === 'form' && !waitingForDraft;

  const openLesson = (lesson: KnownLesson) => onFlow({ kind: 'lesson', lesson });

  return (
    <>
      <LessonsOwedDialog
        open={flow.kind === 'owed'}
        onOpenChange={(open) => !open && close()}
        onLesson={openLesson}
        onDraft={(lesson, draftId) => onFlow({ kind: 'form', lesson, draftId })}
        onAnother={() => onFlow({ kind: 'form', lesson: null })}
      />

      {flow.kind === 'lesson' && (
        <RecordLessonDialog
          lesson={flow.lesson}
          draft={draftFor(flow.lesson, list)}
          onClose={close}
          onWriteUp={(draftId) => onFlow({ kind: 'form', lesson: flow.lesson, draftId })}
          onWriteUpRecorded={(session) => onFlow({ kind: 'form', lesson: null, existing: session })}
        />
      )}

      <SessionFormDialog
        open={formOpen}
        onOpenChange={(open) => !open && close()}
        existing={flow.kind === 'form' ? (flow.existing ?? null) : null}
        draft={formDraft}
        fromSchedule={
          flow.kind === 'form' && !formDraft && !flow.existing && flow.lesson
            ? {
                tutor_user_id: flow.lesson.tutor_user_id,
                student_user_id: flow.lesson.student_user_id,
                occurs_on: flow.lesson.occurs_on,
                start_time: flow.lesson.start_time,
                end_time: flow.lesson.end_time,
                mode: flow.lesson.mode,
              }
            : null
        }
        showMoney={showMoney}
      />
    </>
  );
}

/**
 * "Record a lesson" for one lesson the schedule knows (the app's model, JF30): what it was, then "It ran as planned"
 * -- one tap records it as scheduled -- or "Write up the lesson", the full form. Recorded, it offers the write-up.
 * Its draft, if the reader has one, is continued instead.
 */
function RecordLessonDialog({
  lesson,
  draft,
  onClose,
  onWriteUp,
  onWriteUpRecorded,
}: {
  lesson: KnownLesson;
  draft: SessionDraft | LessonDraftRef | null;
  onClose: () => void;
  onWriteUp: (draftId: string | null) => void;
  onWriteUpRecorded: (session: TutoringSession) => void;
}) {
  const { user } = useAuth();
  const today = useOrgToday();
  const record = useRecordSession();
  const [problems, setProblems] = useState<string[]>([]);
  const [recorded, setRecorded] = useState<TutoringSession | null>(null);
  const showTutor = Boolean(lesson.tutor_name && lesson.tutor_user_id !== user?.id);

  useEffect(() => {
    setProblems([]);
    setRecorded(null);
  }, [lesson.tutor_user_id, lesson.student_user_id, lesson.occurs_on, lesson.start_time]);

  async function asPlanned() {
    setProblems([]);
    const parsed = sessionInputSchema.safeParse({
      tutor_user_id: lesson.tutor_user_id,
      student_user_id: lesson.student_user_id,
      occurred_on: lesson.occurs_on,
      started_at: lesson.start_time,
      ended_at: lesson.end_time,
      mode: lesson.mode,
    });
    if (!parsed.success) {
      setProblems(uniqueLines(parsed.error.issues.map((issue) => issue.message)));
      return;
    }
    try {
      const result = await record.mutateAsync(parsed.data);
      setRecorded(result.data);
    } catch (error) {
      setProblems(error instanceof ApiRequestError ? refusalLines(error) : ['Could not record the lesson.']);
    }
  }

  const when = lessonWhen(lesson.occurs_on, lesson.start_time, today);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid={recorded ? 'record-lesson-done' : 'record-lesson'}>
        {recorded ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="text-success size-5" aria-hidden /> Lesson recorded.
              </DialogTitle>
              <DialogDescription>
                {recorded.student_name}, {capital(lessonWhen(recorded.occurred_on, recorded.started_at, today))}, until{' '}
                {formatClockTime(recorded.ended_at)} ({formatDuration(recorded.duration_minutes)}). Add the write-up now,
                or later from the lesson.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} data-testid="record-lesson-close">
                Done
              </Button>
              <Button onClick={() => onWriteUpRecorded(recorded)} data-testid="record-lesson-write-up-recorded">
                <PencilLineIcon /> Write up the lesson
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Record a lesson</DialogTitle>
              <DialogDescription>Check it is the lesson {showTutor ? 'that was taught' : 'you taught'}.</DialogDescription>
            </DialogHeader>
            <ul className="bg-muted/50 grid gap-1.5 rounded-lg p-3 text-sm" data-testid="record-lesson-summary">
              <li className="font-medium">
                {lesson.student_name}
                {showTutor && <span className="text-muted-foreground font-normal"> with {lesson.tutor_name}</span>}
              </li>
              <li data-testid="record-lesson-when">
                {capital(when)}, until {formatClockTime(lesson.end_time)}
              </li>
              <li className="text-muted-foreground flex items-center gap-1.5">
                <MapPinIcon className="size-3.5" aria-hidden />
                {lesson.place?.name ? `${lesson.place.name} · ` : ''}
                {SESSION_MODE_LABELS[lesson.mode]}
              </li>
            </ul>
            {problems.length > 0 && <ProblemLines lines={problems} testId="record-lesson-problem" />}
            <DialogFooter className="gap-2 sm:flex-wrap">
              {draft ? (
                <DraftMark draft={draft} onContinue={() => onWriteUp(draft.id)} testId="record-lesson-draft" />
              ) : (
                <>
                  <Button variant="outline" onClick={() => onWriteUp(null)} disabled={record.isPending} data-testid="record-lesson-write-up">
                    <PencilLineIcon /> Write up the lesson
                  </Button>
                  <Button onClick={() => void asPlanned()} disabled={record.isPending} data-testid="record-lesson-as-planned">
                    {record.isPending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                    It ran as planned
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The lessons still owed a record (JF30): the "Record a lesson" quick action and the Sessions page's button open this,
 * not a form dated today. Each row records one; "Another lesson" is the blank form, with no date filled in.
 */
function LessonsOwedDialog({
  open,
  onOpenChange,
  onLesson,
  onDraft,
  onAnother,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLesson: (lesson: KnownLesson) => void;
  onDraft: (lesson: KnownLesson, draftId: string) => void;
  onAnother: () => void;
}) {
  const owed = useLessonsOwed(open);
  const rows = owed.data?.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="lessons-owed">
        <DialogHeader>
          <DialogTitle>Record a lesson</DialogTitle>
          <DialogDescription>The lessons of the last week that are not recorded yet, newest first.</DialogDescription>
        </DialogHeader>
        {owed.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 animate-spin" /> Loading…
          </p>
        ) : (
          <OwedRows rows={rows} onLesson={onLesson} onDraft={onDraft} testPrefix="owed" empty="Every lesson of the last week is recorded." />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onAnother} data-testid="owed-another">
            <PlusIcon /> Another lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One row per lesson owed: who, when, where, and Record -- or the reader's draft of it. */
function OwedRows({
  rows,
  onLesson,
  onDraft,
  testPrefix,
  empty,
}: {
  rows: LessonOwed[];
  onLesson: (lesson: KnownLesson) => void;
  onDraft: (lesson: KnownLesson, draftId: string) => void;
  testPrefix: string;
  empty: string;
}) {
  const { user } = useAuth();
  const today = useOrgToday();
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="divide-border grid divide-y">
      {rows.map((row) => {
        const lesson = knownFromOwed(row);
        const key = `${row.schedule_id}-${row.occurs_on}`;
        return (
          <li key={key} className="flex flex-wrap items-center gap-2 py-2.5 text-sm" data-testid={`${testPrefix}-${key}`}>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{row.student_name}</span>
              {row.tutor_user_id !== user?.id && <span className="text-muted-foreground"> with {row.tutor_name}</span>}
              <span className="text-muted-foreground block text-xs">
                {capital(lessonWhen(row.occurs_on, row.start_time, today))}
                {row.place?.name ? ` · ${row.place.name}` : ''}
              </span>
            </span>
            {row.draft ? (
              <DraftMark draft={row.draft} onContinue={() => onDraft(lesson, row.draft!.id)} testId={`${testPrefix}-draft-${key}`} />
            ) : (
              <Button size="sm" variant="outline" onClick={() => onLesson(lesson)} data-testid={`${testPrefix}-record-${key}`}>
                <PencilLineIcon /> Record
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "To record" at the top of the Sessions page's Tutoring tab (JF30), for tutors and the office: the lessons still owed,
 * each with Record (or its draft). No money.
 */
export function ToRecordPanel({ onFlow }: { onFlow: (flow: RecordFlow) => void }) {
  const owed = useLessonsOwed();
  const [all, setAll] = useState(false);
  const rows = owed.data?.data ?? [];
  if (owed.isPending) return null;
  const shown = all ? rows : rows.slice(0, 5);
  return (
    <Card className="py-0" data-testid="sessions-to-record">
      <CardContent className="grid gap-1 p-4">
        <h2 className="text-sm font-semibold">
          To record
          {rows.length > 0 && <span className="text-muted-foreground ml-2 text-xs font-normal">{rows.length} from the last week</span>}
        </h2>
        <OwedRows
          rows={shown}
          testPrefix="sessions-to-record"
          empty="Every lesson of the last week is recorded."
          onLesson={(lesson) => onFlow({ kind: 'lesson', lesson })}
          onDraft={(lesson, draftId) => onFlow({ kind: 'form', lesson, draftId })}
        />
        {rows.length > shown.length && (
          <Button variant="link" size="sm" className="justify-self-start px-0" onClick={() => setAll(true)}>
            Show all {rows.length}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Every line a refusal carries -- its message and each field's -- each said once (the detail often repeats it). */
export function refusalLines(error: ApiRequestError): string[] {
  const details = Object.values(error.details ?? {}).flat();
  const generic = error.message === 'Please correct the highlighted fields.' && details.length > 0;
  return uniqueLines([...(generic ? [] : [error.message]), ...details]);
}

function uniqueLines(lines: string[]): string[] {
  return [...new Set(lines.filter(Boolean))];
}

/** A refusal, said in place (never a toast that is gone before it is read). */
export function ProblemLines({ lines, testId }: { lines: string[]; testId?: string }) {
  return (
    <div role="alert" className="text-destructive grid gap-0.5 text-sm" data-testid={testId}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

const capital = (text: string) => (text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text);

/** For the recorded lesson's toast elsewhere: the length, never the pay. */
export function recordedToast(session: Pick<TutoringSession, 'started_at' | 'ended_at' | 'duration_minutes'>) {
  toast.success(
    `Lesson recorded: ${formatClockTime(session.started_at)}–${formatClockTime(session.ended_at)}, ${formatDuration(session.duration_minutes)}.`,
  );
}
