import { PLATFORM_BRAND } from '@tmi/shared';
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View testID="screen-index" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{PLATFORM_BRAND.name}</Text>
    </View>
  );
}
