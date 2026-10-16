import { Stack } from 'expo-router';

import { HeaderButtons } from '@/features/shell/account-button';
import { useStackOptions } from '@/features/shell/stack-options';

export default function HomeStack() {
  // A small title (UI upgrades U6): the greeting is the page's heading, so the large "Home" gave
  // the first screen to chrome.
  const options = useStackOptions({ large: false });
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Home', headerRight: () => <HeaderButtons /> }} />
    </Stack>
  );
}
