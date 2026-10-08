// Ported from apps/web/src/features/dashboard/reflections.tsx @ 1132322
import { formatClockTime, type ReflectionDigest, type ReflectionPrompt } from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { firstName } from '@/features/teaching/reflection-logic';
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

/**
 * Recent lessons still waiting for the student's reflection, each with a button that opens the
 * questions (the reflection sheet). Renders nothing when none are waiting. `forChildren` words it
 * for a parent, who reflects with each child. No money: a prompt names the lesson, nothing more.
 */
export function ReflectionPrompts({
  prompts,
  forChildren = false,
}: {
  prompts: ReflectionPrompt[];
  forChildren?: boolean;
}) {
  const theme = useAppTheme();
  if (prompts.length === 0) return null;

  return (
    <Panel
      testID="reflection-prompts"
      tourId="dash-reflect"
      title={forChildren ? 'Reflect with your children' : 'How did your lessons go?'}
      action={{ label: 'All sessions', to: '/sessions' }}
    >
      <Text
        variant="bodySmall"
        style={{ color: theme.tokens.mutedForeground, marginTop: -4, marginBottom: 4 }}
      >
        {forChildren
          ? 'A few questions about each recent lesson, answered together. Their tutor reads them.'
          : 'A few quick questions about each recent lesson. Your tutor reads them.'}
      </Text>
      {prompts.map((prompt, index) => {
        const time = formatClockTime(prompt.started_at);
        return (
          <View key={prompt.session_id}>
            {index > 0 ? <Divider /> : null}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {forChildren ? <Text style={{ fontWeight: '500' }}>{prompt.student_name} </Text> : null}
                  <Text style={forChildren ? { color: theme.tokens.mutedForeground } : { fontWeight: '500' }}>
                    {forChildren ? 'with ' : 'With '}
                    {prompt.tutor_name}
                  </Text>
                </Text>
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  {prompt.occurred_on} · {time}
                </Text>
              </View>
              <Button
                testID={`reflect-${prompt.session_id}`}
                mode="outlined"
                compact
                icon="emoticon-happy-outline"
                onPress={() =>
                  router.push({ pathname: '/reflection', params: { session: prompt.session_id } })
                }
                // The date and the time: two lessons on one day stay distinct.
                accessibilityLabel={
                  (forChildren
                    ? `Reflect with ${firstName(prompt.student_name)} on the ${prompt.occurred_on}`
                    : `Reflect on the ${prompt.occurred_on}`) + ` ${time} lesson`
                }
              >
                Reflect
              </Button>
            </View>
          </View>
        );
      })}
    </Panel>
  );
}
