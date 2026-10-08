// Ported from apps/web/src/features/dashboard/reflections.tsx @ 1132322 (RecentReflections;
// the student's and parent's prompts arrive with feature 15)
import type { ReflectionDigest } from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { EmptyNote } from '@/components/section';
import { ReflectionChips, ReflectionFlags } from '@/features/teaching/reflection-chips';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/**
 * What the tutor's students made of recent lessons, newest first, with where each one missed
 * ("Too fast", "Little new") -- so the next lesson can adjust. No money: it is read on the
 * Tutoring tab.
 */
export function RecentReflections({ digests }: { digests: ReflectionDigest[] }) {
  const theme = useAppTheme();
  if (digests.length === 0) {
    return (
      <EmptyNote testID="reflections-empty">
        No reflections yet. A student, their parent or you can add one from a lesson on the sessions page.
      </EmptyNote>
    );
  }

  return (
    <View>
      {digests.map(({ session_id, occurred_on, student_name, reflection }, index) => (
        <View key={session_id}>
          {index > 0 ? <Divider /> : null}
          <Pressable
            testID={`reflection-${session_id}`}
            accessibilityRole="link"
            accessibilityLabel={`${student_name}'s reflection on the ${occurred_on} lesson`}
            onPress={() => router.navigate(`/sessions?focus=${session_id}`)}
            style={({ pressed }) => ({ paddingVertical: space.md, gap: 6, opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: space.sm,
                rowGap: 4,
              }}
            >
              <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                {student_name}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                {occurred_on}
              </Text>
              <ReflectionFlags reflection={reflection} />
            </View>
            <ReflectionChips reflection={reflection} />
            {reflection.homework_notes || reflection.comment ? (
              <Text numberOfLines={2} variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                {[reflection.homework_notes, reflection.comment].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Pressable>
        </View>
      ))}
    </View>
  );
}
