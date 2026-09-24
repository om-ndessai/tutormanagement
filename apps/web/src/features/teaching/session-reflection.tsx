import { useEffect, useState } from 'react';
import { Loader2Icon, SmileIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  REFLECTION_QUESTIONS,
  SESSION_REFLECTOR_LABELS,
  reflectionFlags,
  type Rating,
  type ReflectionKey,
  type SessionReflection,
  type SessionReflectorRole,
  type TutoringSession,
  type User,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RatingChip, RatingPicker, ScaleChip } from '@/features/progress/rating';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useSaveReflection, useWithdrawReflection } from './api';
import { NoteField } from './session-notes';

// ---------------------------------------------------------------------------
// Phase 25: the student's own view of a lesson. Typed by the student, a
// parent sitting with them, or the tutor at the end of the lesson -- but the
// words are the student's. No money anywhere: it is read on the Tutoring tab.
// ---------------------------------------------------------------------------

type Answers = Record<ReflectionKey, Rating | null>;

const NO_ANSWERS: Answers = { learned_new: null, difficulty: null, understanding: null, pace: null };

/**
 * The capacity the reader would type a reflection in, mirroring the API's
 * sessionReflectorRole from what the row already says: `money_view` is
 * 'family' exactly when it is the reader's own lesson or their child's.
 */
export function likelyReflectorRole(
  session: TutoringSession,
  user: User,
): SessionReflectorRole | null {
  if (session.student_user_id === user.id) return 'student';
  if (session.tutor_user_id === user.id) return 'tutor';
  if (session.money_view === 'family') return 'parent';
  return null;
}

/**
 * Whether the reader may change the reflection: anybody who may enter one,
 * except that an adult may not overwrite what the student entered.
 */
export function mayChangeReflection(session: TutoringSession, user: User | null): boolean {
  if (!user) return false;
  const role = likelyReflectorRole(session, user);
  if (!role) return false;
  return session.reflection?.entered_as !== 'student' || role === 'student';
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

/** One answer as a chip: the rating ramp for low-to-high, neutral for centred. */
function AnswerChip({ questionKey, value }: { questionKey: ReflectionKey; value: Rating | null }) {
  const question = REFLECTION_QUESTIONS.find((q) => q.key === questionKey)!;
  return question.centred ? (
    <ScaleChip value={value} labels={question.labels} />
  ) : (
    <RatingChip rating={value} labels={question.labels} />
  );
}

/** Where a lesson missed, as warning badges: "Too fast", "Little new". */
export function ReflectionFlags({ reflection }: { reflection: SessionReflection }) {
  const flags = reflectionFlags(reflection);
  if (flags.length === 0) return null;

  return (
    <>
      {flags.map((flag) => (
        <Badge
          key={flag}
          variant="outline"
          className="border-warning/60 text-warning-foreground dark:text-warning text-[10px]"
        >
          {flag}
        </Badge>
      ))}
    </>
  );
}

/** The four answers in a compact row, for a list. */
export function ReflectionChips({ reflection }: { reflection: SessionReflection }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {REFLECTION_QUESTIONS.map((question) => (
        <span key={question.key} className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <AnswerChip questionKey={question.key} value={reflection[question.key]} />
          {question.short}
        </span>
      ))}
    </span>
  );
}

/** The student's reflection in full, for a lesson's expanded notes. */
export function ReflectionView({
  reflection,
  studentName,
}: {
  reflection: SessionReflection;
  studentName: string;
}) {
  return (
    <section>
      <h4 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {firstName(studentName)}’s reflection
      </h4>
      <dl className="mt-1 grid gap-1.5 sm:grid-cols-2">
        {REFLECTION_QUESTIONS.map((question) => {
          const value = reflection[question.key];
          return (
            <div key={question.key} className="flex items-center gap-2">
              <AnswerChip questionKey={question.key} value={value} />
              <dt className="text-muted-foreground text-xs">{question.short}</dt>
              <dd className="text-xs">{value ? question.labels[value] : 'Not answered'}</dd>
            </div>
          );
        })}
      </dl>
      {reflection.homework_notes && (
        <p className="mt-2 text-sm whitespace-pre-wrap">
          <span className="text-muted-foreground text-xs">Homework notes: </span>
          {reflection.homework_notes}
        </p>
      )}
      {reflection.comment && <p className="mt-1 text-sm whitespace-pre-wrap">{reflection.comment}</p>}
      {reflection.entered_as !== 'student' && (
        <p className="text-muted-foreground mt-1 text-xs">
          Entered {reflection.entered_by_name ? `by ${reflection.entered_by_name} ` : ''}(
          {SESSION_REFLECTOR_LABELS[reflection.entered_as]}) for {firstName(studentName)}.
        </p>
      )}
    </section>
  );
}

/**
 * The questions, put to the student in their own words, or to an adult
 * entering it for them as "Did Sofia…?".
 */
function ReflectionFields({
  studentName,
  forStudent,
  answers,
  onAnswers,
  homeworkNotes,
  onHomeworkNotes,
  comment,
  onComment,
  errors,
}: {
  studentName: string;
  forStudent: boolean;
  answers: Answers;
  onAnswers: (value: Answers) => void;
  homeworkNotes: string;
  onHomeworkNotes: (value: string) => void;
  comment: string;
  onComment: (value: string) => void;
  errors: Record<string, string>;
}) {
  const name = firstName(studentName);

  return (
    <div className="grid gap-4">
      {REFLECTION_QUESTIONS.map((question) => {
        const prompt = forStudent ? question.ask : question.askAbout(name);
        const value = answers[question.key];
        return (
          <div key={question.key} className="grid gap-1">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{prompt}</span>
              <RatingPicker
                name={prompt}
                value={value}
                onChange={(next) => onAnswers({ ...answers, [question.key]: next })}
                labels={question.labels}
                neutral={question.centred}
              />
            </div>
            <p className="text-muted-foreground text-right text-xs">
              {value
                ? question.labels[value]
                : `${question.labels[1]} … ${question.labels[5]}`}
            </p>
            {errors[question.key] && (
              <p role="alert" className="text-destructive text-xs">
                {errors[question.key]}
              </p>
            )}
          </div>
        );
      })}

      <NoteField
        id="reflection-homework"
        label="Homework notes"
        value={homeworkNotes}
        onChange={onHomeworkNotes}
        placeholder={forStudent ? 'Anything about the homework: what was hard, what you finished' : `Anything ${name} said about the homework`}
        error={errors.homework_notes}
      />
      <NoteField
        id="reflection-comment"
        label="Anything else"
        value={comment}
        onChange={onComment}
        placeholder="Optional"
        error={errors.comment}
      />
    </div>
  );
}

/**
 * Records, revises or withdraws the student's reflection on a lesson.
 * Opened only for somebody who may change it; the API holds the same line.
 */
export function ReflectionDialog({
  session,
  onClose,
}: {
  /** The lesson; null closes the dialog. */
  session: TutoringSession | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const save = useSaveReflection();
  const withdraw = useWithdrawReflection();

  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [homeworkNotes, setHomeworkNotes] = useState('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const role = session && user ? likelyReflectorRole(session, user) : null;
  const forStudent = role === 'student';
  const existing = session?.reflection ?? null;
  const busy = save.isPending || withdraw.isPending;

  useEffect(() => {
    if (!session) return;
    const current = session.reflection;
    setAnswers(
      current
        ? {
            learned_new: current.learned_new,
            difficulty: current.difficulty,
            understanding: current.understanding,
            pace: current.pace,
          }
        : NO_ANSWERS,
    );
    setHomeworkNotes(current?.homework_notes ?? '');
    setComment(current?.comment ?? '');
    setErrors({});
    // Reset only when a different lesson opens, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setErrors({});

    try {
      await save.mutateAsync({
        sessionId: session.id,
        input: {
          ...answers,
          homework_notes: homeworkNotes.trim() || null,
          comment: comment.trim() || null,
        },
      });
      toast.success(forStudent ? 'Thanks — your reflection is saved.' : 'Reflection saved.');
      onClose();
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save the reflection.');
    }
  }

  async function handleWithdraw() {
    if (!session) return;
    try {
      await withdraw.mutateAsync(session.id);
      toast.success('Reflection withdrawn.');
      onClose();
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not withdraw the reflection.',
      );
    }
  }

  const name = session ? firstName(session.student_name) : '';

  return (
    <Dialog open={session !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSave} noValidate>
          <DialogHeader>
            <DialogTitle>
              {forStudent ? 'How did this lesson go for you?' : `${name}’s reflection`}
            </DialogTitle>
            <DialogDescription>
              {session && (
                <>
                  The {session.occurred_on} lesson with {session.tutor_name}.{' '}
                  {forStudent
                    ? 'Your tutor, your parents and the office can read it.'
                    : `You are entering this for ${name}, in ${name}’s words. The tutor, the family and the office can read it, and ${name} can change it later.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {session && (
              <ReflectionFields
                studentName={session.student_name}
                forStudent={forStudent}
                answers={answers}
                onAnswers={setAnswers}
                homeworkNotes={homeworkNotes}
                onHomeworkNotes={setHomeworkNotes}
                comment={comment}
                onComment={setComment}
                errors={errors}
              />
            )}
          </div>

          <DialogFooter>
            {existing && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive sm:mr-auto"
                onClick={handleWithdraw}
                disabled={busy}
              >
                Withdraw
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {save.isPending && <Loader2Icon className="animate-spin" />}
              Save reflection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The card's way in: "Reflect" for the student, and for an adult entering it
 * with them. Hidden from anybody who may not change it -- including an adult,
 * once the student has entered it themselves.
 */
export function ReflectButton({
  session,
  onReflect,
}: {
  session: TutoringSession;
  onReflect: (session: TutoringSession) => void;
}) {
  const { user } = useAuth();
  if (!user || !mayChangeReflection(session, user)) return null;

  const forStudent = likelyReflectorRole(session, user) === 'student';
  const label = session.reflection
    ? forStudent
      ? 'Your reflection'
      : 'Edit reflection'
    : forStudent
      ? 'Reflect'
      : 'Add reflection';

  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => onReflect(session)}
      aria-label={
        forStudent
          ? session.reflection
            ? 'Edit your reflection'
            : 'Reflect on this session'
          : `${session.reflection ? 'Edit' : 'Add'} ${firstName(session.student_name)}’s reflection`
      }
    >
      <SmileIcon />
      {label}
    </Button>
  );
}
