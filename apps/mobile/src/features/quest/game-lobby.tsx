// Ported from apps/web/src/features/quest/game-page.tsx @ cd0378d (working tree): Lobby, Rules and
// CopyButton.
//
// A game waiting to begin: its code, large, to share; the rules; your team's own code once you started
// or joined one; how to join while you are not in it; the host's Begin (once someone has joined) and
// Cancel; Leave for a player; and the teams arriving. Mobile (design 60): Share opens the system share
// sheet with the code and nothing else (no name); the join choices are inline (a full-screen game
// opens no sheet, U3); Cancel asks first, natively. Leaving goes back to the hub with "You left the
// game.". On an iPad the code and the choices sit beside the teams. Phase 47 (design 61): the label is
// "Game code" (owner, 2026-10-23), the host joins by starting a team, the host's action is "Start the Quest", and the board counts the places taken.
import type { GameView } from '@tmi/shared';
import { Share, View, useWindowDimensions } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { JoinChoices } from './game-join-choices';
import {
  LOBBY_LABEL,
  gameRulesLine,
  lobbyBoardTitle,
  playerCount,
  shareText,
  spelledCode,
} from './game-model';
import { confirmEnd } from './game-play';
import { Scoreboard } from './game-scoreboard';
import { CODE_FONT } from './game-style';
import { useGameAction } from './games-api';
import { exitQuest } from './quest-frame';
import { questWide } from './quest-model';
import { useQuestNotice } from './quest-notice';

const message = (caught: unknown, fallback: string) =>
  caught instanceof ApiRequestError ? caught.message : fallback;

export function GameRules({ game }: { game: GameView }) {
  const theme = useAppTheme();
  return (
    <Text testID="game-rules" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
      {gameRulesLine(game)}
    </Text>
  );
}

export function GameLobby({ game }: { game: GameView }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const action = useGameAction(game.id);
  const notice = useQuestNotice();
  const toast = useToast();
  const wide = questWide(width);
  const players = playerCount(game);
  const mine = game.teams.find((team) => team.id === game.me.team_id);

  async function run(kind: 'start' | 'leave' | 'end') {
    try {
      const reply = await action.mutateAsync({ kind });
      // Having left, a player may no longer see the game (the reply is null; an admin's is the game
      // without them): back to the hub, which says so. A host who leaves their team stays to run it.
      const gone = reply.data === null || (!reply.data.is_host && reply.data.me.team_id === null);
      if (kind === 'leave' && gone) {
        exitQuest();
        toast.success('You left the game.');
      }
    } catch (caught) {
      notice.error(message(caught, 'That did not work.'));
    }
  }

  function cancel() {
    confirmEnd({
      title: 'Cancel the game?',
      body: 'Nobody will be able to play it.',
      confirm: 'Cancel the game',
      keep: 'Keep the game',
      onConfirm: () => void run('end'),
    });
  }

  const card = (
    <OutlinedCard style={{ borderRadius: radius.lg, ...(wide ? { flex: 3 } : null) }}>
      <View style={{ padding: space.lg, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text
            variant="labelMedium"
            style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {LOBBY_LABEL}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
            <Text
              testID="game-lobby-code"
              variant="displayMedium"
              accessibilityLabel={`Game code: ${spelledCode(game.code)}`}
              style={{ fontFamily: CODE_FONT, fontWeight: '700', letterSpacing: 6 }}
              selectable
            >
              {game.code}
            </Text>
            <IconButton
              testID="game-share"
              icon="share-variant-outline"
              accessibilityLabel="Share the code"
              mode="outlined"
              onPress={() => void Share.share({ message: shareText(game.code) }).catch(() => undefined)}
            />
          </View>
          <GameRules game={game} />
        </View>

        {mine?.code ? (
          <View
            style={{
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              backgroundColor: withAlpha(theme.colors.primary, 0.1),
            }}
          >
            <Text variant="bodyMedium">
              Your team <Text style={{ fontWeight: '700' }}>{mine.name}</Text>’s code:{' '}
              <Text
                testID="game-team-code-shown"
                accessibilityLabel={spelledCode(mine.code)}
                style={{ fontFamily: CODE_FONT, fontWeight: '700', letterSpacing: 3 }}
                selectable
              >
                {mine.code}
              </Text>
              . Teammates type it to join you.
            </Text>
          </View>
        ) : null}

        {!mine ? (
          <View style={{ gap: space.sm }}>
            <Text variant="titleSmall" accessibilityRole="header">
              Join this game
            </Text>
            <JoinChoices
              gameId={game.id}
              maxTeamSize={game.max_team_size}
              host={game.is_host}
              teamCount={game.teams.length}
            />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {game.is_host ? (
            <Button
              testID="game-start"
              mode="contained"
              icon="play"
              onPress={() => void run('start')}
              disabled={players === 0 || action.isPending}
              contentStyle={{ minHeight: 52 }}
            >
              Start the Quest
            </Button>
          ) : null}
          {mine ? (
            <Button
              testID="game-leave"
              mode="outlined"
              onPress={() => void run('leave')}
              disabled={action.isPending}
              contentStyle={{ minHeight: 48 }}
            >
              Leave
            </Button>
          ) : null}
          {game.is_host ? (
            <Button
              testID="game-cancel"
              mode="text"
              onPress={cancel}
              disabled={action.isPending}
              contentStyle={{ minHeight: 48 }}
            >
              Cancel the game
            </Button>
          ) : null}
        </View>
        {!game.is_host ? (
          <Text
            testID="game-waiting-host"
            variant="bodyMedium"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {`Waiting for ${game.host.first_name} to begin…`}
          </Text>
        ) : null}
      </View>
    </OutlinedCard>
  );

  const board = (
    <View style={wide ? { flex: 2 } : undefined}>
      <Scoreboard game={game} title={lobbyBoardTitle(game)} />
    </View>
  );

  return wide ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xl }}>
      {card}
      {board}
    </View>
  ) : (
    <View style={{ gap: space.lg }}>
      {card}
      {board}
    </View>
  );
}
