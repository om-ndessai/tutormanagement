// The web's theme toggle (components/layout/theme-toggle.tsx) as one segmented control, shared by the
// account sheet and My profile.
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme, useThemeMode, type ThemeMode } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/** `describe`: a line saying what the choice means now (My profile; the account sheet stays short). */
export function AppearanceControl({ testID, describe = false }: { testID?: string; describe?: boolean }) {
  const { mode, setMode } = useThemeMode();
  const theme = useAppTheme();
  const current =
    mode === 'system'
      ? `Matches this device, which is ${theme.scheme === 'dark' ? 'dark' : 'light'} now.`
      : `Always ${mode}, whatever this device is set to.`;
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
      {describe ? (
        <Text testID="appearance-current" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {current}
        </Text>
      ) : null}
    </View>
  );
}
