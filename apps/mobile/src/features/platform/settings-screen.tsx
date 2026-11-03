// Phase 62 (docs/stickiness-plan.md): the console's Settings, pushed from the gear in its header
// (the console's tabs are full). P0's Sign-in section first, then P5's Play section (the tiles), then
// Phase 63's Guest play (P16), with Phase 65's Sign-up access inside it.
import { useRef, useState } from 'react';
import { View, type ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/screen';
import { space } from '@/theme/tokens';
import { accessKey, guestKey, playKey, signInSettingsKey } from './api';
import { AccessJump } from './access-settings-section';
import { GuestSettingsSection } from './guest-settings-section';
import { PlaySettingsSection } from './play-settings-section';
import { SignInSettingsSection } from './sign-in-settings-section';

export function PlatformSettingsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Sign-up access sits at the top of Guest play, below the long list of tiles: the row at the top
  // jumps there.
  const scrollRef = useRef<ScrollView | null>(null);
  const guestY = useRef(0);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: signInSettingsKey }),
        queryClient.refetchQueries({ queryKey: playKey }),
        queryClient.refetchQueries({ queryKey: guestKey }),
        queryClient.refetchQueries({ queryKey: accessKey }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-platform-settings" scrollRef={scrollRef} refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <AccessJump onReview={() => scrollRef.current?.scrollTo({ y: Math.max(0, guestY.current - space.lg), animated: true })} />
      <SignInSettingsSection />
      <PlaySettingsSection />
      <View onLayout={(event) => (guestY.current = event.nativeEvent.layout.y)}>
        <GuestSettingsSection />
      </View>
    </Screen>
  );
}
