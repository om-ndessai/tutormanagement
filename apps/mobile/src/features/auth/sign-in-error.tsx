// Ported from apps/web/src/features/auth/login-page.tsx (SignInError) @ 1132322
import { AUTH_ERROR_CODES } from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/**
 * Sign-in failures are mostly not the person's fault, and each one has a different next step --
 * so they get their own copy rather than one generic "sign-in failed". The message is the
 * server's own; no_account already says what to do, so it gets no second line.
 */
export function SignInError({ code, message }: { code: string; message: string }) {
  const theme = useAppTheme();
  const guidance =
    code === AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
      ? 'Contact an administrator to have your access restored.'
      : code === AUTH_ERROR_CODES.EMAIL_UNVERIFIED
        ? 'Verify your email address with Google, then try again.'
        : null;

  return (
    <View
      testID="sign-in-error"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.error,
        backgroundColor: theme.colors.errorContainer,
        padding: space.md,
        gap: space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <Icon source="alert-outline" size={18} color={theme.colors.onErrorContainer} />
        <Text
          variant="bodyMedium"
          style={{ flex: 1, color: theme.colors.onErrorContainer, fontWeight: '600' }}
        >
          {message}
        </Text>
      </View>
      {guidance ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, paddingLeft: 26 }}>
          {guidance}
        </Text>
      ) : null}
    </View>
  );
}
