import { Stack } from 'expo-router';

import { ConsoleHeaderButtons } from '@/features/platform/console-header';
import { useStackOptions } from '@/features/shell/stack-options';

export default function OrganizationsStack() {
  const options = useStackOptions();
  const detail = useStackOptions({ large: false });
  return (
    <Stack screenOptions={options}>
      <Stack.Screen
        name="index"
        options={{ title: 'Organizations', headerRight: () => <ConsoleHeaderButtons /> }}
      />
      <Stack.Screen name="organizations/[id]" options={{ ...detail, title: '' }} />
    </Stack>
  );
}
