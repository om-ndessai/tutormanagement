// The Haptics switch (ux-audit F-19; immersive-design.md §7, which Apple asks for): off, the app
// gives no haptics at all. Kept on the device, like the appearance.
import { useState } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { haptics, hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

export function HapticsControl({ testID }: { testID?: string }) {
  const theme = useAppTheme();
  const [on, setOn] = useState(hapticsEnabled);
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelLarge">Haptics</Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          A light tap when something is saved, fails or is chosen.
        </Text>
      </View>
      <Switch
        testID="haptics-switch"
        accessibilityLabel="Haptics"
        value={on}
        onValueChange={(next) => {
          setHapticsEnabled(next);
          setOn(next);
          // Felt only when turned on: the switch confirming itself.
          haptics.selection();
        }}
      />
    </View>
  );
}
