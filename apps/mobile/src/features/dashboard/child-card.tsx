// A family's Home, centred on the child (UI upgrades U6): one card per child for a parent, and the
// student's own: the next lesson, this month in words with a small bar, and a coral celebration
// when a topic was mastered lately. No money: it is about the child, not the account.
import type { StudentProgress, UpcomingSession } from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useTopicIndex } from '@/features/progress/api';
import { ProgressMeter } from '@/features/progress/progress-meter';
import { PersonAvatar } from '@/features/users/person-avatar';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { markCelebrated, readCelebrated } from './celebrations';
import { useOrgClock } from './home-data';
import {
  celebrationKey,
  celebrationLine,
  childNextLine,
  firstName,
  monthProgress,
  recentlyMastered,
} from './home-model';

/**
 * The topics to celebrate now: mastered lately and not yet celebrated on this phone. Each is
 * remembered as it is shown, and stays on screen while Home is open; the next visit has none.
 */
function useCelebration(studentId: string, progress: StudentProgress | null | undefined, today: string) {
  const fresh = useMemo(() => recentlyMastered(progress, today), [progress, today]);
  const freshKey = fresh.join(',');
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => {
    if (!freshKey) return;
    let live = true;
    const topics = freshKey.split(',');
    void readCelebrated().then((list) => {
      const unseen = topics.filter((topic) => !list.includes(celebrationKey(studentId, topic)));
      if (!live || unseen.length === 0) return;
      setShown((current) => [...current, ...unseen.filter((topic) => !current.includes(topic))]);
      void markCelebrated(unseen.map((topic) => celebrationKey(studentId, topic)));
    });
    return () => {
      live = false;
    };
  }, [freshKey, studentId]);
  return { shown, dismiss: () => setShown([]) };
}

/** The small coral moment: a bounce in, a success tap, and a close. Still under reduce motion. */
function Celebration({ testID, text, onClose }: { testID: string; text: string; onClose: () => void }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  useEffect(() => {
    haptics.success();
  }, []);
  const coral = theme.tokens.celebrate;
  return (
    <Animated.View
      testID={testID}
      entering={reduced ? undefined : ZoomIn.springify().damping(14)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        marginHorizontal: space.md,
        marginTop: space.md,
        paddingLeft: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: withAlpha(coral, 0.55),
        backgroundColor: withAlpha(coral, 0.14),
      }}
    >
      <Icon source="party-popper" size={22} color={coral} />
      <Text
        testID={`${testID}-text`}
        accessibilityLiveRegion="polite"
        variant="bodyMedium"
        style={{ flex: 1, minWidth: 0, fontWeight: '600', paddingVertical: space.sm }}
      >
        {text}
      </Text>
      <IconButton
        testID={`${testID}-close`}
        icon="close"
        size={18}
        iconColor={theme.colors.onSurfaceVariant}
        accessibilityLabel="Close the celebration"
        onPress={() => {
          haptics.selection();
          onClose();
        }}
      />
    </Animated.View>
  );
}

function Row({ icon, testID, children }: { icon: string; testID: string; children: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
      <View style={{ paddingTop: 2 }}>
        <Icon source={icon} size={16} color={theme.tokens.mutedForeground} />
      </View>
      <Text testID={testID} variant="bodyMedium" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * One child (or the student themselves, `self`). `upcoming` is the next lesson of theirs that is
 * not called off, from Home's two-week read of the schedules (null when there is none).
 */
export function ChildCard({
  studentId,
  name,
  self = false,
  progress,
  next,
  today,
}: {
  studentId: string;
  name: string;
  self?: boolean;
  progress: StudentProgress | null | undefined;
  next: UpcomingSession | null;
  today: string;
}) {
  const theme = useAppTheme();
  const { topics } = useTopicIndex();
  const month = monthProgress(progress, today);
  const celebration = useCelebration(studentId, progress, today);
  const id = `home-child-${studentId}`;
  const who = self ? 'You' : firstName(name);
  const clock = useOrgClock();
  const nextLine = childNextLine(next, today, clock.minutesOfDay);

  return (
    <OutlinedCard testID={id} style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
      {celebration.shown.length > 0 ? (
        <Celebration
          testID={`home-celebration-${studentId}`}
          text={celebrationLine(
            who,
            celebration.shown.map((topic) => topics.get(topic)?.name ?? topic),
          )}
          onClose={celebration.dismiss}
        />
      ) : null}
      <Pressable
        testID={`${id}-open`}
        accessibilityRole="link"
        accessibilityLabel={`${self ? 'Your' : `${name}'s`} progress. ${nextLine}. ${month.lessonsLine}. ${month.planLine}.`}
        onPress={() => router.push({ pathname: '/progress/[studentId]', params: { studentId } })}
        style={({ pressed }) => ({ padding: space.lg, gap: space.md, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PersonAvatar name={name} size={36} />
          <Text variant="titleMedium" numberOfLines={1} style={{ flex: 1, minWidth: 0, fontWeight: '700' }}>
            {self ? 'Your lessons' : name}
          </Text>
          <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
        </View>
        <Row icon="calendar-clock" testID={`${id}-next`}>
          {nextLine}
        </Row>
        <View style={{ gap: space.sm }}>
          <Row icon="chart-line" testID={`${id}-month`}>
            {month.lessonsLine}
          </Row>
          {month.measured ? (
            <ProgressMeter testID={`${id}-bar`} percent={month.percent} expected={month.expected} />
          ) : null}
          <Text testID={`${id}-plan`} variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {month.planLine}
          </Text>
        </View>
      </Pressable>
    </OutlinedCard>
  );
}
