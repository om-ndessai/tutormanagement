import { useEffect, useState } from 'react';
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleMinusIcon,
  CircleXIcon,
  Loader2Icon,
  MessageSquareTextIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  HOMEWORK_STATUSES,
  HOMEWORK_STATUS_LABELS,
  SESSION_ASSESSMENT_PROMPTS,
  SESSION_ASSESSOR_LABELS,
  SESSION_RATING_LABELS,
  SESSION_WRITE_UP_PARTS,
  type HomeworkStatus,
  type Rating,
  type SessionAssessment,
  type SessionAssessorRole,
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
import { Label } from '@/components/ui/label';
import { RatingChip, RatingPicker } from '@/features/progress/rating';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useSaveSessionAssessment, useWithdrawSessionAssessment } from './api';

// ---------------------------------------------------------------------------
// Phase 23: a lesson's write-up and what people thought of it. Nothing in
// this file shows money: all of it is read on the Tutoring tab, beside the
// student.
// ---------------------------------------------------------------------------

const TEXTAREA =
  'border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]';

/** A labelled free-text part of the write-up. */
export function NoteField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  rows = 2,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  rows?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={error ? 'text-destructive' : ''}>
        {label}
      </Label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={cn(TEXTAREA, rows > 2 ? 'min-h-24' : 'min-h-14')}
      />
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

const HOMEWORK_ICONS: Record<HomeworkStatus, typeof CircleCheckIcon> = {
  done: CircleCheckIcon,
  partial: CircleDashedIcon,
  not_done: CircleXIcon,
  none_set: CircleMinusIcon,
};

const HOMEWORK_TONES: Record<HomeworkStatus, string> = {
  done: 'border-success/40 text-success',
  partial: 'border-warning/60 text-warning-foreground dark:text-warning',
  not_done: 'border-warning/60 text-warning-foreground dark:text-warning',
  none_set: 'text-muted-foreground',
};

/** How last time's homework went, as icon + words: never colour alone. */
export function HomeworkStatusBadge({ status }: { status: HomeworkStatus }) {
  const Icon = HOMEWORK_ICONS[status];

  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px]', HOMEWORK_TONES[status])}>
      <Icon />
      Homework: {HOMEWORK_STATUS_LABELS[status].toLowerCase()}
    </Badge>
  );
}

/** Four choices in a row; pressing the chosen one again clears it. */
export function HomeworkStatusPicker({
  value,
  onChange,
}: {
  value: HomeworkStatus | null;
  onChange: (value: HomeworkStatus | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="How the homework went" className="flex flex-wrap gap-1.5">
      {HOMEWORK_STATUSES.map((status) => {
        const selected = value === status;
        const Icon = HOMEWORK_ICONS[status];

        return (
          <Button
            key={status}
            type="button"
            role="radio"
            aria-checked={selected}
            variant={selected ? 'default' : 'outline'}
            size="xs"
            onClick={() => onChange(selected ? null : status)}
          >
            <Icon />
            {HOMEWORK_STATUS_LABELS[status]}
          </Button>
        );
      })}
    </div>
  );
}

function Part({
  label,
  children,
  aside,
}: {
  label: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
        {label}
        {aside}
      </h4>
      <div className="mt-0.5 text-sm whitespace-pre-wrap">{children}</div>
    </section>
  );
}

/** True when a lesson has anything written about it to show. */
export function hasWrittenNotes(session: Pick<TutoringSession, 'notes' | 'write_up'>): boolean {
  return Boolean(session.notes || session.write_up);
}

/**
 * The write-up in the order a lesson runs: what was planned, the look back at
 * last time and its homework, what was covered, and what was set. A lesson
 * recorded before the parts existed shows its notes alone, as it always did.
 */
export function SessionNotesView({ session }: { session: TutoringSession }) {
  const writeUp = session.write_up;

  if (!writeUp) {
    return session.notes ? <p className="text-sm whitespace-pre-wrap">{session.notes}</p> : null;
  }

  const [planned, previous, homeworkReview, homeworkSet] = SESSION_WRITE_UP_PARTS;

  return (
    <div className="grid gap-3">
      {writeUp.planned && <Part label={planned.label}>{writeUp.planned}</Part>}
      {writeUp.previous_review && <Part label={previous.label}>{writeUp.previous_review}</Part>}
      {(writeUp.homework_review || writeUp.homework_status) && (
        <Part
          label={homeworkReview.label}
          aside={
            writeUp.homework_status && (
              <span className="normal-case">
                <HomeworkStatusBadge status={writeUp.homework_status} />
              </span>
            )
          }
        >
          {writeUp.homework_review}
        </Part>
      )}
      {session.notes && <Part label="What was covered">{session.notes}</Part>}
      {writeUp.homework_assigned && <Part label={homeworkSet.label}>{writeUp.homework_assigned}</Part>}
    </div>
  );
}

/** A compact row of who has assessed the lesson, for the collapsed card. */
export function AssessmentChips({ assessments }: { assessments: SessionAssessment[] }) {
  if (assessments.length === 0) return null;

  return (
    <span className="flex items-center gap-1" aria-label={`${assessments.length} assessments`}>
      {assessments.map((row) => (
        <RatingChip
          key={row.author_user_id}
          rating={row.rating}
          labels={SESSION_RATING_LABELS}
          className="size-5 text-[10px]"
        />
      ))}
    </span>
  );
}

/** Every assessment of the lesson, tutor first, each saying who gave it. */
export function AssessmentsView({ assessments }: { assessments: SessionAssessment[] }) {
  if (assessments.length === 0) return null;

  return (
    <section>
      <h4 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        Assessments
      </h4>
      <ul className="divide-border divide-y">
        {assessments.map((row) => (
          <li key={row.author_user_id} className="flex items-start gap-2.5 py-2">
            <RatingChip rating={row.rating} labels={SESSION_RATING_LABELS} />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-medium">{row.author_name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {SESSION_ASSESSOR_LABELS[row.author_role]}
                  {row.rating ? ` · ${SESSION_RATING_LABELS[row.rating]}` : ''}
                </span>
              </p>
              {row.body && <p className="mt-0.5 text-sm whitespace-pre-wrap">{row.body}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The capacity the reader would assess in, for wording the question. The API
 * decides the real one; this mirrors it from what the row already says --
 * `money_view` is 'family' exactly when it is the reader's own or their
 * child's lesson.
 */
export function likelyAssessorRole(session: TutoringSession, user: User): SessionAssessorRole {
  if (session.tutor_user_id === user.id) return 'tutor';
  if (session.student_user_id === user.id) return 'student';
  if (session.money_view === 'family') return 'parent';
  return user.roles.includes('admin') ? 'admin' : 'parent';
}

/** The rating and a few words: the reader's own assessment fields. */
export function AssessmentFields({
  idPrefix,
  role,
  rating,
  onRating,
  body,
  onBody,
  errors,
}: {
  idPrefix: string;
  role: SessionAssessorRole;
  rating: Rating | null;
  onRating: (value: Rating | null) => void;
  body: string;
  onBody: (value: string) => void;
  errors: { rating?: string; body?: string };
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">{SESSION_ASSESSMENT_PROMPTS[role]}</span>
        <RatingPicker
          name={SESSION_ASSESSMENT_PROMPTS[role]}
          value={rating}
          onChange={onRating}
          labels={SESSION_RATING_LABELS}
        />
      </div>
      {rating && (
        <p className="text-muted-foreground -mt-2 text-right text-xs">{SESSION_RATING_LABELS[rating]}</p>
      )}
      {errors.rating && (
        <p role="alert" className="text-destructive text-xs">
          {errors.rating}
        </p>
      )}
      <NoteField
        id={`${idPrefix}-assessment`}
        label="In a few words"
        value={body}
        onChange={onBody}
        placeholder="Optional"
        error={errors.body}
      />
    </div>
  );
}

/**
 * Gives, revises or withdraws the reader's own assessment of a lesson.
 *
 * Offered to everyone who can see the lesson, because everyone who can see it
 * is somebody it concerns. Nobody else's assessment can be touched here.
 */
export function SessionAssessmentDialog({
  session,
  onOpenChange,
}: {
  /** The lesson being assessed; null closes the dialog. */
  session: TutoringSession | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const save = useSaveSessionAssessment();
  const withdraw = useWithdrawSessionAssessment();

  const [rating, setRating] = useState<Rating | null>(null);
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mine = session?.assessments.find((row) => row.author_user_id === user?.id) ?? null;
  const role = mine?.author_role ?? (session && user ? likelyAssessorRole(session, user) : 'admin');
  const busy = save.isPending || withdraw.isPending;

  useEffect(() => {
    if (!session) return;
    setRating(mine?.rating ?? null);
    setBody(mine?.body ?? '');
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
        input: { rating, body: body.trim() || null },
      });
      toast.success(mine ? 'Assessment updated.' : 'Assessment saved.');
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save the assessment.');
    }
  }

  async function handleWithdraw() {
    if (!session) return;

    try {
      await withdraw.mutateAsync(session.id);
      toast.success('Assessment withdrawn.');
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not withdraw the assessment.',
      );
    }
  }

  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSave} noValidate>
          <DialogHeader>
            <DialogTitle>{mine ? 'Your assessment' : 'Assess this session'}</DialogTitle>
            <DialogDescription>
              {session && (
                <>
                  {session.student_name} with {session.tutor_name}, {session.occurred_on}. Everyone this
                  lesson concerns can read it: its tutor, the student, their parents and the office.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AssessmentFields
              idPrefix="dialog"
              role={role}
              rating={rating}
              onRating={setRating}
              body={body}
              onBody={setBody}
              errors={{ rating: errors.rating, body: errors.body }}
            />
          </div>

          <DialogFooter>
            {mine && (
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {save.isPending && <Loader2Icon className="animate-spin" />}
              Save assessment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The button a lesson card offers: "Assess", or "Your assessment" once given. */
export function AssessButton({
  session,
  onAssess,
}: {
  session: TutoringSession;
  onAssess: (session: TutoringSession) => void;
}) {
  const { user } = useAuth();
  const mine = session.assessments.some((row) => row.author_user_id === user?.id);

  // The lesson's student reflects on it instead (Phase 25).
  if (user && session.student_user_id === user.id) return null;

  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => onAssess(session)}
      aria-label={mine ? 'Edit your assessment' : 'Assess this session'}
    >
      <MessageSquareTextIcon />
      {mine ? 'Your assessment' : 'Assess'}
    </Button>
  );
}
