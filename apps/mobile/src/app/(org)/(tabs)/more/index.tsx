import { router } from 'expo-router';
import { View } from 'react-native';
import { List, Surface, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { useNavItems } from '@/features/shell/nav-items';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/** Every page that is not a tab: the rest of the web sidebar, plus search. */
export default function MoreScreen() {
  const items = useNavItems().filter((item) => !item.tab);
  const brand = useBrand();
  const theme = useAppTheme();
  return (
    <Screen testID="screen-more">
      <Surface elevation={1} style={{ borderRadius: radius.lg }}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <List.Item
            testID="more-search"
            title="Search"
            description="Pages, people and actions"
            left={(props) => <List.Icon {...props} icon="magnify" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/search')}
          />
        </View>
      </Surface>
      <Surface elevation={1} style={{ borderRadius: radius.lg }}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          {items.map((item) => (
            <List.Item
              key={item.tourId}
              testID={`more-${item.tourId}`}
              title={item.label}
              left={(props) => <List.Icon {...props} icon={item.icon} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(item.href)}
            />
          ))}
        </View>
      </Surface>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
        {brand.name}
      </Text>
    </Screen>
  );
}
