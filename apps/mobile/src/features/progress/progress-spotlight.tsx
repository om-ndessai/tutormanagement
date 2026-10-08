// Ported from apps/web/src/features/progress/progress-spotlight.tsx @ 1132322
import type { StudentProgress } from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { EmptyNote } from '@/components/section';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { ProgressChart } from './progress-chart';
import { ProgressStatusBadge } from './rating';

/**
 * The dashboard's Progress section (Phase 21): a handful of students, each a small card with the
 * compressed goal timeline. A card opens the Progress tab, where the full chart will be (24).
 */
export function ProgressSpotlight({ students, empty }: { students: StudentProgress[]; empty: string }) {
  if (students.length === 0) return <EmptyNote testID="progress-spotlight-empty">{empty}</EmptyNote>;

  return (
    <View style={{ gap: space.md }}>
      {students.map((progress) => (
        <ProgressSpotlightCard key={progress.student.user_id} progress={progress} />
      ))}
    </View>
  );
}

function ProgressSpotlightCard({ progress }: { progress: StudentProgress }) {
  const theme = useAppTheme();
  const { plan, summary, student } = progress;

  return (
    <Pressable
      testID="progress-spotlight-card"
      accessibilityRole="link"
      accessibilityLabel={`${student.full_name}'s progress`}
      onPress={() => router.navigate('/progress')}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: space.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: space.sm,
            }}
          >
            <Text numberOfLines={1} variant="bodyMedium" style={{ flexShrink: 1, fontWeight: '500' }}>
              {student.full_name}
            </Text>
            <ProgressStatusBadge status={summary.status} />
          </View>
          <Text
            numberOfLines={1}
            variant="bodySmall"
            style={{ marginTop: 2, color: theme.tokens.mutedForeground }}
          >
            {plan
              ? `${summary.mastered_count} of ${summary.topic_count} topics · ${summary.percent}%`
              : 'No learning plan yet'}
          </Text>
          <View style={{ marginTop: space.sm }}>
            {plan ? (
              <ProgressChart
                plan={plan}
                summary={summary}
                timeline={progress.timeline}
                today={progress.today}
                cancellations={progress.cancellations}
              />
            ) : (
              <View style={{ height: 64, borderRadius: radius.md, backgroundColor: theme.tokens.muted }} />
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
