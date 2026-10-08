import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { useAuth } from '@/providers/auth-provider';

export default function DashboardScreen() {
  const { user } = useAuth();
  return (
    <Screen testID="screen-home">
      <Text testID="home-user" variant="titleMedium">
        {user?.full_name}
      </Text>
    </Screen>
  );
}
