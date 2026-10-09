// The web's theme toggle (components/layout/theme-toggle.tsx) as one segmented control, shared by the
// account sheet and My profile.
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useThemeMode, type ThemeMode } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

export function AppearanceControl({ testID }: { testID?: string }) {
  const { mode, setMode } = useThemeMode();
  return (
    <View testID={testID} style={{ gap: space.sm }}>
      <Text variant="labelLarge">Appearance</Text>
      <SegmentedButtons
        value={mode}
        onValueChange={(value) => {
          haptics.selection();
          setMode(value as ThemeMode);
        }}
        buttons={[
          { value: 'light', label: 'Light', icon: 'white-balance-sunny', testID: 'appearance-light' },
          { value: 'dark', label: 'Dark', icon: 'weather-night', testID: 'appearance-dark' },
          { value: 'system', label: 'System', icon: 'theme-light-dark', testID: 'appearance-system' },
        ]}
      />
    </View>
  );
}
