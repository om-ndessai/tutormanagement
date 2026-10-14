// Ported from apps/web/src/features/locations/lesson-reminder.tsx @ 2933e3f (Phase 33, working tree).
//
// The in-app reminder. When a lesson the reader is part of starts within the reminder its locations
// ask for, a sheet rises from the bottom of Home with when and where. Dismissing it is remembered
// per lesson date on this phone, so next week reminds again. In-app UI only -- not a notification --
// so it may name the people; it never carries money.
import {
  LOCATION_KIND_LABELS,
  formatTimeRange,
  parseClockTime,
  reminderKey,
  type UpcomingSession,
} from '@tmi/shared';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Icon, Portal, Surface, Text } from 'react-native-paper';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { useLiveBannerInset } from '@/components/live-banner-inset';
import { useUpcomingSessions } from '@/features/schedules/api';
import { bannerBottom } from '@/features/teaching/live-session';
import { haptics } from '@/lib/haptics';
import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import {
  REMINDER_TICK_MS,
  isLink,
  parseDismissed,
  pickReminder,
  reminderTitle,
  withDismissed,
} from './reminder-model';

/**
 * Mounted by Home while the reader looks at their own dashboard. Floats above the tab bar (and the
 * live lesson banner) while Home is the screen in front; it does not block the dashboard.
 */
export function LessonReminderSheet() {
  const { user } = useAuth();
  const timeZone = useOrgTimeZone();
  const focused = useIsFocused();
  const upcoming = useUpcomingSessions();
  const [now, setNow] = useState(() => new Date().toISOString());
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  // The dismissed dates, read once from the phone; until then nothing shows, so a dismissed
  // reminder never flashes up on opening the app.
  useEffect(() => {
    let live = true;
    void readPref(STORAGE_KEYS.remindersDismissed).then((raw) => {
      if (live) setDismissed(parseDismissed(raw));
    });
    return () => {
      live = false;
    };
  }, []);

  // The window opens while Home sits open, so the clock is re-read every 30 seconds.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), REMINDER_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const due = useMemo(
    () =>
      dismissed === null
        ? null
        : pickReminder(
            upcoming.data?.pages.flatMap((page) => page.data) ?? [],
            user,
            dismissed,
            now,
            timeZone,
          ),
    [upcoming.data, user, dismissed, now, timeZone],
  );

  if (!due || !focused || dismissed === null) return null;
  const dismiss = () => {
    haptics.selection();
    const next = withDismissed(dismissed, reminderKey(due.lesson));
    setDismissed(next);
    void writePref(STORAGE_KEYS.remindersDismissed, JSON.stringify(next));
  };

  return (
    <Portal>
      <ReminderSheetFrame>
        <LessonReminder lesson={due.lesson} minutes={due.minutes} onDismiss={dismiss} />
      </ReminderSheetFrame>
    </Portal>
  );
}

/** Where the sheet sits: across the bottom, clear of the tab bar and the live lesson banner. */
function ReminderSheetFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const liveInset = useLiveBannerInset();
  const reduced = useReducedMotion();
  const bottom = bannerBottom(Platform.OS === 'ios' ? 'ios' : 'android', insets.bottom, true) + liveInset;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(250)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: space.md, right: space.md, bottom }}
    >
      {children}
    </Animated.View>
  );
}

/** The sheet's content: when, who, and each place with its address or link. */
export function LessonReminder({
  lesson,
  minutes,
  onDismiss,
}: {
  lesson: UpcomingSession;
  minutes: number;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const start = parseClockTime(lesson.start_time) ?? 0;
  const announced = useRef(false);

  // One light cue as it rises, not on every 30-second re-check.
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    haptics.impact();
  }, []);

  return (
    <Surface
      testID="lesson-reminder"
      elevation={3}
      accessibilityRole="alert"
      style={{
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.md,
        backgroundColor: theme.colors.elevation.level3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
          }}
        >
          <Icon source="bell-outline" size={18} color={theme.colors.onPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="titleMedium">{reminderTitle(minutes)}</Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            {formatTimeRange(start, start + lesson.duration_minutes)} · {lesson.tutor_name} with{' '}
            {lesson.student_name}
          </Text>
        </View>
        <IconButton
          testID="lesson-reminder-dismiss"
          icon="close"
          size={20}
          accessibilityLabel="Dismiss reminder"
          onPress={onDismiss}
        />
      </View>
      {lesson.locations.map((place) => {
        const link = isLink(place.address) ? place.address : null;
        return (
          <View key={place.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <View style={{ paddingTop: 2 }}>
              <Icon
                source={place.kind === 'virtual' ? 'web' : 'map-marker-outline'}
                size={16}
                color={muted}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {place.name}
                <Text variant="bodySmall" style={{ color: muted, fontWeight: 'normal' }}>
                  {'  '}
                  {LOCATION_KIND_LABELS[place.kind]}
                </Text>
              </Text>
              {link ? (
                <Pressable
                  testID={`lesson-reminder-link-${place.id}`}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${place.name}`}
                  hitSlop={8}
                  onPress={() => void Linking.openURL(link).catch(() => undefined)}
                >
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
                  >
                    {link}
                  </Text>
                </Pressable>
              ) : place.address ? (
                <Text variant="bodySmall" style={{ color: muted }}>
                  {place.address}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </Surface>
  );
}
