import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { ICON_TARGET } from '@/components/icon-button';
import { useTourTarget } from '@/features/onboarding/tour-targets';
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

/** The header's account button (the web's user menu trigger): opens the account sheet. */
export function AccountButton() {
  const { user } = useAuth();
  const theme = useAppTheme();
  // The web's "Getting started": on the phone the tour and the setup come back from this menu.
  const tourRef = useTourTarget('getting-started');
  if (!user) return null;
  return (
    <Pressable
      ref={tourRef}
      testID="account-button"
      accessibilityRole="button"
      accessibilityLabel="Account menu"
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
        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
          {initials(user.full_name)}
        </Text>
      </View>
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
