// Ported from apps/web/src/features/guest/play-link.tsx @ 0e3ec7a (working tree). Phase 63 (P14):
// `/play/<code>` -- a tile in one tap, from the Play home or a link (`aimtrue://play/G4Q5`, which
// expo-router maps here). A guest plays it on the phone while it is open to guests; a member's tap
// starts it as a single player's game in their space; anything else lands on the home.
// Phase 72 (UI audit JF9): a friend's link to a tile guests cannot play is kept on the phone (`keepSent`), named on
// the guest page and offered on the first home after sign-up, rather than dropped.
import { parseTileCode, tileCode, tileGameRequest, tileWords, type QuestionBankLevelId } from '@tmi/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { LoadingState } from '@/components/state-views';
import { useRememberLastQuest } from '@/features/play/play-api';
import { startRequest } from '@/features/play/play-model';
import { useCreateGame } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { GuestAssessment } from './guest-assessment';
import { GuestQuest } from './guest-quest';
import { todayTile } from './guest-model';
import { guestMemory, loadGuestMemory, readQuestState } from './guest-store';

/** Waits for the phone's guest memory (read once per run) before anything that reads it draws. */
export function useGuestMemoryReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadGuestMemory().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

export function PlayLink() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { status, config, organization } = useAuth();
  const ready = useGuestMemoryReady();
  const shape = parseTileCode(code);
  // Opened as a guest: it stays the guest's quest, through a sign-up over it and on to its results
  // (P13: back where they were). Opened signed in: a quest left unfinished in this run goes on, as on
  // the web; anything else starts the member's game.
  const [openedAsGuest] = useState(() => status !== 'authenticated');
  if (!ready) return <LoadingState />;
  if (!shape) return <Redirect href="/" />;
  const tileId = tileCode(shape);
  const tile = config?.guest?.tiles.find((t) => t.code === tileId && !t.locked);
  const playing = readQuestState(tileId);
  if (status === 'authenticated' && !openedAsGuest && !(tile && playing && !playing.finished)) {
    if (!organization) return <Redirect href="/" />;
    return <Redirect href={{ pathname: '/quest/tile/[code]', params: { code: tileId } }} />;
  }
  if (!tile) {
    // Signed out: kept for the guest page and the first home (idempotent: the same code is not written twice).
    if (status !== 'authenticated') guestMemory.keepSent(tileId);
    return <Redirect href="/" />;
  }
  // P11: an assessment tile is the guest Assessment, on the phone.
  if (tile.kind === 'assessment') return <GuestAssessment key={tile.code} tile={tile} />;
  return <GuestQuest key={tile.code} tile={tile} />;
}

/**
 * `/play/today?level=NC26.4`: the landing's Today's 5, the guest quest of that day's five. Only for a
 * level with a quest open to guests (the card's own); anything else lands on the home.
 */
export function TodayLink() {
  const { level = '' } = useLocalSearchParams<{ level: string }>();
  const { config } = useAuth();
  const ready = useGuestMemoryReady();
  if (!ready) return <LoadingState />;
  const open = config?.guest?.tiles.some((t) => !t.locked && t.kind === 'quest' && t.level_id === level);
  if (!open) return <Redirect href="/" />;
  const tile = todayTile(level as QuestionBankLevelId);
  return <GuestQuest key={tile.code} tile={tile} today />;
}

/** A member arriving from a tile link: the tile starts as a single player's game in their space. */
export function MemberTileStart() {
  const theme = useAppTheme();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { organization } = useAuth();
  const create = useCreateGame();
  const remember = useRememberLastQuest(organization?.slug);
  const [refusal, setRefusal] = useState<string | null>(null);
  const started = useRef(false);
  const shape = parseTileCode(code);

  useEffect(() => {
    if (!shape || started.current) return;
    started.current = true;
    const request = tileGameRequest(shape);
    create
      .mutateAsync(startRequest(request))
      .then((game) => {
        remember({ label: tileCode(shape), request });
        router.replace({ pathname: '/quest/games/[gameId]', params: { gameId: game.data.id, from: 'home' } });
      })
      .catch((caught: unknown) =>
        setRefusal(caught instanceof ApiRequestError ? caught.message : 'That quest could not start.'),
      );
  }, [shape, create, remember]);

  if (!shape) return <Redirect href="/" />;
  return (
    <View
      testID="screen-quest-tile"
      style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg, backgroundColor: theme.colors.background }}
    >
      {refusal ? (
        <>
          <Text testID="quest-tile-refusal" variant="bodyLarge">
            {refusal}
          </Text>
          <Button mode="contained" onPress={() => router.replace('/')}>
            Home
          </Button>
        </>
      ) : (
        <Text variant="bodyLarge" style={{ textAlign: 'center' }}>
          {`Starting ${tileCode(shape)} · ${tileWords(shape)}…`}
        </Text>
      )}
    </View>
  );
}
