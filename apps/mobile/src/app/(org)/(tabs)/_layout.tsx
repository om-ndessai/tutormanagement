import { Tabs } from 'expo-router/js-tabs';

import { TabBarOverlapContext } from '@/components/live-banner-inset';
import { AppTabBar } from '@/features/shell/app-tab-bar';
import { useTabBarHump } from '@/features/shell/tab-bar-hump';
import { TAB_BAR_HUMP } from '@/features/teaching/live-session';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The tab bar: Home, Sessions, Progress and More for everyone, so it never reshapes under
 * someone, and the "+" in a hump in the middle for anyone with something to create (UI upgrades
 * U2, revised 2026-10-15). The app draws it (`AppTabBar`). Schedule is still a route of its own
 * here, with its own stack, but not a tab: it lives inside Sessions behind the Lessons | Schedule
 * switch, and the bar leaves it out and lights Sessions while it is in front. Each tab keeps its
 * own stack; back from a tab returns to Home, as before.
 */
export default function TabsLayout() {
  const theme = useAppTheme();
  const hump = useTabBarHump();
  return (
    // The hump reaches up over the foot of every screen in the tabs; they pad for it.
    <TabBarOverlapContext value={hump ? TAB_BAR_HUMP : 0}>
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
    </TabBarOverlapContext>
  );
}
