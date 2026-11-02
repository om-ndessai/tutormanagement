// The web's `<Badge variant="secondary">` as a small label: "Beta" beside the Assessment menu item,
// its page and its switch (Phase 38). Muted, from the theme's tokens. Phase 64: `tone="primary"` is the
// web's default `<Badge>` (a game's "New best!").
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export function BadgePill({
  label = 'Beta',
  testID,
  tone = 'secondary',
}: {
  label?: string;
  testID?: string;
  tone?: 'secondary' | 'primary';
}) {
  const theme = useAppTheme();
  const primary = tone === 'primary';
  return (
    <View
      testID={testID}
      style={{
        alignSelf: primary ? 'flex-start' : 'center',
        backgroundColor: primary ? theme.colors.primary : theme.tokens.secondary,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <Text
        variant="labelSmall"
        style={{ color: primary ? theme.colors.onPrimary : theme.tokens.secondaryForeground, fontWeight: '700' }}
      >
        {label}
      </Text>
    </View>
  );
}
