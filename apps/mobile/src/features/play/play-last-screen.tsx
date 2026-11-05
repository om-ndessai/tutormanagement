// Phase 62 (P6, docs/stickiness-plan.md): where the home-screen quick action lands.
//
// Phase 73 (JF13, owner 2026-11-05): it is Continue, from the server -- the open-game read, fresh (the icon's
// words may be a minute old): a game the reader is in (running or in its lobby) opens where they are; with none
// open, the last game's settings start again, the same one-request start as a tile; with neither, or a
// refusal, it says so and goes Home. Either way the game exits back Home (`from=home`).
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/state-views';
import { useCreateGame } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { openGameQuery } from './play-api';
import { continueAction, startRequest } from './play-model';

export const NOTHING_TO_CONTINUE = 'There is no quest to continue here yet.';

function openGame(gameId: string) {
  router.replace({ pathname: '/quest/games/[gameId]', params: { gameId, from: 'home' } });
}

export function PlayLastScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const create = useCreateGame();
  const [problem, setProblem] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const begun = useRef(false);

  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    void (async () => {
      try {
        const read = await queryClient.fetchQuery({ ...openGameQuery, staleTime: 0 });
        const next = continueAction(read.data);
        if (!next) {
          setProblem(NOTHING_TO_CONTINUE);
          return;
        }
        if (next.kind === 'open') {
          openGame(next.game_id);
          return;
        }
        setStarting(next.label);
        const game = await create.mutateAsync(startRequest(next.request));
        openGame(game.data.id);
      } catch (caught) {
        setProblem(caught instanceof ApiRequestError ? caught.message : 'That quest could not start.');
      }
    })();
  }, [queryClient, create]);

  return (
    <View
      testID="screen-quest-play-last"
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: space.xl,
        paddingBottom: insets.bottom + space.xl,
        backgroundColor: theme.colors.background,
        gap: space.lg,
      }}
    >
      {problem ? (
        <>
          <Text testID="play-last-problem" variant="titleMedium">
            {problem}
          </Text>
          <Button
            testID="play-last-home"
            mode="contained"
            onPress={() => router.replace('/dashboard')}
            style={{ alignSelf: 'flex-start' }}
          >
            Go Home
          </Button>
        </>
      ) : (
        <LoadingState label={starting ? `${starting.replace(/^Play /, 'Starting ').replace(/ again$/, '')}…` : 'Opening your quest…'} />
      )}
    </View>
  );
}
