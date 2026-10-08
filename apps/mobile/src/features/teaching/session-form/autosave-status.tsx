// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (AutosaveStatus).
import { View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { formatInstantClock } from '../session-format';
import type { AutosaveState } from './use-draft-autosave';

/**
 * Where the quiet save stands, beside the buttons. Always said in words (motion is never the only
 * signal), announced politely, and never with a haptic: nobody pressed anything.
 */
export function AutosaveStatus({ state }: { state: AutosaveState }) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const reduced = useReducedMotion();
  const muted = theme.tokens.mutedForeground;

  let icon = null;
  let text = 'Autosaves as a draft while you write';
  if (state.kind === 'saving') {
    icon = <ActivityIndicator size={12} />;
    text = 'Saving draft…';
  } else if (state.kind === 'saved') {
    icon = <Icon source="check" size={14} color={theme.tokens.success} />;
    text = `Draft autosaved ${formatInstantClock(state.at, timeZone)}`;
  } else if (state.kind === 'failed') {
    icon = <Icon source="cloud-off-outline" size={14} color={theme.colors.error} />;
    text = 'Not autosaved yet';
  }

  return (
    <Animated.View
      key={state.kind}
      entering={reduced ? undefined : FadeIn.duration(200)}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text testID="record-autosave-status" variant="bodySmall" style={{ color: muted }}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}
