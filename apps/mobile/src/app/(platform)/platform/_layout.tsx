import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppTheme } from '@/providers/theme-provider';

/** The console's tabs, drawn by the system as the organization's are: Organizations, Admins, People, Activity. */
export default function PlatformTabsLayout() {
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
      <NativeTabs.Trigger name="(organizations)">
        <NativeTabs.Trigger.Label>Organizations</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'building.2', selected: 'building.2.fill' }} md="domain" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="admins">
        <NativeTabs.Trigger.Label>Admins</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'shield', selected: 'shield.fill' }} md="shield_person" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="people">
        <NativeTabs.Trigger.Label>People</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
