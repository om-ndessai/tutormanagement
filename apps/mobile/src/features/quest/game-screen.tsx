// Ported from apps/web/src/features/quest/game-page.tsx @ cd0378d (working tree): GamePage.
//
// Phase 46: one Quest game, full screen -- the lobby while players join, the play with the
// scoreboard beside it, then the results. Polled every couple of seconds; the next question comes
// back with each answer. docs/quest-games-plan.md.
// Mobile (design 60): the `quest/games/[gameId]` full-screen modal, in Quest's frame (title, status,
// Exit); polled only while it is focused (and the app in front), never once finished. The status
// carries the clock of a timed game and your team's points once it has begun. A game you are not in
// answers 404 and reads as not found, never forbidden (R20). It opens no sheet (U3).
// Phase 47 (design 61): the doors' countdown over the whole frame, by the server's clock, while the
// first question's moment is still ahead -- the timed game's clock hidden until it opens, the body
// beneath hidden from a screen reader -- and, the moment it reaches 0, the game read at once rather than
// at the next poll.
import { useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Button, Portal, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { DetailSkeleton } from '@/components/skeletons';
import { radius, space } from '@/theme/tokens';
import { GameClock } from './game-clock';
import { DoorsCountdown, useGameCountdown } from './game-effects';
import { GameLobby } from './game-lobby';
import { MISSING_TEXT, gameTitle, scoreLabel } from './game-model';
import { GamePlay } from './game-play';
import { GameResults } from './game-results';
import { gameKeys, useGame } from './games-api';
import { QuestFrame, QuestStatus, exitQuest } from './quest-frame';

export function GameScreen({ gameId }: { gameId: string }) {
  const focused = useIsFocused();
  const query = useGame(gameId, focused);
  const game = query.data?.data;
  const myTeam = game?.teams.find((team) => team.id === game.me.team_id);
  const status = game?.status;
  const queryClient = useQueryClient();
  const refetch = query.refetch;
  const opened = useCallback(() => void refetch(), [refetch]);
  const countdown = useGameCountdown(game, query.dataUpdatedAt, opened);
  const counting = countdown > 0;

  // The hub stays mounted under this modal, with its list of games: a game that begins or ends by
  // someone else's hand (seen here by the poll) would still read "Playing now" there on Exit.
  useEffect(() => {
    if (status) void queryClient.invalidateQueries({ queryKey: gameKeys.list });
  }, [status, queryClient]);

  return (
    <QuestFrame
      title={gameTitle(game)}
      testID="screen-quest-game"
      status={
        game ? (
          <>
            {game.status === 'running' && game.ends_at && !counting ? (
              <GameClock endsAt={game.ends_at} serverNow={game.now} receivedAt={query.dataUpdatedAt} />
            ) : null}
            {myTeam && game.status !== 'lobby' ? (
              <QuestStatus testID="game-my-score" strong>
                {scoreLabel(myTeam.score)}
              </QuestStatus>
            ) : null}
          </>
        ) : null
      }
    >
      {query.isPending ? (
        <DetailSkeleton label="Loading the game…" rows={4} />
      ) : query.isError || !game ? (
        <OutlinedCard testID="game-missing" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, gap: space.lg }}>
            <Text variant="bodyLarge">{MISSING_TEXT}</Text>
            <Button
              testID="game-missing-back"
              mode="outlined"
              onPress={exitQuest}
              style={{ alignSelf: 'flex-start' }}
              contentStyle={{ minHeight: 48 }}
            >
              Back to Quest
            </Button>
          </View>
        </OutlinedCard>
      ) : (
        <View
          // Under the doors, the screen beneath is not read out.
          importantForAccessibility={counting ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={counting}
        >
          {game.status === 'lobby' ? (
            <GameLobby game={game} />
          ) : game.status === 'running' ? (
            <GamePlay game={game} counting={counting} />
          ) : (
            <GameResults game={game} />
          )}
        </View>
      )}
      {counting ? (
        <Portal>
          <DoorsCountdown msLeft={countdown} />
        </Portal>
      ) : null}
    </QuestFrame>
  );
}
