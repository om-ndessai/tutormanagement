// Ported from apps/web/src/features/quest/game-page.tsx @ cd0378d (working tree): useTimeLeft and
// the clock in GamePage's status.
//
// A timed game's time left, ticking on the device but set by the server's clock (the offset taken
// each time the game is read). Mobile (design 60): its own component, so only it re-renders as it
// ticks, and once a second rather than the web's 250 ms (re-rendering on Hermes Android has stalled
// the app before). Under 30 seconds it turns to the error colour; read aloud as "4 minutes 5 seconds
// left", and announced on iOS at one minute and at ten seconds.
import { clockLabel } from '@tmi/shared';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { CLOCK_URGENT_MS, clockAnnouncement, clockSpeech, timeLeftMs } from './game-model';

export function GameClock({
  endsAt,
  serverNow,
  receivedAt,
}: {
  endsAt: string;
  /** The server's clock when the game was read. */
  serverNow: string;
  /** When that reading arrived on this device (the query's dataUpdatedAt). */
  receivedAt: number;
}) {
  const theme = useAppTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = timeLeftMs(endsAt, serverNow, receivedAt, now);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    const said = clockAnnouncement(previous.current, left);
    previous.current = left;
    if (said && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(said);
  }, [left]);

  const urgent = left < CLOCK_URGENT_MS;
  const color = urgent ? theme.colors.error : theme.colors.onSurface;
  return (
    <View
      testID="game-clock"
      accessible
      accessibilityRole="timer"
      accessibilityLabel={clockSpeech(left)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
    >
      <Icon source="timer-outline" size={16} color={color} />
      <Text variant="bodyMedium" style={{ color, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {clockLabel(left)}
      </Text>
    </View>
  );
}
