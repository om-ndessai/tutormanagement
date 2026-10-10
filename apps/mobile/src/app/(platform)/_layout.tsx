import { Stack } from 'expo-router';

import { usePlatformBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The platform console (#35): its tabs, and the organization form as a sheet over them. It wears the
 * platform's own identity for as long as it is open -- the sheet too -- and runs outside every
 * organization: nothing here reads an organization's people, lessons or money (R14).
 */
export default function PlatformLayout() {
  usePlatformBrand();
  const theme = useAppTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="platform" />
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
