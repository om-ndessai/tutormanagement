import { Stack } from 'expo-router';

import { useStackOptions } from '@/features/shell/stack-options';
import { usePlatformBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The platform console (#35): its tabs, and the organization form as a sheet over them. It wears the
 * platform's own identity for as long as it is open -- the sheet too -- and runs outside every
 * organization: nothing here reads an organization's people, lessons or money (R14). The question
 * bank's Review (#54) is pushed over the tabs, so the question gets the whole height.
 */
export default function PlatformLayout() {
  usePlatformBrand();
  const theme = useAppTheme();
  const review = useStackOptions({ large: false });
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="platform" />
      <Stack.Screen name="question-review" options={{ ...review, headerShown: true, title: 'Review' }} />
      <Stack.Screen
        name="organization-form"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
        }}
      />
      {/* Phase 54: an organization (a business) of the console's Organizations. */}
      <Stack.Screen
        name="business-form"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
