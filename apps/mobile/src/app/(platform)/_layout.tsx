import { Stack } from 'expo-router';

import { useStackOptions } from '@/features/shell/stack-options';
import { usePlatformBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The platform console (#35): its tabs, and the organization form as a sheet over them. It wears the
 * platform's own identity for as long as it is open -- the sheet too -- and runs outside every
 * organization: nothing here reads an organization's people, lessons or money (R14). The question
 * bank's Review (#54) is pushed over the tabs, so the question gets the whole height, and so is the
 * Handwriting lab (Phase 54, #64: the tab bar holds no sixth tab), with the swipe back off so a stroke
 * from the left edge never leaves the page.
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
        name="handwriting-lab"
        options={{ ...review, headerShown: true, title: 'Handwriting lab', gestureEnabled: false }}
      />
      <Stack.Screen
        name="organization-form"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
