// Ported from apps/web/src/features/progress/progress-card.tsx @ 1132322
import { formatCadence, type StudentProgress } from '@tmi/shared';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { ProgressChart } from './progress-chart';
import { ProgressStatusBadge } from './rating';

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The line under the goal: topics mastered, sessions held against planned, cancellations. */
export function progressSummaryLine(summary: StudentProgress['summary']): string {
  let line =
    `${summary.mastered_count} of ${summary.topic_count} topics mastered · ${summary.sessions_held} ` +
    `of ${summary.sessions_planned_to_date} planned sessions held`;
  if (summary.sessions_cancelled_to_date > 0) line += ` · ${summary.sessions_cancelled_to_date} cancelled`;
  if (summary.sessions_cancelled_upcoming > 0) {
    line += ` · ${summary.sessions_cancelled_upcoming} upcoming ${
      summary.sessions_cancelled_upcoming === 1 ? 'lesson' : 'lessons'
    } cancelled`;
  }
  return line;
}

/**
 * One student's goal and timeline, for a dashboard. What a family opens the app to see: is the
 * tutoring working, and will it get there in time. "Details" opens the student's progress page.
 */
export function StudentProgressCard({
  progress,
  title,
  tourId,
}: {
  progress: StudentProgress;
  title: string;
  /** What the feature tour (34) points at. */
  tourId?: string;
}) {
  const theme = useAppTheme();
  const { plan, summary } = progress;
  const testID = `progress-card-${progress.student.user_id}`;
  const action = {
    label: 'Details',
    to: { pathname: '/progress/[studentId]' as const, params: { studentId: progress.student.user_id } },
    withAnchor: true,
  };

  if (!plan) {
    return (
      <Panel testID={testID} tourId={tourId} title={title} action={action}>
        <EmptyNote>
          {progress.assessments.length > 0
            ? 'Assessed — the learning plan is still being set.'
            : 'No learning plan yet. The office sets one after an initial assessment.'}
        </EmptyNote>
      </Panel>
    );
  }

  return (
    <Panel testID={testID} tourId={tourId} title={title} action={action}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: space.sm,
          marginBottom: space.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
            {plan.goal}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {shortDate(plan.starts_on)} → {shortDate(plan.target_on)} ·{' '}
            {formatCadence(plan.sessions_per_week, plan.session_minutes)}
          </Text>
        </View>
        <ProgressStatusBadge status={summary.status} />
      </View>
      <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, marginBottom: space.sm }}>
        {progressSummaryLine(summary)}
      </Text>
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
