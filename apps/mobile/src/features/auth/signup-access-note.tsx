// UI audit (JF2, JF8; docs/journey-fixes-plan.md, Phase 70): what a sign-up says BEFORE the provider's
// button, by the platform's Sign-up access -- under Post-approved that a person checks every new account,
// under Pre-approved that sign-up is by invitation -- so a newcomer learns of the wait or the list before the
// whole form, not after it (J02 step 9, J13). The words are shared (`SIGNUP_ACCESS_NOTES`); Open says nothing,
// and so does an older Worker that sends no `signup_access`. Shown in sign-up mode only, never to sign in.
import { SIGNUP_ACCESS_NOTES, type AuthConfig } from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/** The note for this server's Sign-up access, or null (Open, or an older Worker). */
export function signupAccessNote(
  config: Pick<AuthConfig, 'signup_access'> | null | undefined,
): string | null {
  const mode = config?.signup_access;
  return (mode && SIGNUP_ACCESS_NOTES[mode]) || null;
}

export function SignupAccessNote({
  config,
}: {
  config: Pick<AuthConfig, 'signup_access'> | null | undefined;
}) {
  const theme = useAppTheme();
  const note = signupAccessNote(config);
  if (!note) return null;
  const invitation = config?.signup_access === 'preapproved';
  return (
    <View
      testID="signup-access-note"
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        alignSelf: 'stretch',
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: theme.tokens.muted,
      }}
    >
      <Icon
        source={invitation ? 'lock-outline' : 'clock-outline'}
        size={18}
        color={theme.tokens.mutedForeground}
      />
      <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurface }}>
        {note}
      </Text>
    </View>
  );
}
