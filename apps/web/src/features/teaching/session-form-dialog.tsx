import { useEffect, useMemo, useState } from 'react';
import { ClockIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SESSION_MODES,
  SESSION_MODE_LABELS,
  computeAmountCents,
  elapsedMinutes,
  formatCents,
  formatDuration,
  parseClockTime,
  resolveChargeRateCents,
  resolveRateCents,
  roundToQuarterHour,
  GOAL_RATING_LABELS,
  type Assignment,
  type Rating,
  type SessionMode,
  type TutoringSession,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useStudentProgress, useTopicIndex } from '@/features/progress/api';
import { useUserDetail } from '@/features/users/api';
import { RatingPicker, TopicName } from '@/features/progress/rating';
import { useAssignments, useRecordSession, useUpdateSession } from './api';

/** Common lesson lengths, offered as one tap rather than clock arithmetic. */
const QUICK_LENGTHS = [45, 60, 75, 90, 120];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Adds minutes to an HH:MM time, clamped to the same day. */
function addMinutes(time: string, minutes: number): string {
  const start = parseClockTime(time);
  if (start === null) return time;

  const end = Math.min(start + minutes, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/**
 * Records a lesson that has already happened.
 *
 * The duration and the amount shown here are computed with the same shared
 * helpers the Worker uses, so the preview cannot promise a figure the server
 * would disagree with -- but the server still derives them itself, and ignores
 * anything the client sends.
 */
export function SessionFormDialog({
  open,
  onOpenChange,
  existing,
  showMoney = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: TutoringSession | null;
  /**
   * False when opened from the sessions page's Tutoring tab, which a tutor
   * uses with the student beside them: the preview then shows the length only.
   */
  showMoney?: boolean;
}) {
  const isEdit = existing !== null;
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [assignmentId, setAssignmentId] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIso);
  const [startedAt, setStartedAt] = useState('16:00');
  const [endedAt, setEndedAt] = useState('17:00');
  const [mode, setMode] = useState<SessionMode>('in_person');
  const [notes, setNotes] = useState('');
  const [goalRating, setGoalRating] = useState<Rating | null>(null);
  const [topicRatings, setTopicRatings] = useState(new Map<string, Rating>());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // A tutor only ever sees their own pairings; an admin sees all of them.
  const { data: assignmentsData } = useAssignments(
    isAdmin ? {} : { tutor_user_id: user?.id },
  );
  const assignments = assignmentsData?.data ?? [];

  const record = useRecordSession();
  const update = useUpdateSession();
  const saving = record.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setErrors({});

    if (existing) {
      const match = assignments.find(
        (a) =>
          a.tutor_user_id === existing.tutor_user_id &&
          a.student_user_id === existing.student_user_id,
      );
      setAssignmentId(match?.id ?? '');
      setOccurredOn(existing.occurred_on);
      setStartedAt(existing.started_at);
      setEndedAt(existing.ended_at);
      setMode(existing.mode);
      setNotes(existing.notes ?? '');
      setGoalRating(existing.progress?.goal_rating ?? null);
      setTopicRatings(
        new Map((existing.progress?.topic_ratings ?? []).map((row) => [row.topic_id, row.rating])),
      );
    } else {
      setAssignmentId(assignments.length === 1 ? assignments[0]!.id : '');
      setOccurredOn(todayIso());
      setStartedAt('16:00');
      setEndedAt('17:00');
      setMode('in_person');
      setNotes('');
      setGoalRating(null);
      setTopicRatings(new Map());
    }
    // `assignments` is intentionally excluded: repopulating mid-edit would
    // stomp on what the user has typed when the query refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  const assignment: Assignment | undefined = assignments.find((a) => a.id === assignmentId);
  const studentId = existing?.student_user_id ?? assignment?.student_user_id;

  // The price is set on the student and only an admin may read it, so only
  // an admin's preview can show the family's side and the institute's cut.
  const { data: studentDetail } = useUserDetail(isAdmin && studentId ? studentId : null);
  const studentPrices = studentDetail?.data.student_profile ?? null;

  /**
   * Only sent when there is something to say: a lesson scored for the first
   * time, or an existing score being changed or cleared. Otherwise the
   * lesson is recorded with no progress row at all.
   */
  const progressBody =
    goalRating !== null || topicRatings.size > 0 || existing?.progress
      ? {
          goal_rating: goalRating,
          topic_ratings: [...topicRatings].map(([topic_id, rating]) => ({ topic_id, rating })),
        }
      : undefined;

  /** The live preview: elapsed -> billed quarter hours -> money. */
  const preview = useMemo(() => {
    const elapsed = elapsedMinutes(startedAt, endedAt);
    if (elapsed === null) return null;

    const billed = roundToQuarterHour(elapsed);

    const rate = assignment
      ? resolveRateCents(
          mode,
          {
            in_person: assignment.rate_in_person_cents,
            virtual: assignment.rate_virtual_cents,
          },
          {
            in_person: assignment.effective_rate_in_person_cents,
            virtual: assignment.effective_rate_virtual_cents,
          },
        )
      : null;

    const chargeRate = studentPrices ? resolveChargeRateCents(mode, studentPrices) : null;

    return {
      elapsed,
      billed,
      rate,
      amount: rate == null ? null : computeAmountCents(billed, rate),
      // Admin only: null for a tutor, who is never sent the price.
      charge: chargeRate == null ? null : computeAmountCents(billed, chargeRate),
    };
  }, [startedAt, endedAt, mode, assignment, studentPrices]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (!isEdit && !assignment) {
      setErrors({ assignment: 'Choose which student this session was with.' });
      return;
    }

    try {
      if (isEdit) {
        await update.mutateAsync({
          id: existing.id,
          input: {
            occurred_on: occurredOn,
            started_at: startedAt,
            ended_at: endedAt,
            mode,
            notes: notes.trim() || null,
            ...(progressBody ? { progress: progressBody } : {}),
          } as never,
        });
        toast.success('Session updated.');
      } else {
        await record.mutateAsync({
          tutor_user_id: assignment!.tutor_user_id,
          student_user_id: assignment!.student_user_id,
          occurred_on: occurredOn,
          started_at: startedAt,
          ended_at: endedAt,
          mode,
          notes: notes.trim() || null,
          ...(progressBody ? { progress: progressBody } : {}),
        } as never);
        toast.success('Session recorded.');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the session.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit session' : 'Record a session'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `${existing.tutor_name} with ${existing.student_name}.`
                : 'Log a lesson that has already taken place.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!isEdit && (
              <div className="grid gap-2">
                <Label htmlFor="pairing" className={errors.assignment ? 'text-destructive' : ''}>
                  Student
                </Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger id="pairing" className="w-full">
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.student_name}
                        {isAdmin && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            with {option.tutor_name}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignments.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    You have no students assigned. An admin assigns students to tutors.
                  </p>
                )}
                {errors.assignment && (
                  <p role="alert" className="text-destructive text-xs">
                    {errors.assignment}
                  </p>
                )}
                {errors.student_user_id && (
                  <p role="alert" className="text-destructive text-xs">
                    {errors.student_user_id}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={occurredOn}
                  max={todayIso()}
                  onChange={(event) => setOccurredOn(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mode">Mode</Label>
                <Select value={mode} onValueChange={(value) => setMode(value as SessionMode)}>
                  <SelectTrigger id="mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_MODES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SESSION_MODE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="start">Started</Label>
                <Input
                  id="start"
                  type="time"
                  step={300}
                  value={startedAt}
                  onChange={(event) => setStartedAt(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="end" className={errors.ended_at ? 'text-destructive' : ''}>
                  Ended
                </Label>
                <Input
                  id="end"
                  type="time"
                  step={300}
                  value={endedAt}
                  onChange={(event) => setEndedAt(event.target.value)}
                  aria-invalid={Boolean(errors.ended_at)}
                />
                {errors.ended_at && (
                  <p role="alert" className="text-destructive text-xs">
                    {errors.ended_at}
                  </p>
                )}
              </div>
            </div>

            {/* One tap for the usual lengths, instead of doing clock arithmetic. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground mr-1 text-xs">Ran for</span>
              {QUICK_LENGTHS.map((minutes) => {
                const active = preview?.billed === minutes;

                return (
                  <Button
                    key={minutes}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEndedAt(addMinutes(startedAt, minutes))}
                  >
                    {formatDuration(minutes)}
                  </Button>
                );
              })}
            </div>

            <SessionPreview
              preview={preview}
              hasAssignment={Boolean(assignment)}
              isAdmin={isAdmin}
              showMoney={showMoney}
            />

            <div className="grid gap-2">
              <Label htmlFor="notes">Session notes</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="What was covered, how it went, progress towards their goal, homework set…"
                className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>

            {errors.mode && (
              <p role="alert" className="text-destructive text-xs">
                {errors.mode}
              </p>
            )}

            {studentId && (
              <ProgressSection
                studentId={studentId}
                goalRating={goalRating}
                onGoalRating={setGoalRating}
                topicRatings={topicRatings}
                onTopicRatings={setTopicRatings}
                error={errors['progress.topic_ratings']}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Record session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shows exactly what will be billed, and why, before anything is saved. */
function SessionPreview({
  preview,
  hasAssignment,
  isAdmin,
  showMoney,
}: {
  preview: {
    elapsed: number;
    billed: number;
    rate: number | null;
    amount: number | null;
    charge: number | null;
  } | null;
  hasAssignment: boolean;
  isAdmin: boolean;
  showMoney: boolean;
}) {
  if (!preview) {
    return (
      <div className="bg-muted/50 text-muted-foreground rounded-md px-3 py-2.5 text-sm">
        Enter a start and end time.
      </div>
    );
  }

  const rounded = preview.billed !== preview.elapsed;

  return (
    <div className="bg-muted/50 rounded-md px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <ClockIcon className="text-muted-foreground size-4" />
          <span className="font-medium">{formatDuration(preview.billed)}</span>
          {rounded && (
            <span className="text-muted-foreground text-xs">
              rounded from {formatDuration(preview.elapsed)}
            </span>
          )}
        </span>

        {/* A missing rate still warns on the Tutoring tab: it is a problem to
            fix, not a figure. */}
        {preview.amount != null ? (
          showMoney && (
            <span className="text-right">
              <span className="text-muted-foreground block text-[10px] font-medium tracking-wide uppercase">
                {isAdmin ? 'Tutor pay' : 'Your pay'}
              </span>
              <span className="font-display text-lg font-semibold tabular-nums">
                {formatCents(preview.amount)}
              </span>
            </span>
          )
        ) : (
          <span className={cn('text-xs', hasAssignment ? 'text-destructive' : 'text-muted-foreground')}>
            {hasAssignment ? 'No rate set for this mode' : 'Choose a student'}
          </span>
        )}
      </div>

      {showMoney && preview.rate != null && (
        <p className="text-muted-foreground mt-1 text-xs">
          {isAdmin ? 'The tutor is' : 'You are'} paid in quarter hours at{' '}
          {formatCents(preview.rate)}/hr.
        </p>
      )}

      {/* The admin's view of the same lesson: both sides and the cut. */}
      {showMoney && isAdmin && preview.amount != null && (
        <p className="mt-1 text-xs">
          {preview.charge != null ? (
            <>
              Family charged <span className="font-medium tabular-nums">{formatCents(preview.charge)}</span>{' '}
              · Institute keeps{' '}
              <span className="font-medium tabular-nums">
                {formatCents(preview.charge - preview.amount)}
              </span>
            </>
          ) : (
            <span className="text-destructive">No price is set on this student for this mode.</span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * How the lesson went against the student's learning plan: one score for the
 * step it took towards the goal, and one per plan topic worked on. Every
 * score is optional -- rate what was covered and leave the rest.
 */
function ProgressSection({
  studentId,
  goalRating,
  onGoalRating,
  topicRatings,
  onTopicRatings,
  error,
}: {
  studentId: string;
  goalRating: Rating | null;
  onGoalRating: (value: Rating | null) => void;
  topicRatings: Map<string, Rating>;
  onTopicRatings: (value: Map<string, Rating>) => void;
  error?: string;
}) {
  const { data, isPending } = useStudentProgress(studentId);
  const { topics } = useTopicIndex();
  const progress = data?.data;
  const plan = progress?.plan;

  if (isPending) return null;

  if (!plan) {
    return (
      <p className="bg-muted/50 text-muted-foreground rounded-md px-3 py-2.5 text-xs">
        No learning plan yet, so there is nothing to score this lesson against.
      </p>
    );
  }

  // Plan topics first, in teaching order; then anything scored before that
  // has since left the plan, so an edit never silently drops a score.
  const current = new Map((progress.topics ?? []).map((row) => [row.topic_id, row.current]));
  const ids = [...plan.topic_ids, ...[...topicRatings.keys()].filter((id) => !plan.topic_ids.includes(id))];

  function set(topicId: string, value: Rating | null) {
    const next = new Map(topicRatings);
    if (value === null) next.delete(topicId);
    else next.set(topicId, value);
    onTopicRatings(next);
  }

  return (
    <fieldset className="grid gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Progress towards the goal</legend>
      <p className="text-muted-foreground -mt-1 text-xs">{plan.goal}</p>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">How far did this lesson move them?</span>
        <RatingPicker
          name="Progress towards the goal"
          value={goalRating}
          onChange={onGoalRating}
          labels={GOAL_RATING_LABELS}
        />
      </div>
      {goalRating && (
        <p className="text-muted-foreground -mt-2 text-right text-xs">{GOAL_RATING_LABELS[goalRating]}</p>
      )}

      {ids.length > 0 && (
        <div className="grid gap-1">
          <p className="text-muted-foreground text-xs">
            Where they stand on each topic you covered, 1 (needs help) to 5 (mastered):
          </p>
          <ul className="divide-y">
            {ids.map((id) => {
              const topic = topics.get(id);
              const before = current.get(id);
              return (
                <li key={id} className="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm">
                    <TopicName id={id} name={topic?.name} />
                    {before != null && (
                      <span className="text-muted-foreground ml-1.5 text-xs">latest {before}</span>
                    )}
                  </span>
                  <RatingPicker
                    name={`${id} ${topic?.name ?? ''}`}
                    value={topicRatings.get(id) ?? null}
                    onChange={(value) => set(id, value)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </fieldset>
  );
}
