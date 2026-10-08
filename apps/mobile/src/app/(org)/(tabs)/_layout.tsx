import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppTheme } from '@/providers/theme-provider';

/**
 * The tab bar: the same four destinations and More for everyone, so it never reshapes under
 * someone (and native tabs remount when their set changes). The system draws the bar --
 * Liquid Glass on iOS, Material 3 on Android -- tinted with the organization's primary.
 */
export default function TabsLayout() {
  const theme = useAppTheme();
  return (
    <NativeTabs
      tintColor={theme.colors.primary}
      iconColor={{ default: theme.colors.onSurfaceVariant, selected: theme.colors.primary }}
      indicatorColor={theme.colors.primaryContainer}
      backgroundColor={theme.colors.surface}
      labelStyle={{
        default: { color: theme.colors.onSurfaceVariant },
        selected: { color: theme.colors.primary },
      }}
    >
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sessions">
        <NativeTabs.Trigger.Label>Sessions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="schedule">
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
