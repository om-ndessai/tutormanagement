import { formatCadence, formatDay, type StudentProgress } from '@tmi/shared';

import { EmptyNote, Panel } from '@/features/dashboard/stat-card';
import { ProgressChart } from './progress-chart';
import { ProgressStatusBadge } from './rating';

/** A plan's day, with its year: a plan is read across years (the one shared formatter, Phase 78). */
function shortDate(iso: string, today: string) {
  return formatDay(iso, today, { year: 'always' });
}

/**
 * One student's goal and timeline, for a dashboard. What a family opens the
 * portal to see: is the tutoring working, and will it get there in time.
 */
export function StudentProgressCard({
  progress,
  index,
  title,
  tourId,
}: {
  progress: StudentProgress;
  index: number;
  title: string;
  /** What the feature tour (Phase 26) points at. */
  tourId?: string;
}) {
  const { plan, summary } = progress;
  const detail = `/progress/${progress.student.user_id}`;

  if (!plan) {
    return (
      <Panel index={index} tourId={tourId} title={title} action={{ label: 'Details', to: detail }}>
        <EmptyNote>
          {progress.assessments.length > 0
            ? 'Assessed — the learning plan is still being set.'
            : 'No learning plan yet. The office sets one after an initial assessment.'}
        </EmptyNote>
      </Panel>
    );
  }

  return (
    <Panel index={index} tourId={tourId} title={title} action={{ label: 'Details', to: detail }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-semibold">{plan.goal}</p>
          <p className="text-muted-foreground text-xs">
            {shortDate(plan.starts_on, progress.today)} → {shortDate(plan.target_on, progress.today)} ·{' '}
            {formatCadence(plan.sessions_per_week, plan.session_minutes)}
          </p>
        </div>
        <ProgressStatusBadge status={summary.status} />
      </div>

      <p className="text-muted-foreground mb-2 text-xs">
        {summary.mastered_count} of {summary.topic_count} topics mastered · {summary.sessions_held}{' '}
        of {summary.sessions_planned_to_date} planned lessons held
        {summary.sessions_cancelled_to_date > 0 && ` · ${summary.sessions_cancelled_to_date} cancelled`}
        {summary.sessions_cancelled_upcoming > 0 &&
          ` · ${summary.sessions_cancelled_upcoming} upcoming ${
            summary.sessions_cancelled_upcoming === 1 ? 'lesson' : 'lessons'
          } cancelled`}
      </p>

      <ProgressChart
        plan={plan}
        summary={summary}
        timeline={progress.timeline}
        today={progress.today}
        cancellations={progress.cancellations}
      />
    </Panel>
  );
}
