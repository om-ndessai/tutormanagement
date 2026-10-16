// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 (StudentView). No money
// in this file -- the rules script refuses formatCents here.
import { formatDuration, type StudentDashboard } from '@tmi/shared';
import { View } from 'react-native';
import { Divider, Icon, Text } from 'react-native-paper';

import { countOf } from '@/lib/plural';
import { EmptyNote, Panel } from '@/components/section';
import { FigureRow } from '@/components/figure-row';
import { StudentProgressCard } from '@/features/progress/progress-card';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { ChildCard } from './child-card';
import { CHILD_HORIZON_DAYS, nextLessonFor } from './home-model';
import { TodayCard, useToday } from './home-top';
import { ReflectionPrompts } from './reflections';
import { SessionList } from './session-list';

/** The year's ambition, on the brand colour, until a learning plan's goal replaces it. */
function GoalBanner({ goal, course }: { goal: string; course: string | null }) {
  const theme = useAppTheme();
  const ink = theme.colors.onPrimary;
  return (
    <View
      testID="student-goal"
      style={{
        borderRadius: radius.lg,
        padding: space.lg + 4,
        backgroundColor: theme.colors.primary,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon source="target" size={16} color={ink} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: ink,
          }}
        >
          Your goal this year
        </Text>
      </View>
      <Text variant="titleLarge" style={{ fontWeight: '600', color: ink }}>
        {goal}
      </Text>
      {course ? <Text style={{ fontSize: 14, color: ink, opacity: 0.85 }}>Currently: {course}</Text> : null}
    </View>
  );
}

/**
 * A student's dashboard: Today, their figures, their own card (next lesson, this month, a
 * celebration: UI upgrades U6), their goal, their lessons, the reflections they are asked for, their
 * progress and their tutors. No money at all: the session list is passed `hideMoney`, though the
 * server labels a student's own lessons from the family's side.
 */
export function StudentView({
  data,
  studentId,
  studentName,
}: {
  data: StudentDashboard;
  /** Whose dashboard: the reader, or the student an admin is viewing. */
  studentId: string;
  studentName: string;
}) {
  const theme = useAppTheme();
  const today = useToday({ who: 'tutor', studentIds: [studentId], horizonDays: CHILD_HORIZON_DAYS });
  return (
    <View testID="dashboard-student" style={{ gap: space.lg }}>
      <TodayCard summary={today.summary} pending={today.pending} failed={today.failed} />
      <FigureRow
        tourId="dash-my-stats"
        figures={[
          { label: 'Sessions', value: data.totals.session_count, to: '/sessions' },
          { label: 'Time tutored', value: data.totals.total_minutes, formatValue: formatDuration },
          { label: 'Tutors', value: data.tutors.length },
        ]}
      />

      {/* UI upgrades U6: their own card -- the next lesson and this month -- first. */}
      <ChildCard
        studentId={studentId}
        name={studentName}
        self
        progress={data.progress}
        next={nextLessonFor(today.lessons, studentId)}
        today={today.today}
      />

      {data.goal && !data.progress?.plan ? (
        <GoalBanner goal={data.goal} course={data.current_math_course} />
      ) : null}

      {/* Phase 25: the lessons still waiting for their reflection, near the top, because it is the
          one thing here they are asked to do. */}
      <ReflectionPrompts prompts={data.awaiting_reflection} />

      {data.progress ? (
        <StudentProgressCard progress={data.progress} title="Your progress" tourId="dash-my-progress" />
      ) : null}

      <Panel testID="student-tutors" title="Your tutors">
        {data.tutors.length === 0 ? (
          <EmptyNote>No tutors assigned yet.</EmptyNote>
        ) : (
          data.tutors.map((tutor, index) => (
            <View key={tutor.user_id}>
              {index > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                }}
              >
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  {tutor.full_name}
                </Text>
                <View
                  style={{
                    borderRadius: radius.sm,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: theme.tokens.muted,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{countOf(tutor.session_count, 'session')}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Panel>

      <Panel
        testID="student-sessions"
        tourId="dash-my-sessions"
        title="Your sessions"
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        <SessionList sessions={data.recent_sessions} showTutor hideMoney />
      </Panel>
    </View>
  );
}
