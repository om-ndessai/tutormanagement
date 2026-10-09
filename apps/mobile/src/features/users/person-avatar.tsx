// The web's initials avatar (users-table.tsx `Avatar`, user-detail-view.tsx) @ 1132322.
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { initials } from './people-model';

export function PersonAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const dark = theme.scheme === 'dark';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dark ? withAlpha(t.brand900, 0.6) : t.brand100,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Text style={{ fontSize: size * 0.36, fontWeight: '600', color: dark ? t.brand200 : t.brand800 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
