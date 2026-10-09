import { Stack } from 'expo-router';

import { useStackOptions } from '@/features/shell/stack-options';
import { LiveSessionHost } from '@/features/teaching/live-session-banner';
import { useAuth } from '@/providers/auth-provider';

/**
 * Everything inside an organization. Keyed on the organization, so switching remounts the
 * whole tree: no screen state from one organization survives into another (R13); the query
 * cache was already cleared by the switch. The live lesson banner floats over every screen here
 * while the reader has a lesson running.
 */
export default function OrgLayout() {
  const { organization } = useAuth();
  const options = useStackOptions({ large: false });
  return (
    <LiveSessionHost key={organization?.slug ?? 'none'}>
      <Stack screenOptions={options}>
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
          name="record-session"
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
        <Stack.Screen
          name="start-lesson"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="assess-session"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="assignment-form"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="schedule-form"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="cancel-lesson"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="stop-lesson"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="assessment-form"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="person-form"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="plan-form"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
      </Stack>
    </LiveSessionHost>
  );
}
