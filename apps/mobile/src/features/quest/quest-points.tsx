// The trophy and "N points" of the web's Quest header and cards (TrophyIcon + count) @ 82397b8.
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { pointsLabel } from './quest-model';

export function QuestPoints({ points, testID = 'quest-points' }: { points: number; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Icon source="trophy-outline" size={16} color={theme.colors.onSurface} />
      <Text testID={testID} variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
        {pointsLabel(points)}
      </Text>
    </View>
  );
}
