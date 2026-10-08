import { Stack } from 'expo-router';

import { AccountButton } from '@/features/shell/account-button';
import { useStackOptions } from '@/features/shell/stack-options';

export default function MoreStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'More', headerRight: () => <AccountButton /> }} />
    </Stack>
  );
}
