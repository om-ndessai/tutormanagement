// Ported from apps/web/src/features/organizations/code-sheet.tsx @ 98c40ab (working tree): KeptForYou.
//
// What a signed-out visit left on this phone for the first home (UI audit JF4, JF9; owner 2026-11-04): a code typed
// ("You kept a code on this device: XXXX", Use it opens the "Have a code?" sheet on it), or a quest a friend sent
// that a guest could not play ("You were sent a quest: <name>", Play it starts it here). Offered once; "Not now"
// forgets both. Read from the phone's own memory only -- nothing of it was ever sent.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { guestMemory, guestMemoryReady, loadGuestMemory } from '@/features/guest/guest-store';
import { CODE_FONT } from '@/features/quest/game-style';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import { keptOffer } from './code-sheet-model';

/** Waits for the phone's guest memory (read once per run, at boot) before it is read. */
function useGuestMemoryLoaded(): boolean {
  const [ready, setReady] = useState(guestMemoryReady);
  useEffect(() => {
    if (ready) return;
    let live = true;
    void loadGuestMemory().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [ready]);
  return ready;
}

export function KeptForYou() {
  const theme = useAppTheme();
  const ready = useGuestMemoryLoaded();
  const [gone, setGone] = useState(false);
  if (!ready || gone) return null;
  const offer = keptOffer({ keptCode: guestMemory.keptCode(), sentTile: guestMemory.sentTile() });
  if (!offer) return null;

  function forget() {
    haptics.selection();
    guestMemory.dropCode();
    guestMemory.dropSent();
    setGone(true);
  }

  function use() {
    if (!offer) return;
    haptics.selection();
    guestMemory.dropSent();
    setGone(true);
    // The code is dropped by the sheet once it is looked up; a quest is started here.
    if (offer.kind === 'code') router.push({ pathname: '/have-a-code', params: { code: offer.code } });
    else router.push({ pathname: '/quest/tile/[code]', params: { code: offer.code } });
  }

  return (
    <OutlinedCard testID="home-kept" style={{ borderRadius: radius.lg, borderColor: theme.colors.primary }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.md }}>
        <Icon source="key-outline" size={20} color={theme.colors.primary} />
        <Text testID="home-kept-line" variant="bodyMedium" style={{ flex: 1, minWidth: 160 }}>
          {offer.kind === 'code' ? 'You kept a code on this device: ' : 'You were sent a quest: '}
          <Text style={offer.kind === 'code' ? { fontFamily: CODE_FONT, fontWeight: '700' } : { fontWeight: '700' }}>
            {offer.kind === 'code' ? offer.code : offer.name}
          </Text>
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button testID="home-kept-later" mode="text" compact onPress={forget} contentStyle={{ minHeight: 44 }}>
            Not now
          </Button>
          <Button testID="home-kept-use" mode="contained" compact onPress={use} contentStyle={{ minHeight: 44 }}>
            {offer.kind === 'code' ? 'Use it' : 'Play it'}
          </Button>
        </View>
      </View>
    </OutlinedCard>
  );
}
