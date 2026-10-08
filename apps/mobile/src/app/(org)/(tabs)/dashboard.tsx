import { Button, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';

export default function Home() {
  const { user, signOut } = useAuth();
  const brand = useBrand();
  return (
    <Screen testID="screen-home" edges={['top', 'bottom']}>
      <Text variant="headlineSmall">{brand.short}</Text>
      <Text testID="home-user">{user?.full_name}</Text>
      <Button onPress={() => void signOut()} testID="home-sign-out">
        Sign out
      </Button>
    </Screen>
  );
}
