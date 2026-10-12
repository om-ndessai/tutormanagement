import { Stack } from 'expo-router';

import { ConsoleHeaderButtons } from '@/features/platform/console-header';
import { useStackOptions } from '@/features/shell/stack-options';

export default function PeopleStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'People', headerRight: () => <ConsoleHeaderButtons /> }} />
    </Stack>
  );
}
