// The web's `<Badge variant="secondary">` as a small label: "Beta" beside the Assessment menu item,
// its page and its switch (Phase 38). Muted, from the theme's tokens.
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export function BadgePill({ label = 'Beta', testID }: { label?: string; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'center',
        backgroundColor: theme.tokens.secondary,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="labelSmall" style={{ color: theme.tokens.secondaryForeground, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
