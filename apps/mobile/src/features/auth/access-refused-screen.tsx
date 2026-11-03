// Phase 65 (A4, A7; docs/access-approval-plan.md): the plain screen for a person the platform does not
// let in (yet) -- their sign-up waits for approval, was not approved, or sign-up is by invitation and
// they are not on the list. Never a raw error line: a title, the server's own words, Contact us and Back.
// The web has its own copy of this screen (apps/web, built in parallel); the titles are the same.
import { ACCESS_DECLINED_MESSAGE, NOT_ON_LIST_MESSAGE, PLATFORM_CONTACT_EMAIL, accessPendingMessage } from '@tmi/shared';
import { Linking, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

export const ACCESS_REFUSED_TITLES: Record<string, string> = {
  access_pending: 'Waiting for approval',
  access_declined: 'Access not approved',
  not_on_list: 'Sign-up is by invitation',
};

const FALLBACK_MESSAGES: Record<string, string> = {
  access_pending: accessPendingMessage(null),
  access_declined: ACCESS_DECLINED_MESSAGE,
  not_on_list: NOT_ON_LIST_MESSAGE,
};

const ICONS: Record<string, string> = {
  access_pending: 'clock-outline',
  access_declined: 'account-cancel-outline',
  not_on_list: 'lock-outline',
};

export function AccessRefusedScreen({
  code,
  message,
  onBack,
}: {
  code: string;
  message: string;
  onBack: () => void;
}) {
  const theme = useAppTheme();
  const title = ACCESS_REFUSED_TITLES[code] ?? 'Not signed in';
  const words = message.trim() || FALLBACK_MESSAGES[code] || '';
  return (
    <Screen testID="screen-access-refused" edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xxl }}>
        <LogoMark size={64} />
        <Icon source={ICONS[code] ?? 'account-lock-outline'} size={40} color={theme.tokens.mutedForeground} />
        <Text
          testID="access-refused-title"
          variant="headlineSmall"
          accessibilityRole="header"
          style={{ fontWeight: '700', textAlign: 'center' }}
        >
          {title}
        </Text>
        <Text
          testID="access-refused-message"
          variant="bodyLarge"
          style={{ textAlign: 'center', color: theme.tokens.mutedForeground }}
        >
          {words}
        </Text>
        <View style={{ alignSelf: 'stretch', gap: space.sm, paddingTop: space.md }}>
          <Button
            testID="access-refused-contact"
            mode="contained"
            icon="email-outline"
            onPress={() => void Linking.openURL(`mailto:${PLATFORM_CONTACT_EMAIL}`).catch(() => undefined)}
          >
            Contact us
          </Button>
          <Button testID="access-refused-back" mode="outlined" onPress={onBack}>
            Back
          </Button>
        </View>
      </View>
    </Screen>
  );
}
