// Ported from apps/web/src/features/quest/games-card.tsx @ cd0378d (working tree): GamesCard's
// join() and JoinDialog.
//
// Phase 46: a code typed on the Quest page, looked up -- a game's (then on my own / start a team / a
// team's code) or a team's (then that team). docs/quest-games-plan.md.
// Mobile (design 60): the `quest/join-game?code=` form sheet, fitted to what it holds. It runs the
// lookup itself on opening (one POST), so a refused code is said here (`game-join-error`, the
// server's words). Someone already in the game goes straight to it; joining gives way to the game.
// Phase 47 (design 61): the lookup's `players` and `open` decide it -- a single player's game is never
// joinable, a running one only while its host left joining open (said above the choices).
import { gameCodeSchema, gameLengthLabel, gameLevelLabel, levelLabel, type GameLookup } from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailSkeleton } from '@/components/skeletons';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { JOIN_RUNNING_TEXT, joinClosedText, lookupLine } from './game-model';
import { JoinChoices } from './game-join-choices';
import { useLookupGame } from './games-api';

function openGame(gameId: string) {
  router.replace({ pathname: '/quest/games/[gameId]', params: { gameId } });
}

export function JoinGameSheet({ code }: { code: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const lookup = useLookupGame();
  const [found, setFound] = useState<GameLookup | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const asked = useRef(false);
  // A code that is not six characters is refused here, without asking the server.
  const parsed = gameCodeSchema.safeParse({ code });
  const invalid = parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? 'A code is six letters and numbers.');
  const valid = parsed.success ? parsed.data.code : null;
  const problem = invalid ?? refusal;
  const closed = found ? joinClosedText(found) : null;

  useEffect(() => {
    if (asked.current || valid === null) return;
    asked.current = true;
    lookup
      .mutateAsync(valid)
      .then((result) => {
        if (result.data.joined) openGame(result.data.game_id);
        else setFound(result.data);
      })
      .catch((caught: unknown) =>
        setRefusal(caught instanceof ApiRequestError ? caught.message : 'Could not find that code.'),
      );
  }, [valid, lookup]);

  return (
    <ScrollView
      testID="screen-quest-join-game"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingTop: space.xl,
        paddingHorizontal: space.lg,
        paddingBottom: insets.bottom + space.lg,
        gap: space.lg,
      }}
      alwaysBounceVertical={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      nestedScrollEnabled
    >
      {problem ? (
        <View style={{ gap: space.md }}>
          <Text variant="titleLarge" accessibilityRole="header">
            Join a game
          </Text>
          <HelperText testID="game-join-error" type="error" padding="none" style={{ fontSize: 16 }}>
            {problem}
          </HelperText>
          <Button
            testID="game-join-close"
            mode="outlined"
            onPress={() => (router.canGoBack() ? router.back() : undefined)}
            style={{ alignSelf: 'flex-start' }}
            contentStyle={{ minHeight: 48 }}
          >
            Close
          </Button>
        </View>
      ) : !found ? (
        <DetailSkeleton label="Looking up the code…" rows={3} />
      ) : (
        <>
          <View style={{ gap: space.xs }}>
            <Text variant="titleLarge" accessibilityRole="header" testID="game-join-title">
              {`${gameLevelLabel(found, levelLabel)} · ${gameLengthLabel(found)}`}
            </Text>
            <Text
              testID="game-join-line"
              variant="bodyMedium"
              style={{ color: theme.tokens.mutedForeground }}
            >
              {lookupLine(found)}
            </Text>
          </View>
          {closed ? (
            <Text testID="game-join-closed" variant="bodyMedium">
              {closed}
            </Text>
          ) : (
            <>
              {found.status === 'running' ? (
                <Text testID="game-join-running" variant="bodyMedium">
                  {JOIN_RUNNING_TEXT}
                </Text>
              ) : null}
              <JoinChoices
                gameId={found.game_id}
                maxTeamSize={found.max_team_size}
                team={found.team}
                onJoined={openGame}
              />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
