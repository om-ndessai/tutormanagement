import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useStackOptions } from '@/features/shell/stack-options';
import { usePlatformBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The platform console (#35): its tabs, and the space form as a sheet over them. It wears the
 * platform's own identity for as long as it is open -- the sheet too -- and runs outside every
 * space: nothing here reads a space's people, lessons or money (R14). The question
 * bank's Review (#54) is pushed over the tabs, so the question gets the whole height; so are the
 * console's Settings (Phase 62), from the gear in its header, since the tabs are full, and its
 * Stickiness (Phase 69), from the chart beside it. Approving a sign-up (Phase 80) is a sheet over Settings.
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
      <Stack.Screen name="platform-stickiness" options={{ ...review, headerShown: true, title: 'Stickiness' }} />
      <Stack.Screen
        name="organization-form"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
        }}
      />
      {/* Phase 80 (A11, A15): Approve, with an optional space to place them in -- a list, so a tall sheet. */}
      {/* iOS: a page sheet, not a form sheet. In an iOS form sheet react-native-screens stretches the sheet's scroll
          view to the whole sheet (`coerceChildScrollViewComponentSizeToSize`), so the spaces' list (a FlatList, under
          the title and the search field) was drawn over them both and a tap on the search chose a space instead
          (Maestro, platform/access, 2026-11-06). Android keeps its bottom sheet. */}
      <Stack.Screen
        name="approve-account"
        options={
          Platform.OS === 'ios'
            ? { presentation: 'modal' }
            : { presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true }
        }
      />
    </Stack>
  );
}
