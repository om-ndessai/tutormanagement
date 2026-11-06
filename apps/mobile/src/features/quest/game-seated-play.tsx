// Phase 77 (JF15, docs/journey-fixes-plan.md; owner 2026-11-05): a game on one device -- "Play with Ben on this
// device" for a child who does not sign in. The parent's game seats the child (`GameView.seats`, the host's view
// only) as a solo team of their own, and every team plays the same series, so this screen takes turns: the hand
// furthest behind, the child first on each question (`seatedTurn`). Each turn says whose it is in words ("Ben's
// turn", "Your turn") with the hand-over line ("Pass the device to Ben.", "Ben has answered: take the device back.") --
// the colour only follows the words -- and a child's answer goes with `as_user_id`, the server checking the seat, its
// notice naming the child ("Ben: Right! +1"). Both scores side by side by first name, the scoreboard below (the web's).
// Leaving and coming back lands on the same turn: it is read from the hands the server keeps. No key before the
// results (R20). The turn is announced to a screen reader, queued after the answer's notice; the hand-over's
// light haptic is stilled with the rest when haptics are off.
import type { GameView } from '@tmi/shared';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View, useWindowDimensions } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import {
  SEATED_WAITING_TEXT,
  WAITING_LABEL,
  handOverLine,
  scoreLabel,
  seatedReadyText,
  seatedScores,
  seatedTurn,
  seriesTotal,
  turnSpeech,
  turnTitle,
  type SeatTurn,
} from './game-model';
import { QuestionPanel, confirmEndGame } from './game-play';
import { Scoreboard } from './game-scoreboard';
import { useGameAction } from './games-api';
import { questWide } from './quest-model';
import { useQuestNotice } from './quest-notice';

/** Tells a screen reader whose turn it is now, after whatever it is saying (the answer's notice). */
function announce(text: string) {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  else AccessibilityInfo.announceForAccessibility(text);
}

export function SeatedPlay({ game, counting = false }: { game: GameView; counting?: boolean }) {
  const { width } = useWindowDimensions();
  const action = useGameAction(game.id);
  const notice = useQuestNotice();
  const wide = questWide(width);
  const turn = counting ? null : seatedTurn(game);
  const total = seriesTotal(game);

  // A new turn: announced, and -- when the device changes hands -- a light cue. Not on opening the game.
  const turnKey = turn ? `${turn.user_id ?? 'me'}:${turn.question.number}` : null;
  const previous = useRef<{ key: string | null; who: string | null } | null>(null);
  useEffect(() => {
    if (!turn || previous.current?.key === turnKey) return;
    const handOver = previous.current !== null && previous.current.who !== (turn.user_id ?? 'me');
    previous.current = { key: turnKey, who: turn.user_id ?? 'me' };
    if (handOver) haptics.impact();
    announce(turnSpeech(turn, game, total));
    // `turn` is read through its key: a poll that returns the same hand must not announce it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, total]);

  // On an iPad, one column of a readable width: the turn, the question and both scores belong together.
  return (
    <View style={{ gap: space.lg, ...(wide ? { width: '100%', maxWidth: 760, alignSelf: 'center' } : null) }}>
      <SeatedScores game={game} turn={turn} />
      {counting ? (
        <OutlinedCard testID="game-getting-ready" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg }}>
            <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
              {seatedReadyText(game)}
            </Text>
          </View>
        </OutlinedCard>
      ) : turn ? (
        <>
          <TurnCard turn={turn} game={game} />
          <QuestionPanel game={game} question={turn.question} asUserId={turn.user_id} />
        </>
      ) : (
        <SeatedWaiting />
      )}
      <Button
        testID="game-end"
        mode="outlined"
        icon="flag-checkered"
        onPress={() => confirmEndGame(game, action, notice)}
        disabled={action.isPending}
        style={{ alignSelf: 'flex-start' }}
        contentStyle={{ minHeight: 48 }}
      >
        End the quest now
      </Button>
      <Scoreboard game={game} title="Scores" />
    </View>
  );
}

/** Every hand on this device answered: the end is being written (the web's words). */
function SeatedWaiting() {
  const theme = useAppTheme();
  return (
    <OutlinedCard testID="game-waiting" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text
          variant="labelMedium"
          style={{ color: theme.tokens.mutedForeground, fontWeight: '700' }}
        >
          {WAITING_LABEL}
        </Text>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {SEATED_WAITING_TEXT}
        </Text>
      </View>
    </OutlinedCard>
  );
}

/** "Ben's turn" with "Pass the device to Ben.", or "Your turn" with "Ben has answered: take the device back.". */
function TurnCard({ turn, game }: { turn: SeatTurn; game: GameView }) {
  const theme = useAppTheme();
  const child = turn.user_id !== null;
  const fill = child ? theme.colors.primaryContainer : theme.colors.secondaryContainer;
  const ink = child ? theme.colors.onPrimaryContainer : theme.colors.onSecondaryContainer;
  return (
    <View
      testID="game-turn"
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${turnTitle(turn)}. ${handOverLine(turn, game)}`}
      // Android reads a change here as it happens; iOS is told by `announce`.
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        borderRadius: radius.lg,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: fill,
      }}
    >
      <Icon source={child ? 'hand-extended-outline' : 'account-outline'} size={28} color={ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text testID="game-turn-title" variant="headlineSmall" style={{ fontWeight: '700', color: ink }}>
          {turnTitle(turn)}
        </Text>
        <Text testID="game-hand-over" variant="bodyLarge" style={{ color: ink }}>
          {handOverLine(turn, game)}
        </Text>
      </View>
    </View>
  );
}

/** Both scores side by side, by first name, the one whose turn it is edged (and said: "Ben, 2 points, answering"). */
function SeatedScores({ game, turn }: { game: GameView; turn: SeatTurn | null }) {
  const theme = useAppTheme();
  const scores = seatedScores(game);
  const turnTeam = turn
    ? turn.user_id
      ? game.seats?.find((seat) => seat.user_id === turn.user_id)?.team_id
      : game.me.team_id
    : null;
  return (
    <View testID="game-seat-scores" style={{ flexDirection: 'row', gap: space.sm }}>
      {scores.map((row) => {
        const now = row.team_id === turnTeam;
        return (
          <View
            key={row.team_id}
            testID={`game-seat-score-${row.name}`}
            accessible
            accessibilityLabel={`${row.name}${row.mine ? ' (you)' : ''}, ${scoreLabel(row.score)}${now ? ', answering' : ''}`}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: radius.md,
              borderWidth: now ? 2 : 1,
              borderColor: now ? theme.colors.primary : theme.colors.outlineVariant,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              gap: 2,
            }}
          >
            <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
              {row.name}
              {row.mine ? <Text style={{ color: theme.tokens.mutedForeground, fontWeight: '400' }}> (you)</Text> : null}
            </Text>
            <Text
              testID={`game-seat-score-value-${row.name}`}
              variant="headlineSmall"
              style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}
            >
              {row.score}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
