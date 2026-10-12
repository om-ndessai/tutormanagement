import { Stack } from 'expo-router';

import { ConsoleHeaderButtons } from '@/features/platform/console-header';
import { useStackOptions } from '@/features/shell/stack-options';

export default function AdminsStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen
        name="index"
        options={{ title: 'Platform admins', headerRight: () => <ConsoleHeaderButtons /> }}
      />
    </Stack>
  );
}
