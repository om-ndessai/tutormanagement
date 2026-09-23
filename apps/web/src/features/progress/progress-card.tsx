import { Link } from 'react-router-dom';
import { formatCadence, type ProgressOverview, type StudentProgress } from '@tmi/shared';

import { EmptyNote, Panel } from '@/features/dashboard/stat-card';
import { ProgressChart } from './progress-chart';
import { ProgressList } from './progress-list';
import { ProgressStatusBadge } from './rating';

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * One student's goal and timeline, for a dashboard. What a family opens the
 * portal to see: is the tutoring working, and will it get there in time.
 */
export function StudentProgressCard({
  progress,
  index,
  title,
}: {
  progress: StudentProgress;
  index: number;
  title: string;
}) {
  const { plan, summary } = progress;
  const detail = `/progress/${progress.student.user_id}`;

  if (!plan) {
    return (
      <Panel index={index} title={title} action={{ label: 'Details', to: detail }}>
        <EmptyNote>
          {progress.assessments.length > 0
            ? 'Assessed — the learning plan is still being set.'
            : 'No learning plan yet. The office sets one after an initial assessment.'}
        </EmptyNote>
      </Panel>
    );
  }

  return (
    <Panel index={index} title={title} action={{ label: 'Details', to: detail }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-semibold">{plan.goal}</p>
          <p className="text-muted-foreground text-xs">
            {shortDate(plan.starts_on)} → {shortDate(plan.target_on)} ·{' '}
            {formatCadence(plan.sessions_per_week, plan.session_minutes)}
          </p>
        </div>
        <ProgressStatusBadge status={summary.status} />
      </div>

      <p className="text-muted-foreground mb-2 text-xs">
        {summary.mastered_count} of {summary.topic_count} topics mastered · {summary.sessions_held}{' '}
        of {summary.sessions_planned_to_date} planned sessions held
      </p>

      <ProgressChart plan={plan} summary={summary} timeline={progress.timeline} today={progress.today} />
    </Panel>
  );
}

/** A list of students against their plans, trouble first, for a dashboard. */
export function ProgressOverviewPanel({
  rows,
  index,
  title,
  empty,
  limit = 6,
}: {
  rows: ProgressOverview[];
  index: number;
  title: string;
  empty: string;
  limit?: number;
}) {
  const rank = { behind: 0, not_started: 1, no_plan: 2, on_track: 3, ahead: 4, achieved: 5, closed: 6 };
  const sorted = [...rows].sort(
    (a, b) =>
      rank[a.summary.status] - rank[b.summary.status] || a.student_name.localeCompare(b.student_name),
  );
  const behind = rows.filter((row) => row.summary.status === 'behind').length;
  const onPlan = rows.filter((row) => row.goal !== null).length;

  return (
    <Panel index={index} title={title} action={{ label: 'All progress', to: '/progress' }}>
      {rows.length > 0 && (
        <p className="text-muted-foreground mb-2 text-xs">
          {onPlan} of {rows.length} on a plan
          {behind > 0 && (
            <>
              {' · '}
              <Link to="/progress" className="text-warning-foreground dark:text-warning font-medium">
                {behind} behind
              </Link>
            </>
          )}
        </p>
      )}
      <ProgressList rows={sorted} empty={empty} limit={limit} />
    </Panel>
  );
}
