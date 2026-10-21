// Ported from apps/web/src/features/quest/quest-welcome.tsx @ 22ea393 (working tree): the welcome when
// a student opens Quest (owner, 2026-10-21) -- confetti, a card with their name, a few numbers and one
// line to bring them back. It closes itself after QUEST_WELCOME_MS, with a thin bar shrinking for that
// time, or on a tap anywhere or Close. Mobile: drawn over Quest's whole frame (a Portal into the frame's
// own host), the confetti is Home's (Reanimated); the stats add Today, and the streak reads "🔥 N days".
// Under reduce motion: no confetti, no shrinking bar, and it still closes by itself.
import { QUEST_WELCOME_MS, type QuestSummary } from '@tmi/shared';
import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '@/components/icon-button';
import { Confetti } from '@/features/home/confetti';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { welcomeContent } from './quest-welcome-model';

export function QuestWelcome({ summary, onClose }: { summary: QuestSummary; onClose: () => void }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const content = useMemo(() => welcomeContent(summary), [summary]);
  const remaining = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(onClose, QUEST_WELCOME_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(content.title);
  }, [content.title]);

  useEffect(() => {
    if (reduced) return;
    remaining.value = withTiming(0, { duration: QUEST_WELCOME_MS, easing: Easing.linear });
  }, [reduced, remaining]);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: remaining.value }] }));

  return (
    <Pressable
      testID="quest-welcome"
      // Not one accessible element: its title, numbers and Close are read and reached one by one.
      accessible={false}
      accessibilityViewIsModal
      onPress={onClose}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.colors.backdrop,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.lg,
        },
      ]}
    >
      <Confetti seed={11} fall={height + 40} />
      <Animated.View
        entering={reduced ? undefined : ZoomIn.springify().damping(15)}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: radius.xl,
          padding: space.xl,
          gap: space.md,
          overflow: 'hidden',
          backgroundColor: theme.tokens.card,
        }}
      >
        <IconButton
          testID="quest-welcome-close"
          icon="close"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: space.xs, right: space.xs, zIndex: 1 }}
        />
        <Text style={{ fontSize: 40 }} accessibilityElementsHidden importantForAccessibility="no">
          🎉
        </Text>
        <Text
          testID="quest-welcome-title"
          variant="titleLarge"
          accessibilityRole="header"
          style={{ fontWeight: '700', color: theme.tokens.cardForeground, paddingRight: space.xl }}
        >
          {content.title}
        </Text>
        {content.streak ? (
          <Text
            testID="quest-welcome-streak"
            variant="titleSmall"
            style={{ color: theme.colors.primary, fontWeight: '700' }}
          >
            {content.streak}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {content.stats.map((stat) => (
            <View
              key={stat.key}
              testID={`quest-welcome-${stat.key}`}
              accessible
              accessibilityLabel={`${stat.label}: ${stat.value}`}
              style={{
                flexGrow: 1,
                flexBasis: '30%',
                minWidth: 88,
                borderRadius: radius.md,
                paddingVertical: space.sm,
                paddingHorizontal: space.xs,
                alignItems: 'center',
                backgroundColor: theme.tokens.muted,
              }}
            >
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={{ color: theme.tokens.mutedForeground, textAlign: 'center' }}
              >
                {stat.label}
              </Text>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.tokens.foreground, fontVariant: ['tabular-nums'] }}
              >
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
        <Text testID="quest-welcome-line" variant="bodyMedium" style={{ color: theme.tokens.cardForeground }}>
          {content.line}
        </Text>
        {reduced ? null : (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: 4,
              borderRadius: radius.pill,
              overflow: 'hidden',
              backgroundColor: theme.tokens.muted,
            }}
          >
            <Animated.View
              style={[
                {
                  height: '100%',
                  width: '100%',
                  backgroundColor: theme.colors.primary,
                  transformOrigin: 'left',
                },
                bar,
              ]}
            />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
