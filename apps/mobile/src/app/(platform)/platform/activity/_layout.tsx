import { Stack } from 'expo-router';

import { ConsoleHeaderButtons } from '@/features/platform/console-header';
import { useStackOptions } from '@/features/shell/stack-options';

export default function ActivityStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen
        name="index"
        options={{ title: 'Activity', headerRight: () => <ConsoleHeaderButtons /> }}
      />
    </Stack>
  );
}
