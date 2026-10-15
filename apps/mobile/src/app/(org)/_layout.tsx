import { Stack } from 'expo-router';

import { DictationProvider } from '@/features/dictation/dictation-provider';
import { OnboardingProvider } from '@/features/onboarding/onboarding-provider';
import { useQuickActionHandler, useQuickActionItems } from '@/features/shell/quick-actions';
import { useStackOptions } from '@/features/shell/stack-options';
import { LiveSessionHost } from '@/features/teaching/live-session-banner';
import { useAuth } from '@/providers/auth-provider';

/**
 * Everything inside an organization. Keyed on the organization, so switching remounts the
 * whole tree: no screen state from one organization survives into another (R13); the query
 * cache was already cleared by the switch, and the dictation session is aborted. The live lesson banner floats over every screen here
 * while the reader has a lesson running. The welcome wizard and tour (#34) sit over all of it: the
 * wizard as a route rising from the bottom, so the form sheets it opens present over it.
 */
const STEP_FLOW_OPTIONS = {
  presentation: 'card',
  animation: 'slide_from_bottom',
  gestureEnabled: false,
  headerShown: false,
} as const;

export default function OrgLayout() {
  const { organization, user } = useAuth();
  const options = useStackOptions({ large: false });
  // Home-screen quick actions follow the roles held in THIS organization (#43).
  useQuickActionItems(user?.roles);
  useQuickActionHandler(user?.roles);
  return (
    <LiveSessionHost key={organization?.slug ?? 'none'}>
      {/* One dictation at a time (P3); remounted with the organization, which aborts it. */}
      <DictationProvider>
        <OnboardingProvider>
          <Stack screenOptions={options}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* The welcome wizard rises like the step flows, for the same reason: the sheets it opens
                (New parent, the assessment, plan and pairing) are unreachable to VoiceOver over a
                full-screen modal on iOS (UI upgrades U3). */}
            <Stack.Screen name="onboarding" options={STEP_FLOW_OPTIONS} />
            {/* Adding a student or a tutor is a step flow (UI upgrades U3). Pushed, rising from the
                bottom, rather than a full-screen modal: on iOS a form sheet presented over a
                full-screen modal never reaches the accessibility tree (VoiceOver and the UI tests saw
                only the modal beneath), and this flow opens sheets -- New parent, then the
                assessment, plan, pairing and tax setup. Its own close and the unsaved-changes guard
                stand in for the swipe, which is off. */}
            <Stack.Screen name="add-student" options={STEP_FLOW_OPTIONS} />
            <Stack.Screen name="add-tutor" options={STEP_FLOW_OPTIONS} />
            <Stack.Screen
              name="new-parent"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: 'fitToContents',
                sheetGrabberVisible: true,
                headerShown: false,
              }}
            />
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
              name="location-form"
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
            <Stack.Screen
              name="payment-form"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.9, 1],
                sheetGrabberVisible: true,
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="form-1099"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.9, 1],
                sheetGrabberVisible: true,
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="comments-thread"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75, 1],
                sheetGrabberVisible: true,
                headerShown: false,
              }}
            />
          </Stack>
        </OnboardingProvider>
      </DictationProvider>
    </LiveSessionHost>
  );
}
