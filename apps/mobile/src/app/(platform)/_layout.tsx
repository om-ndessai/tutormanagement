import { Stack } from 'expo-router';

import { useStackOptions } from '@/features/shell/stack-options';
import { usePlatformBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The platform console (#35): its tabs, and the space form as a sheet over them. It wears the
 * platform's own identity for as long as it is open -- the sheet too -- and runs outside every
 * space: nothing here reads a space's people, lessons or money (R14). The question
 * bank's Review (#54) is pushed over the tabs, so the question gets the whole height; so are the
 * console's Settings (Phase 62), from the gear in its header, since the tabs are full.
 */
export default function PlatformLayout() {
  usePlatformBrand();
  const theme = useAppTheme();
  const review = useStackOptions({ large: false });
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="platform" />
      <Stack.Screen name="question-review" options={{ ...review, headerShown: true, title: 'Review' }} />
      <Stack.Screen name="platform-settings" options={{ ...review, headerShown: true, title: 'Settings' }} />
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
