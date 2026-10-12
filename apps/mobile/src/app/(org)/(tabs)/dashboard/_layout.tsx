import { Stack } from 'expo-router';

import { HeaderButtons } from '@/features/shell/account-button';
import { useStackOptions } from '@/features/shell/stack-options';

export default function HomeStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Home', headerRight: () => <HeaderButtons /> }} />
    </Stack>
  );
}
