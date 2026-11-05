import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { ICON_TARGET } from '@/components/icon-button';
import { useTourTarget } from '@/features/onboarding/tour-targets';
import {
  accountBadgeCount,
  answeredRequests,
  requestAnswersWaiting,
} from '@/features/organizations/space-model';
import { invitationsWaiting } from '@/features/organizations/spaces-model';
import { useAuth } from '@/providers/auth-provider';
import { SearchButton } from './search-button';
import { useAppTheme } from '@/providers/theme-provider';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** "Account menu", then what waits, as the web's switcher says it: "1 invitation waiting, 2 answers to your requests". */
export function accountButtonLabel(invitations: number, answers: number): string {
  const waiting = [
    invitations > 0 ? invitationsWaiting(invitations) : null,
    answers > 0 ? requestAnswersWaiting(answers) : null,
  ].filter(Boolean);
  return ['Account menu', ...waiting].join(', ');
}

/**
 * The header's account button (the web's user menu trigger and its space switcher): opens the account
 * sheet. Its badge counts what waits for the person -- invitations, and the spaces' answers to their
 * requests not yet dismissed (UI audit JF5).
 */
export function AccountButton() {
  const { user, invitations, joinRequests } = useAuth();
  const theme = useAppTheme();
  // The web's "Getting started": on the phone the tour and the setup come back from this menu.
  const tourRef = useTourTarget('getting-started');
  if (!user) return null;
  const answers = answeredRequests(joinRequests).length;
  const waiting = accountBadgeCount(invitations.length, joinRequests);
  return (
    <Pressable
      ref={tourRef}
      testID="account-button"
      accessibilityRole="button"
      accessibilityLabel={accountButtonLabel(invitations.length, answers)}
      onPress={() => router.push('/account')}
      // The frame is the target (44pt / 48dp, ux-audit F-5); the initials sit in a smaller disc.
      style={{ width: ICON_TARGET, height: ICON_TARGET, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primaryContainer,
        }}
      >
        {/* The disc is fixed chrome inside a fixed 44/48 header target, so its initials are the one
            text allowed to stop growing: at AX5 they outgrew the disc and were clipped to a
            fragment (ux-audit F-12). The account sheet itself scales fully. */}
        <Text
          variant="labelMedium"
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: theme.colors.onPrimaryContainer }}
        >
          {initials(user.full_name)}
        </Text>
      </View>
      {waiting > 0 ? (
        <View
          testID="account-badge"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            top: 2,
            right: 0,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.error,
            borderWidth: 2,
            borderColor: theme.colors.surface,
          }}
        >
          <Text
            variant="labelSmall"
            maxFontSizeMultiplier={1}
            style={{ color: theme.colors.onError, fontSize: 10, lineHeight: 12, fontWeight: '700' }}
          >
            {waiting > 9 ? '9+' : String(waiting)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** A tab root's header actions: search, then the account button. */
export function HeaderButtons() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SearchButton />
      <AccountButton />
    </View>
  );
}
