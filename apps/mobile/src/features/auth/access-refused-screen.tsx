// Phase 65 (A4, A7; docs/access-approval-plan.md): the plain screen for a person the platform does not
// let in (yet) -- their sign-up waits for approval, was not approved, or sign-up is by invitation and
// they are not on the list. Never a raw error line: a title and the server's own words.
//
// UI audit (JF2, JF8, JF36; docs/journey-fixes-plan.md, Phase 70): then a next step. Where guest play is
// offered, "Keep playing" leads, saying play goes on without an account, and goes back to where the person
// was playing; under Pre-approved, "Ask for an invitation" (a mail with the address prefilled -- nothing is
// stored) and "Use another account"; and "Contact us" shows the address in full. The web has its own copy
// of this screen (apps/web/src/features/auth/access-refused.tsx), with the same titles, words and testIDs.
import {
  ACCESS_DECLINED_MESSAGE,
  NOT_ON_LIST_MESSAGE,
  PLATFORM_BRAND,
  PLATFORM_CONTACT_EMAIL,
  accessPendingMessage,
} from '@tmi/shared';
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

/** The line above "Keep playing": guest play is still open. */
export const KEEP_PLAYING_LINE = 'You can keep playing without an account.';

/** A mail asking to be put on the sign-up list, with the address when this phone knows it (the web's words). */
export function invitationMailto(email?: string | null): string {
  const subject = `An invitation to ${PLATFORM_BRAND.name}`;
  const address = email?.trim();
  const body = address ? `Please add ${address} to the sign-up list.` : 'Please add me to the sign-up list.';
  return `mailto:${PLATFORM_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function openMail(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function AccessRefusedScreen({
  code,
  message,
  email = null,
  onKeepPlaying,
  onUseAnother,
  onBack,
}: {
  code: string;
  message: string;
  /** The account that was checked, when this phone knows it. */
  email?: string | null;
  /** Where guest play is offered: back to where the person was playing (the main button). */
  onKeepPlaying?: () => void;
  /** Under Pre-approved (not_on_list): back to the sign-in buttons, for another account. */
  onUseAnother?: () => void;
  /** Where there is no guest play: back to sign-in. */
  onBack?: () => void;
}) {
  const theme = useAppTheme();
  const title = ACCESS_REFUSED_TITLES[code] ?? 'Not signed in';
  const words = message.trim() || FALLBACK_MESSAGES[code] || '';
  const notOnList = code === 'not_on_list';
  const checked = email?.trim() || null;
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
        {notOnList && checked ? (
          <Text
            testID="access-refused-account"
            variant="bodyMedium"
            style={{ textAlign: 'center', color: theme.tokens.mutedForeground }}
          >
            {`Checked: ${checked}`}
          </Text>
        ) : null}
        {onKeepPlaying ? (
          <Text
            testID="access-refused-keep-line"
            variant="bodyLarge"
            style={{ textAlign: 'center', fontWeight: '600', color: theme.colors.onSurface }}
          >
            {KEEP_PLAYING_LINE}
          </Text>
        ) : null}
        <View style={{ alignSelf: 'stretch', gap: space.sm, paddingTop: space.md }}>
          {onKeepPlaying ? (
            <Button
              testID="access-refused-keep-playing"
              mode="contained"
              icon="gamepad-variant-outline"
              onPress={onKeepPlaying}
              contentStyle={{ minHeight: 48 }}
            >
              Keep playing
            </Button>
          ) : onBack ? (
            <Button
              testID="access-refused-back"
              mode="contained"
              onPress={onBack}
              contentStyle={{ minHeight: 48 }}
            >
              Back
            </Button>
          ) : null}
          {notOnList ? (
            <Button
              testID="access-refused-ask-invitation"
              mode="outlined"
              icon="email-plus-outline"
              onPress={() => openMail(invitationMailto(checked))}
              contentStyle={{ minHeight: 48 }}
            >
              Ask for an invitation
            </Button>
          ) : null}
          {notOnList && onUseAnother ? (
            <Button
              testID="access-refused-use-another"
              mode="outlined"
              icon="account-switch-outline"
              onPress={onUseAnother}
              contentStyle={{ minHeight: 48 }}
            >
              Use another account
            </Button>
          ) : null}
          <Button
            testID="access-refused-contact"
            mode="outlined"
            icon="email-outline"
            onPress={() => openMail(`mailto:${PLATFORM_CONTACT_EMAIL}`)}
            contentStyle={{ minHeight: 48 }}
          >
            {`Contact us: ${PLATFORM_CONTACT_EMAIL}`}
          </Button>
        </View>
      </View>
    </Screen>
  );
}
