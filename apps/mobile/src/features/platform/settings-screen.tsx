// Phase 62 (docs/stickiness-plan.md): the console's Settings, pushed from the gear in its header
// (the console's tabs are full). P0's Sign-in section first, then P5's Play section (the tiles), then
// Phase 63's Guest play (P16).
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/screen';
import { guestKey, playKey, signInSettingsKey } from './api';
import { GuestSettingsSection } from './guest-settings-section';
import { PlaySettingsSection } from './play-settings-section';
import { SignInSettingsSection } from './sign-in-settings-section';

export function PlatformSettingsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: signInSettingsKey }),
        queryClient.refetchQueries({ queryKey: playKey }),
        queryClient.refetchQueries({ queryKey: guestKey }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-platform-settings" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <SignInSettingsSection />
      <PlaySettingsSection />
      <GuestSettingsSection />
    </Screen>
  );
}
