// Ported from apps/web/src/features/teaching/live-session-bar.tsx @ 1132322 (LiveSessionBar,
// Stopwatch, CancelDialog). The web's sticky bar under the header becomes a floating pill above
// the tab bar -- the one custom glass surface the app allows (docs/mobile/immersive-design.md).
import { SESSION_MODE_LABELS, elapsedSince, formatStopwatch, type ActiveSession } from '@tmi/shared';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { router, useSegments } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Alert, Platform, View } from 'react-native';
import { Button, IconButton, Surface, Text } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveBannerInsetContext } from '@/components/live-banner-inset';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useActiveSession, useCancelActiveSession } from './api';
import { BANNER_GAP, bannerBottom, liveTimes } from './live-session';

/** The banner's height: two lines and a 44pt button row. */
export const BANNER_HEIGHT = 64;

/** The `(org)` routes presented as sheets: the banner steps aside while one is up. */
const SHEET_ROUTES = new Set([
  'account',
  'reflection',
  'record-session',
  'view-as',
  'start-lesson',
  'stop-lesson',
  'assess-session',
]);

/** Ticks once a second, driven off the server's start instant rather than a local one. */
export function useStopwatch(startedAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt ? elapsedSince(startedAt, new Date(now)) : 0;
}

/** Where the banner goes, and whether it shows at all on the screen in front. */
function usePlacement(active: ActiveSession | null) {
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const route = segments[1] ?? '';
  const visible = Boolean(active) && !SHEET_ROUTES.has(route);
  const onTab = route === '(tabs)';
  return {
    visible,
    bottom: bannerBottom(Platform.OS === 'ios' ? 'ios' : 'android', insets.bottom, onTab),
  };
}

/**
 * Mounted once by the `(org)` layout around its Stack: provides the room the banner takes (for
 * `Screen` and the lists to pad by) and floats the banner over every screen while the reader has
 * a lesson running, so it cannot be forgotten about on another screen.
 */
export function LiveSessionHost({ children }: { children: ReactNode }) {
  const { data, refetch } = useActiveSession();
  const active = data?.data.mine ?? null;
  const { visible, bottom } = usePlacement(active);

  // The server closes a lesson at its limit on the next read; read at that instant so an
  // auto-stopped lesson leaves the screen when it stops, not at the next 30 s poll.
  const autoStopAt = active?.auto_stop_at;
  useEffect(() => {
    if (!autoStopAt) return;
    const wait = new Date(autoStopAt).getTime() - Date.now() + 1000;
    if (!Number.isFinite(wait) || wait > 2 ** 31 - 1) return;
    const timer = setTimeout(() => void refetch(), Math.max(wait, 1000));
    return () => clearTimeout(timer);
  }, [autoStopAt, refetch]);

  return (
    <LiveBannerInsetContext value={visible ? BANNER_HEIGHT + BANNER_GAP : 0}>
      <View style={{ flex: 1 }}>
        {children}
        {visible && active ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: space.lg, right: space.lg, bottom }}
          >
            <LiveSessionBanner active={active} />
          </View>
        ) : null}
      </View>
    </LiveBannerInsetContext>
  );
}

/** Glass where the system offers it and the reader has not asked for less transparency. */
function useGlass(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => subscription.remove();
  }, []);
  return useMemo(
    () => Platform.OS === 'ios' && !reduceTransparency && isGlassEffectAPIAvailable(),
    [reduceTransparency],
  );
}

export function LiveSessionBanner({ active }: { active: ActiveSession }) {
  const theme = useAppTheme();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const glass = useGlass();
  const cancel = useCancelActiveSession();
  const { from, endsBy } = liveTimes(active, timeZone);
  const muted = theme.tokens.mutedForeground;

  function confirmCancel() {
    haptics.warning();
    Alert.alert(
      'Discard this session?',
      'The timer stops and nothing is recorded or billed. Use this if it was started by mistake.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            cancel.mutate(undefined, {
              onSuccess: () => toast.success('Session discarded.'),
              onError: (error) =>
                toast.error(
                  error instanceof ApiRequestError ? error.message : 'Could not discard the session.',
                ),
            }),
        },
      ],
    );
  }

  const content = (
    <View
      style={{
        minHeight: BANNER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingLeft: space.lg,
        paddingRight: space.xs,
        paddingVertical: space.xs,
      }}
    >
      <Pulse />
      {/* Not one accessible element: a screen reader (and a flow) reads each line. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <Stopwatch startedAt={active.started_at} />
          <Text
            testID="live-student"
            variant="bodyMedium"
            numberOfLines={1}
            style={{ flexShrink: 1, fontWeight: '600' }}
          >
            {active.student_name}
            <Text style={{ color: muted, fontWeight: '400' }}> · {SESSION_MODE_LABELS[active.mode]}</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Text testID="live-from" variant="bodySmall" style={{ color: muted }} numberOfLines={1}>
            from {from} ·
          </Text>
          {/* The limit is the tutor's safety net, so it should not be a surprise when it fires. */}
          <Text testID="live-ends-by" variant="bodySmall" style={{ color: muted }} numberOfLines={1}>
            ends by {endsBy}
          </Text>
        </View>
      </View>
      <Button
        testID="live-stop"
        mode="contained"
        icon="stop"
        compact
        onPress={() => router.push('/stop-lesson')}
        contentStyle={{ minHeight: 44 }}
      >
        Stop
      </Button>
      <IconButton
        testID="live-cancel"
        icon="close"
        size={20}
        accessibilityLabel="Discard this session"
        onPress={confirmCancel}
        disabled={cancel.isPending}
        style={{ margin: 0 }}
      />
    </View>
  );

  return (
    <View testID="live-banner" accessibilityRole="none">
      {glass ? (
        <GlassView
          glassEffectStyle="regular"
          // A wash of the surface keeps the lines legible over a busy list (4.5:1 in every palette).
          tintColor={withAlpha(theme.colors.surface, 0.55)}
          colorScheme={theme.scheme === 'dark' ? 'dark' : 'light'}
          style={{ borderRadius: radius.xl, overflow: 'hidden' }}
        >
          {content}
        </GlassView>
      ) : (
        <Surface
          elevation={3}
          style={{
            borderRadius: radius.xl,
            backgroundColor: theme.colors.elevation.level3,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
          }}
        >
          {content}
        </Surface>
      )}
    </View>
  );
}

function Stopwatch({ startedAt }: { startedAt: string }) {
  const seconds = useStopwatch(startedAt);
  return (
    <Text
      testID="live-stopwatch"
      variant="titleMedium"
      accessibilityHint="Elapsed time"
      accessibilityLiveRegion="none"
      style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}
    >
      {formatStopwatch(seconds)}
    </Text>
  );
}

/** A quiet pulse says "running" without being a distraction; still under reduce motion. */
function Pulse() {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.3, { duration: 900 }), -1, true);
  }, [reduced, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary }, style]}
    />
  );
}
