import { Stack } from 'expo-router';

import { useStackOptions } from '@/features/shell/stack-options';
import { useAuth } from '@/providers/auth-provider';

/**
 * Everything inside an organization. Keyed on the organization, so switching remounts the
 * whole tree: no screen state from one organization survives into another (R13); the query
 * cache was already cleared by the switch.
 */
export default function OrgLayout() {
  const { organization } = useAuth();
  const options = useStackOptions({ large: false });
  return (
    <Stack key={organization?.slug ?? 'none'} screenOptions={options}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="account"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="reflection"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="view-as"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
