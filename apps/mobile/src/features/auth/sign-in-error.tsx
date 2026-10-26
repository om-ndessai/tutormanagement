// Ported from apps/web/src/features/auth/login-page.tsx (SignInError) @ 1132322 (Phase 51/52 additions: entry 63)
import { AUTH_ERROR_CODES } from '@tmi/shared';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/**
 * Sign-in failures are mostly not the person's fault, and each one has a different next step --
 * so they get their own copy rather than one generic "sign-in failed". The message is the
 * server's own; no_account already says what to do, so it gets no second line.
 *
 * Phase 51: a rate limit (429) is calm -- the surface's colours and a clock, not an alert, and no
 * error haptic (the caller skips it). Phase 52: with developer sign-in, an address the server does
 * not know (404) offers to sign up as it, so the whole newcomer path can be walked locally.
 */
export function SignInError({
  code,
  message,
  signUpEmail,
  onSignUp,
}: {
  code: string;
  message: string;
  /** The address just typed, when developer sign-in may sign it up. */
  signUpEmail?: string | null;
  onSignUp?: () => void;
}) {
  const theme = useAppTheme();
  const calm = code === 'rate_limited';
  const guidance =
    code === AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
      ? 'Contact an administrator to have your access restored.'
      : code === AUTH_ERROR_CODES.EMAIL_UNVERIFIED
        ? 'Verify your email address with your account’s provider, then try again.'
        : calm
          ? 'Wait a minute, then try again.'
          : null;
  const ink = calm ? theme.colors.onSurfaceVariant : theme.colors.onErrorContainer;
  const offerSignUp = code === 'not_found' && signUpEmail && onSignUp;

  return (
    <View
      testID="sign-in-error"
      accessibilityRole={calm ? undefined : 'alert'}
      accessibilityLiveRegion="polite"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: calm ? theme.colors.outlineVariant : theme.colors.error,
        backgroundColor: calm ? theme.colors.surfaceVariant : theme.colors.errorContainer,
        padding: space.md,
        gap: space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <Icon source={calm ? 'clock-outline' : 'alert-outline'} size={18} color={ink} />
        <Text variant="bodyMedium" style={{ flex: 1, color: ink, fontWeight: '600' }}>
          {message}
        </Text>
      </View>
      {guidance ? (
        <Text variant="bodySmall" style={{ color: ink, paddingLeft: 26 }}>
          {guidance}
        </Text>
      ) : null}
      {offerSignUp ? (
        <View style={{ paddingLeft: 18, alignItems: 'flex-start' }}>
          <Button testID="sign-in-signup" mode="text" compact onPress={onSignUp} textColor={ink}>
            {`Sign up as ${signUpEmail}`}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
