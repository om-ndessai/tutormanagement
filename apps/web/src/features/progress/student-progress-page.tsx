import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FlagIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  GOAL_RATING_LABELS,
  PLAN_STATUS_LABELS,
  SCHEDULE_CANCELLER_LABELS,
  formatCadence,
  type Assessment,
  type LearningPlan,
  type ProgressCancellation,
  type ProgressPoint,
  type Rating,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyNote, Panel, StatCard } from '@/features/dashboard/stat-card';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import {
  useDeleteAssessment,
  useDeletePlan,
  useStudentProgress,
  useTopicIndex,
} from './api';
import { AssessmentDialog } from './assessment-dialog';
import { PlanDialog } from './plan-dialog';
import { ProgressChart } from './progress-chart';
import { ProgressMeter } from './progress-list';
import { ProgressStatusBadge, RatingChip, RatingLegend, TopicName } from './rating';

/**
 * The plan's lessons and its cancelled ones, newest first, as one list: a
 * cancelled week sits where it happened, so the table explains its own gaps.
 * Upcoming cancellations lead.
 */
function lessonRows(
  timeline: ProgressPoint[],
  cancellations: ProgressCancellation[],
): ({ kind: 'lesson'; day: string; item: ProgressPoint } | { kind: 'cancelled'; day: string; item: ProgressCancellation })[] {
  return [
    ...timeline.map((item) => ({ kind: 'lesson' as const, day: item.occurred_on, item })),
    ...cancellations.map((item) => ({ kind: 'cancelled' as const, day: item.occurs_on, item })),
  ].sort((a, b) => b.day.localeCompare(a.day));
}

/** One lesson of the plan: when, with whom, how it moved them, and where it left them. */
function LessonRow({ point }: { point: ProgressPoint }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <Link to={`/sessions?focus=${point.session_id}`} className="hover:text-primary">
          {longDate(point.occurred_on)}
        </Link>
      </TableCell>
      <TableCell>{point.tutor_name}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <RatingChip rating={point.goal_rating} labels={GOAL_RATING_LABELS} />
          <span className="text-muted-foreground text-xs">
            {point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'Not scored'}
          </span>
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{point.topics_rated}</TableCell>
      <TableCell className="text-right tabular-nums">{point.percent}%</TableCell>
    </TableRow>
  );
}

/** A called-off lesson in the plan's table: when, with whom, and why if the reader may know. */
function CancelledLessonRow({ row, upcoming }: { row: ProgressCancellation; upcoming: boolean }) {
  return (
    <TableRow className="text-muted-foreground">
      <TableCell className="whitespace-nowrap">
        <span className="line-through">{longDate(row.occurs_on)}</span>
        {upcoming && (
          <Badge variant="secondary" className="ml-2 text-[10px]">
            Upcoming
          </Badge>
        )}
      </TableCell>
      <TableCell>{row.tutor_name}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Cancelled
          </Badge>
          <span className="text-xs">
            by {row.cancelled_by_name ?? SCHEDULE_CANCELLER_LABELS[row.cancelled_as]}
          </span>
        </span>
        {row.note && <span className="mt-0.5 block text-xs whitespace-normal">{row.note}</span>}
      </TableCell>
      <TableCell className="text-right">—</TableCell>
      <TableCell className="text-right">—</TableCell>
    </TableRow>
  );
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

type Pending = { kind: 'assessment'; row: Assessment } | { kind: 'plan'; row: LearningPlan };

/**
 * One student's arc: the assessment they started from, the plan agreed for
 * them, and how every lesson since has moved them along it.
 */
export function StudentProgressPage() {
  const { studentId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const { data, isPending, isError } = useStudentProgress(studentId);
  const { levels, topics } = useTopicIndex();

  const [assessing, setAssessing] = useState<{ open: boolean; existing: Assessment | null }>({
    open: false,
    existing: null,
  });
  const [planning, setPlanning] = useState<{ open: boolean; existing: LearningPlan | null }>({
    open: false,
    existing: null,
  });
  const [deleting, setDeleting] = useState<Pending | null>(null);

  const removeAssessment = useDeleteAssessment();
  const removePlan = useDeletePlan();

  if (isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        Loading progress…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <p className="text-muted-foreground text-sm">That student could not be found.</p>
        <Button asChild variant="link">
          <Link to="/progress">Back to progress</Link>
        </Button>
      </div>
    );
  }

  const progress = data.data;
  const { plan, summary, student } = progress;
  const latest = progress.assessments[0] ?? null;
  const levelName = (id: string | null) => levels.find((level) => level.id === id)?.name ?? id;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      if (deleting.kind === 'assessment') await removeAssessment.mutateAsync(deleting.row.id);
      else await removePlan.mutateAsync(deleting.row.id);
      toast.success(deleting.kind === 'assessment' ? 'Assessment deleted.' : 'Plan deleted.');
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not delete it.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to="/progress"
        className="text-muted-foreground hover:text-primary mb-3 inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeftIcon className="size-3.5" />
        All students
      </Link>

      <PageHeader
        title={student.full_name}
        description={
          student.current_math_course
            ? `Currently: ${student.current_math_course}`
            : 'Assessment, learning plan and progress.'
        }
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" onClick={() => setAssessing({ open: true, existing: null })}>
                <ClipboardCheckIcon />
                {latest ? 'Reassess' : 'Assess'}
              </Button>
              {plan ? (
                <Button onClick={() => setPlanning({ open: true, existing: plan })}>
                  <PencilIcon />
                  Edit plan
                </Button>
              ) : (
                <Button onClick={() => setPlanning({ open: true, existing: null })}>
                  <PlusIcon />
                  Create plan
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {plan ? (
          <>
            {/* The goal leads: it is what every figure below is measured against. */}
            <div className="brand-gradient rounded-lg p-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-white/80 uppercase">
                    <FlagIcon className="size-4" />
                    Goal
                  </p>
                  <p className="font-display mt-1 text-xl font-semibold">{plan.goal}</p>
                  <p className="mt-1 text-sm text-white/85">
                    {longDate(plan.starts_on)} → {longDate(plan.target_on)} ·{' '}
                    {formatCadence(plan.sessions_per_week, plan.session_minutes)}
                    {plan.target_level_id && ` · towards ${levelName(plan.target_level_id)}`}
                  </p>
                </div>
                <span className="bg-card rounded-md px-1 py-0.5">
                  <ProgressStatusBadge status={summary.status} />
                </span>
              </div>
            </div>

            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                index={0}
                label="Topics mastered"
                value={summary.mastered_count}
                icon={CheckIcon}
                hint={`of ${summary.topic_count} in the plan · ${summary.percent}%`}
              />
              <StatCard
                index={1}
                label="Expected by today"
                value={summary.expected_percent}
                formatValue={(value) => `${value}%`}
                icon={FlagIcon}
                tone={summary.status === 'behind' ? 'warning' : 'default'}
                hint={`On a straight line to ${longDate(plan.target_on)}`}
              />
              <StatCard
                index={2}
                label="Sessions held"
                value={summary.sessions_held}
                icon={ClipboardCheckIcon}
                hint={
                  // Planned is already net of cancellations (Phase 24): a
                  // vacation week is not a missed lesson.
                  `${summary.sessions_planned_to_date} planned so far` +
                  (summary.sessions_cancelled_to_date > 0
                    ? ` · ${summary.sessions_cancelled_to_date} cancelled`
                    : '')
                }
              />
              <StatCard
                index={3}
                label="Recent lessons"
                value={summary.recent_goal_rating ?? undefined}
                formatValue={(value) => value.toFixed(1)}
                icon={PencilIcon}
                hint={
                  summary.recent_goal_rating === null
                    ? 'Not scored yet'
                    : `${GOAL_RATING_LABELS[Math.round(summary.recent_goal_rating) as Rating]} (of 5)`
                }
              />
            </div>

            <Panel index={4} title="Timeline towards the goal">
              <ProgressChart
                plan={plan}
                summary={summary}
                timeline={progress.timeline}
                today={progress.today}
                cancellations={progress.cancellations}
              />
            </Panel>

            <div className="grid items-start gap-4 lg:grid-cols-5">
              <Panel index={5} title="Plan topics" className="lg:col-span-3">
                {plan.topic_ids.length === 0 ? (
                  <EmptyNote>This plan names no topics; lessons are scored against the goal alone.</EmptyNote>
                ) : (
                  <>
                    <ul className="divide-border divide-y">
                      {progress.topics.map((row) => {
                        const topic = topics.get(row.topic_id);
                        return (
                          <li key={row.topic_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                            <TopicName
                              id={row.topic_id}
                              name={topic?.name}
                              unit={topic?.unit}
                              className="flex-1 text-sm"
                            />
                            <span className="flex items-center gap-1.5 text-xs">
                              <RatingChip rating={row.baseline} />
                              <span className="text-muted-foreground" aria-hidden>
                                →
                              </span>
                              <RatingChip rating={row.current} />
                            </span>
                            <span className="text-muted-foreground w-20 text-right text-xs">
                              {row.mastered ? (
                                <span className="text-success inline-flex items-center gap-1 font-medium">
                                  <CheckIcon className="size-3.5" />
                                  Mastered
                                </span>
                              ) : row.last_rated_on ? (
                                longDate(row.last_rated_on)
                              ) : (
                                'Not yet'
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 border-t pt-3">
                      <RatingLegend />
                    </div>
                  </>
                )}
              </Panel>

              <Panel index={6} title="Recommendation" className="lg:col-span-2">
                <ProgressMeter percent={summary.percent} expected={summary.expected_percent} className="mb-3" />
                {plan.recommendation ? (
                  <p className="text-sm whitespace-pre-line">{plan.recommendation}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">No notes on the course of tutoring.</p>
                )}
                <p className="text-muted-foreground mt-3 text-xs">
                  Set by {plan.created_by_name ?? 'the office'}
                  {isAdmin && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-destructive ml-1 h-auto p-0 text-xs"
                      onClick={() => setDeleting({ kind: 'plan', row: plan })}
                    >
                      Delete plan
                    </Button>
                  )}
                </p>
              </Panel>
            </div>
          </>
        ) : (
          <Panel index={0} title="Learning plan">
            <EmptyNote>
              {latest
                ? 'Assessed, but no plan has been set yet.'
                : 'Not assessed yet. The office records an assessment, then a plan to work towards.'}
            </EmptyNote>
          </Panel>
        )}

        <AssessmentPanel
          assessments={progress.assessments}
          isAdmin={isAdmin}
          levelName={levelName}
          topicName={(id) => topics.get(id)}
          onEdit={(row) => setAssessing({ open: true, existing: row })}
          onDelete={(row) => setDeleting({ kind: 'assessment', row })}
        />

        {(progress.timeline.length > 0 || progress.cancellations.length > 0) && (
          <Panel index={8} title="Lessons in this plan">
            {/* The chart's table view: every value it plots, without hovering. */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Towards the goal</TableHead>
                    <TableHead className="text-right">Topics rated</TableHead>
                    <TableHead className="text-right">Mastered after</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessonRows(progress.timeline, progress.cancellations).map((row) =>
                    row.kind === 'cancelled' ? (
                      <CancelledLessonRow
                        key={`${row.item.schedule_id}-${row.item.occurs_on}`}
                        row={row.item}
                        upcoming={row.item.occurs_on >= progress.today}
                      />
                    ) : (
                      <LessonRow key={row.item.session_id} point={row.item} />
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}

        {progress.past_plans.length > 0 && (
          <Panel index={9} title="Earlier plans">
            <ul className="divide-border divide-y">
              {progress.past_plans.map((past) => (
                <li key={past.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{past.goal}</span>
                    <span className="text-muted-foreground block text-xs">
                      {longDate(past.starts_on)} → {longDate(past.target_on)} ·{' '}
                      {past.topic_ids.length} topics
                    </span>
                  </span>
                  <Badge variant="secondary">{PLAN_STATUS_LABELS[past.status]}</Badge>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit this plan"
                      onClick={() => setPlanning({ open: true, existing: past })}
                    >
                      <PencilIcon />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {isAdmin && (
        <>
          <AssessmentDialog
            open={assessing.open}
            onOpenChange={(open) => setAssessing((current) => ({ ...current, open }))}
            studentId={student.user_id}
            studentName={student.full_name}
            existing={assessing.existing}
            defaultCourse={student.current_math_course}
          />
          <PlanDialog
            open={planning.open}
            onOpenChange={(open) => setPlanning((current) => ({ ...current, open }))}
            studentId={student.user_id}
            studentName={student.full_name}
            existing={planning.existing}
            assessment={latest}
            defaultGoal={student.academic_year_goal}
          />
        </>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {deleting?.kind === 'plan' ? 'learning plan' : 'assessment'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.kind === 'plan'
                ? 'Lessons already scored against it keep their scores, but they will no longer be tied to a plan. To keep it as history, mark it achieved or closed instead.'
                : 'Its write-up and topic ratings are removed. A plan built on it stays, and falls back to the next most recent assessment.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The latest assessment in full, with any earlier ones listed beneath it. */
function AssessmentPanel({
  assessments,
  isAdmin,
  levelName,
  topicName,
  onEdit,
  onDelete,
}: {
  assessments: Assessment[];
  isAdmin: boolean;
  levelName: (id: string | null) => string | null;
  topicName: (id: string) => { name: string; unit: string | null } | undefined;
  onEdit: (row: Assessment) => void;
  onDelete: (row: Assessment) => void;
}) {
  const [shown, setShown] = useState(0);
  const current = assessments[shown];

  if (!current) {
    return (
      <Panel index={7} title="Assessment">
        <EmptyNote>No assessment recorded yet.</EmptyNote>
      </Panel>
    );
  }

  return (
    <Panel index={7} title={shown === 0 ? 'Latest assessment' : 'Earlier assessment'}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium">{longDate(current.assessed_on)}</span>
        {current.assessor_name && <span className="text-muted-foreground">by {current.assessor_name}</span>}
        {current.recommended_level_id && (
          <Badge variant="secondary">Recommended: {levelName(current.recommended_level_id)}</Badge>
        )}
        {current.school_course && (
          <span className="text-muted-foreground">Enrolled in {current.school_course}</span>
        )}
        {isAdmin && (
          <span className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Edit assessment" onClick={() => onEdit(current)}>
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Delete assessment" onClick={() => onDelete(current)}>
              <Trash2Icon />
            </Button>
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {current.summary ? (
            <p className="text-sm whitespace-pre-line">{current.summary}</p>
          ) : (
            <p className="text-muted-foreground text-sm">No written summary.</p>
          )}
        </div>

        <div className="lg:col-span-2">
          {current.ratings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No topics rated.</p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {[...current.ratings]
                .sort((a, b) => a.rating - b.rating || a.topic_id.localeCompare(b.topic_id))
                .map((row) => (
                  <li key={row.topic_id} className="flex items-center gap-2 px-3 py-1.5">
                    <TopicName id={row.topic_id} name={topicName(row.topic_id)?.name} className="flex-1 truncate text-sm" />
                    <RatingChip rating={row.rating} />
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {assessments.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs">
          <span className="text-muted-foreground mr-1">All assessments:</span>
          {assessments.map((row, index) => (
            <Button
              key={row.id}
              size="sm"
              variant={index === shown ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => setShown(index)}
            >
              {longDate(row.assessed_on)}
            </Button>
          ))}
        </div>
      )}
    </Panel>
  );
}
