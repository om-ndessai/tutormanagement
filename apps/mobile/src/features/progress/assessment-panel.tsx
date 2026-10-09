// Ported from apps/web/src/features/progress/student-progress-page.tsx (AssessmentPanel) @ 1132322
import type { Assessment } from '@tmi/shared';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Divider, IconButton, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { longDate } from './progress-model';
import { RatingChip, TopicName } from './rating';

/** The latest assessment in full, with any earlier ones a tap away beneath it. */
export function AssessmentPanel({
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
  topicName: (id: string) => string | undefined;
  onEdit: (row: Assessment) => void;
  onDelete: (row: Assessment) => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const [shownId, setShownId] = useState<string | null>(null);
  // A deleted or replaced one falls back to the latest.
  const current = assessments.find((row) => row.id === shownId) ?? assessments[0];

  if (!current) {
    return (
      <Panel testID="progress-assessment" title="Assessment">
        <EmptyNote>No assessment recorded yet.</EmptyNote>
      </Panel>
    );
  }

  const latest = current.id === assessments[0]?.id;
  return (
    <Panel testID="progress-assessment" title={latest ? 'Latest assessment' : 'Earlier assessment'}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: -space.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="labelLarge">
            {longDate(current.assessed_on)}
            {current.assessor_name ? (
              <Text style={{ color: muted }}> · by {current.assessor_name}</Text>
            ) : null}
          </Text>
          {current.recommended_level_id ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              Recommended: {levelName(current.recommended_level_id)}
            </Text>
          ) : null}
          {current.school_course ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              Enrolled in {current.school_course}
            </Text>
          ) : null}
        </View>
        {isAdmin ? (
          <View style={{ flexDirection: 'row', marginRight: -space.sm }}>
            <IconButton
              testID="progress-assessment-edit"
              icon="pencil-outline"
              accessibilityLabel="Edit assessment"
              onPress={() => onEdit(current)}
              style={{ margin: 0 }}
            />
            <IconButton
              testID="progress-assessment-delete"
              icon="trash-can-outline"
              accessibilityLabel="Delete assessment"
              onPress={() => onDelete(current)}
              style={{ margin: 0 }}
            />
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: space.md, gap: space.md }}>
        {current.summary ? (
          <Text testID="progress-assessment-summary" variant="bodyMedium">
            {current.summary}
          </Text>
        ) : (
          <Text variant="bodyMedium" style={{ color: muted }}>
            No written summary.
          </Text>
        )}

        {current.ratings.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: muted }}>
            No topics rated.
          </Text>
        ) : (
          <View style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: radius.md }}>
            {[...current.ratings]
              .sort((a, b) => a.rating - b.rating || a.topic_id.localeCompare(b.topic_id))
              .map((row, index) => (
                <View key={row.topic_id}>
                  {index > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingHorizontal: space.md,
                      paddingVertical: 6,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <TopicName id={row.topic_id} name={topicName(row.topic_id)} />
                    </View>
                    <RatingChip rating={row.rating} />
                  </View>
                </View>
              ))}
          </View>
        )}
      </View>

      {assessments.length > 1 ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Text variant="bodySmall" style={{ color: muted }}>
            All assessments
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            {assessments.map((row) => {
              const selected = row.id === current.id;
              return (
                <Chip
                  key={row.id}
                  testID={`progress-assessment-pick-${row.id}`}
                  selected={selected}
                  showSelectedCheck={false}
                  mode={selected ? 'flat' : 'outlined'}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    haptics.selection();
                    setShownId(row.id);
                  }}
                >
                  {longDate(row.assessed_on)}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </Panel>
  );
}
