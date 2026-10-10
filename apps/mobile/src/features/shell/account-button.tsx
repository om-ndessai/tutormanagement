import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

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
      hitSlop={8}
      onPress={() => router.push('/account')}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primaryContainer,
      }}
    >
      <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
        {initials(user.full_name)}
      </Text>
    </Pressable>
  );
}

/** A tab root's header actions: search, then the account button. */
export function HeaderButtons() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <SearchButton />
      <AccountButton />
    </View>
  );
}
