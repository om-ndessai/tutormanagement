// Ported from apps/web/src/features/progress/student-progress-page.tsx @ 1132322.
//
// One student's arc: the assessment they started from, the plan agreed for them, and how every
// lesson since has moved them along it. Readable by whoever the server lets follow the student; the
// writes (assess, plan, delete) are the office's.
import {
  GOAL_RATING_LABELS,
  PLAN_STATUS_LABELS,
  formatCadence,
  type Assessment,
  type LearningPlan,
  type Rating,
  type StudentProgress,
} from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Divider, Icon, IconButton, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { EmptyNote, Panel } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ErrorState } from '@/components/state-views';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useStudentProgress, useTopicIndex } from './api';
import { AssessmentPanel } from './assessment-panel';
import { LessonList } from './lesson-list';
import { ProgressChart } from './progress-chart';
import { ProgressMeter } from './progress-meter';
import { longDate } from './progress-model';
import { ProgressStatusBadge, RatingChip, RatingLegend, TopicName } from './rating';
import { useConfirmDelete } from './use-confirm-delete';

export function StudentProgressScreen({ studentId }: { studentId: string }) {
  const { data, isPending, error, refetch } = useStudentProgress(studentId);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-progress-student" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading progress"
          accessibilityState={{ busy: true }}
        >
          <Skeleton width="100%" height={110} style={{ borderRadius: radius.lg }} />
          <Skeleton width="100%" height={260} style={{ borderRadius: radius.lg }} />
        </View>
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <StudentProgressView progress={data.data} />
      )}
    </Screen>
  );
}

export function StudentProgressView({ progress }: { progress: StudentProgress }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const { levels, topics } = useTopicIndex();
  const confirmDelete = useConfirmDelete();

  const { plan, summary, student } = progress;
  const latest = progress.assessments[0] ?? null;
  const levelName = (id: string | null) => levels.find((level) => level.id === id)?.name ?? id;
  const studentParam = { student: student.user_id };

  const assess = (existing: Assessment | null) =>
    router.push({
      pathname: '/assessment-form',
      params: existing ? { ...studentParam, id: existing.id } : studentParam,
    });
  const editPlan = (existing: LearningPlan | null) =>
    router.push({
      pathname: '/plan-form',
      params: existing ? { ...studentParam, id: existing.id } : studentParam,
    });

  return (
    <>
      <Stack.Screen options={{ title: student.full_name }} />
      <View style={{ gap: space.sm }}>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {student.current_math_course
            ? `Currently: ${student.current_math_course}`
            : 'Assessment, learning plan and progress.'}
        </Text>
        {isAdmin ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
            <Button
              testID="progress-assess"
              mode="outlined"
              icon="clipboard-check-outline"
              onPress={() => assess(null)}
            >
              {latest ? 'Reassess' : 'Assess'}
            </Button>
            {plan ? (
              <Button
                testID="progress-plan-edit"
                mode="contained"
                icon="pencil-outline"
                onPress={() => editPlan(plan)}
              >
                Edit plan
              </Button>
            ) : (
              <Button
                testID="progress-plan-create"
                mode="contained"
                icon="plus"
                onPress={() => editPlan(null)}
              >
                Create plan
              </Button>
            )}
          </View>
        ) : null}
      </View>

      {plan ? (
        <>
          {/* The goal leads: it is what every figure below is measured against. */}
          <Card
            testID="progress-goal"
            mode="contained"
            style={{ borderRadius: radius.lg, backgroundColor: theme.colors.primary }}
            contentStyle={{ padding: 0 }}
          >
            <View style={{ padding: space.lg, gap: space.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: space.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon source="flag-outline" size={16} color={theme.colors.onPrimary} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: theme.colors.onPrimary,
                      opacity: 0.85,
                    }}
                  >
                    Goal
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.tokens.card, borderRadius: radius.sm }}>
                  <ProgressStatusBadge status={summary.status} />
                </View>
              </View>
              <Text variant="titleLarge" style={{ color: theme.colors.onPrimary, fontWeight: '600' }}>
                {plan.goal}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimary, opacity: 0.9 }}>
                {longDate(plan.starts_on)} → {longDate(plan.target_on)} ·{' '}
                {formatCadence(plan.sessions_per_week, plan.session_minutes)}
                {plan.target_level_id ? ` · towards ${levelName(plan.target_level_id)}` : ''}
              </Text>
            </View>
          </Card>

          <StatGrid>
            {[
              <StatCard
                key="mastered"
                label="Topics mastered"
                value={summary.mastered_count}
                icon="check"
                hint={`of ${summary.topic_count} in the plan · ${summary.percent}%`}
              />,
              <StatCard
                key="expected"
                label="Expected by today"
                value={summary.expected_percent}
                formatValue={(value) => `${value}%`}
                icon="flag-outline"
                tone={summary.status === 'behind' ? 'warning' : 'default'}
                hint={`On a straight line to ${longDate(plan.target_on)}`}
              />,
              <StatCard
                key="held"
                label="Sessions held"
                value={summary.sessions_held}
                icon="clipboard-check-outline"
                hint={
                  // Planned is already net of cancellations (Phase 24): a vacation week is not a
                  // missed lesson.
                  `${summary.sessions_planned_to_date} planned so far` +
                  (summary.sessions_cancelled_to_date > 0
                    ? ` · ${summary.sessions_cancelled_to_date} cancelled`
                    : '')
                }
              />,
              <StatCard
                key="recent"
                label="Recent lessons"
                value={summary.recent_goal_rating ?? undefined}
                formatValue={(value) => value.toFixed(1)}
                icon="pencil-outline"
                animate={false}
                hint={
                  summary.recent_goal_rating === null
                    ? 'Not scored yet'
                    : `${GOAL_RATING_LABELS[Math.round(summary.recent_goal_rating) as Rating]} (of 5)`
                }
              />,
            ]}
          </StatGrid>

          <Panel testID="progress-timeline" title="Timeline towards the goal">
            <ProgressChart
              variant="full"
              plan={plan}
              summary={summary}
              timeline={progress.timeline}
              today={progress.today}
              cancellations={progress.cancellations}
            />
          </Panel>

          <Panel testID="progress-plan-topics" title="Plan topics">
            {plan.topic_ids.length === 0 ? (
              <EmptyNote>This plan names no topics; lessons are scored against the goal alone.</EmptyNote>
            ) : (
              <>
                {progress.topics.map((row, index) => {
                  const topic = topics.get(row.topic_id);
                  return (
                    <View key={row.topic_id}>
                      {index > 0 ? <Divider /> : null}
                      <View
                        testID={`progress-topic-${row.topic_id}`}
                        style={{ paddingVertical: space.sm, gap: 6 }}
                      >
                        <TopicName id={row.topic_id} name={topic?.name} unit={topic?.unit} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <RatingChip rating={row.baseline} size={22} />
                          <Text
                            style={{ color: muted }}
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                          >
                            →
                          </Text>
                          <RatingChip rating={row.current} size={22} />
                          <View style={{ flex: 1 }} />
                          {row.mastered ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Icon source="check" size={14} color={theme.tokens.success} />
                              <Text variant="labelMedium" style={{ color: theme.tokens.success }}>
                                Mastered
                              </Text>
                            </View>
                          ) : (
                            <Text variant="bodySmall" style={{ color: muted }}>
                              {row.last_rated_on ? longDate(row.last_rated_on) : 'Not yet'}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
                <Divider style={{ marginVertical: space.sm }} />
                <RatingLegend />
              </>
            )}
          </Panel>

          <Panel testID="progress-recommendation" title="Recommendation">
            <ProgressMeter
              percent={summary.percent}
              expected={summary.expected_percent}
              style={{ marginBottom: space.md }}
            />
            {plan.recommendation ? (
              <Text variant="bodyMedium">{plan.recommendation}</Text>
            ) : (
              <Text variant="bodyMedium" style={{ color: muted }}>
                No notes on the course of tutoring.
              </Text>
            )}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: space.sm }}
            >
              <Text variant="bodySmall" style={{ color: muted }}>
                Set by {plan.created_by_name ?? 'the office'}
              </Text>
              {isAdmin ? (
                <Button
                  testID="progress-delete-plan"
                  mode="text"
                  compact
                  textColor={theme.colors.error}
                  onPress={() => confirmDelete({ kind: 'plan', row: plan })}
                >
                  Delete plan
                </Button>
              ) : null}
            </View>
          </Panel>
        </>
      ) : (
        <Panel testID="progress-no-plan" title="Learning plan">
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
        topicName={(id) => topics.get(id)?.name}
        onEdit={(row) => assess(row)}
        onDelete={(row) => confirmDelete({ kind: 'assessment', row })}
      />

      {progress.timeline.length > 0 || progress.cancellations.length > 0 ? (
        <Panel testID="progress-lessons" title="Lessons in this plan">
          <LessonList
            timeline={progress.timeline}
            cancellations={progress.cancellations}
            today={progress.today}
          />
        </Panel>
      ) : null}

      {progress.past_plans.length > 0 ? (
        <Panel testID="progress-past-plans" title="Earlier plans">
          {progress.past_plans.map((past, index) => (
            <View key={past.id}>
              {index > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingVertical: space.sm,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                    {past.goal}
                  </Text>
                  <Text variant="bodySmall" style={{ color: muted }}>
                    {longDate(past.starts_on)} → {longDate(past.target_on)} · {past.topic_ids.length} topics ·{' '}
                    {PLAN_STATUS_LABELS[past.status]}
                  </Text>
                </View>
                {isAdmin ? (
                  <IconButton
                    testID={`progress-past-plan-edit-${past.id}`}
                    icon="pencil-outline"
                    accessibilityLabel="Edit this plan"
                    onPress={() => editPlan(past)}
                    style={{ margin: 0 }}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </Panel>
      ) : null}
    </>
  );
}
