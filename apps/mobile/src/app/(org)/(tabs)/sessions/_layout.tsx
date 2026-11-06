import { COMMON_COPY, TERMS } from '@tmi/shared';
import { Stack } from 'expo-router';

import { HeaderButtons } from '@/features/shell/account-button';
import { useStackOptions } from '@/features/shell/stack-options';

export default function SessionsStack() {
  const options = useStackOptions();
  const detail = useStackOptions({ large: false });
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: COMMON_COPY.lessons_page, headerRight: () => <HeaderButtons /> }} />
      <Stack.Screen name="[id]" options={{ ...detail, title: TERMS.lesson.One }} />
    </Stack>
  );
}
