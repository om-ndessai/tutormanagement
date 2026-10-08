// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (ProgressSection).
import { GOAL_RATING_LABELS, type Rating } from '@tmi/shared';
import { View } from 'react-native';
import { Divider, HelperText, Text } from 'react-native-paper';

import { useStudentProgress, useTopicIndex } from '@/features/progress/api';
import { RatingPicker, TopicName } from '@/features/progress/rating';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { FormSection } from './form-section';

/**
 * How the lesson went against the student's learning plan: one score for the step it took towards
 * the goal, and one per plan topic worked on. Every score is optional -- rate what was covered and
 * leave the rest.
 */
export function ProgressSection({
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
  topicRatings: Record<string, Rating>;
  onTopicRatings: (value: Record<string, Rating>) => void;
  error?: string;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const { data, isPending } = useStudentProgress(studentId);
  const { topics } = useTopicIndex();
  const progress = data?.data;
  const plan = progress?.plan;

  if (isPending) return null;

  if (!plan) {
    return (
      <Text
        testID="record-progress"
        variant="bodySmall"
        style={{
          color: muted,
          backgroundColor: theme.tokens.muted,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          paddingVertical: 10,
        }}
      >
        No learning plan yet, so there is nothing to score this lesson against.
      </Text>
    );
  }

  // Plan topics first, in teaching order; then anything scored before that has since left the
  // plan, so an edit never silently drops a score.
  const current = new Map((progress.topics ?? []).map((row) => [row.topic_id, row.current]));
  const ids = [...plan.topic_ids, ...Object.keys(topicRatings).filter((id) => !plan.topic_ids.includes(id))];

  function set(topicId: string, value: Rating | null) {
    const next = { ...topicRatings };
    if (value === null) delete next[topicId];
    else next[topicId] = value;
    onTopicRatings(next);
  }

  return (
    <FormSection testID="record-progress" title="Progress towards the goal" description={plan.goal}>
      <View style={{ gap: 6 }}>
        <Text variant="bodyMedium">How far did this lesson move them?</Text>
        <RatingPicker
          testID="record-goal"
          name="Progress towards the goal"
          value={goalRating}
          onChange={onGoalRating}
          labels={GOAL_RATING_LABELS}
        />
        {goalRating ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            {GOAL_RATING_LABELS[goalRating]}
          </Text>
        ) : null}
      </View>

      {ids.length > 0 ? (
        <View style={{ gap: space.xs }}>
          <Text variant="bodySmall" style={{ color: muted }}>
            Where they stand on each topic you covered, 1 (needs help) to 5 (mastered):
          </Text>
          {ids.map((id, index) => {
            const topic = topics.get(id);
            const before = current.get(id);
            return (
              <View key={id}>
                {index > 0 ? <Divider /> : null}
                <View style={{ gap: 6, paddingVertical: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <TopicName id={id} name={topic?.name} />
                    {before != null ? (
                      <Text variant="bodySmall" style={{ color: muted }}>
                        latest {before}
                      </Text>
                    ) : null}
                  </View>
                  <RatingPicker
                    testID={`record-topic-${id}`}
                    name={`${id} ${topic?.name ?? ''}`}
                    value={topicRatings[id] ?? null}
                    onChange={(value) => set(id, value)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </FormSection>
  );
}
