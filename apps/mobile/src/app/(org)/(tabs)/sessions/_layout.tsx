import { Stack } from 'expo-router';

import { AccountButton } from '@/features/shell/account-button';
import { useStackOptions } from '@/features/shell/stack-options';

export default function SessionsStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Sessions', headerRight: () => <AccountButton /> }} />
    </Stack>
  );
}
