import { Stack } from 'expo-router';

import { ConsoleHeaderButtons } from '@/features/platform/console-header';
import { useStackOptions } from '@/features/shell/stack-options';

/** The console's Questions tab (#54): the bank, then a standard's questions. Review covers the tabs. */
export default function QuestionsStack() {
  const options = useStackOptions();
  const detail = useStackOptions({ large: false });
  return (
    <Stack screenOptions={options}>
      <Stack.Screen
        name="index"
        options={{ title: 'Question bank', headerRight: () => <ConsoleHeaderButtons /> }}
      />
      <Stack.Screen name="[topicId]" options={{ ...detail, title: '' }} />
    </Stack>
  );
}
