// Phase 62 (P6, docs/stickiness-plan.md): where the "Play <tile>" quick action lands. It starts the
// last quest started in this space on this phone -- the same one-tap request as Continue on the Play
// home -- and gives way to the game. With nothing remembered (another phone, a cleared app), or a
// refusal, it says so and goes Home.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/state-views';
import { useCreateGame } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useLastQuest, useRememberLastQuest } from './play-api';
import { startRequest } from './play-model';

export function PlayLastScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { organization } = useAuth();
  const last = useLastQuest(organization?.slug);
  const remember = useRememberLastQuest(organization?.slug);
  const create = useCreateGame();
  const [refusal, setRefusal] = useState<string | null>(null);
  // Nothing kept on this phone (another phone, a cleared app): said, and nothing is started.
  const nothingKept = last.isSuccess && !last.data;
  const problem = refusal ?? (nothingKept ? 'There is no quest to continue on this phone yet.' : null);
  const started = useRef(false);

  useEffect(() => {
    const quest = last.data;
    if (started.current || !quest) return;
    started.current = true;
    create
      .mutateAsync(startRequest(quest.request))
      .then((game) => {
        remember(quest);
        router.replace({ pathname: '/quest/games/[gameId]', params: { gameId: game.data.id, from: 'home' } });
      })
      .catch((caught: unknown) =>
        setRefusal(caught instanceof ApiRequestError ? caught.message : 'That quest could not start.'),
      );
  }, [last.data, create, remember]);

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
        <LoadingState label={last.data ? `Starting ${last.data.label}…` : 'Starting…'} />
      )}
    </View>
  );
}
