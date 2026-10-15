import { Tabs } from 'expo-router/js-tabs';

import { AppTabBar } from '@/features/shell/app-tab-bar';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The tab bar: the same four destinations and More for everyone, so it never reshapes under
 * someone, and the create button in the middle for anyone with something to create (UI upgrades
 * U2). The app draws it (`AppTabBar`): the system's bar holds five items at most, and this one
 * holds six. Each tab keeps its own stack; back from a tab returns to Home, as before.
 */
export default function TabsLayout() {
  const theme = useAppTheme();
  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.background } }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
