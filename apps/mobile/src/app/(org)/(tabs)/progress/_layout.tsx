import { Stack } from 'expo-router';

import { HeaderButtons } from '@/features/shell/account-button';
import { useStackOptions } from '@/features/shell/stack-options';

/** A student's page opened from another tab still has the list under it, so Back lands there. */
export const unstable_settings = { initialRouteName: 'index' };

export default function ProgressStack() {
  const options = useStackOptions();
  const detail = useStackOptions({ large: false });
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Progress', headerRight: () => <HeaderButtons /> }} />
      <Stack.Screen name="[studentId]" options={{ ...detail, title: 'Progress' }} />
    </Stack>
  );
}
