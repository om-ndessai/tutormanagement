// Ported from apps/web/src/features/quest/game-page.tsx @ cd0378d (working tree): Results.
//
// The game is over: who won, the rules, the final places, and a team's questions with what it
// answered, the right answer and the solution -- your own team's, or for the host and admins any
// team's. Keys and solutions come only from /results, after the game (R20). Mobile (design 60): the
// questions one at a time in a single persistent KaTeX web view (a timed game can have 150), each with
// a native header carrying the outcome, who answered and the key (`reviewLine`), a strip of numbered
// chips coloured by outcome, and Previous / Next. On an iPad the places sit beside the questions.
// A first place is celebrated once, with the success haptic.
// Phase 47 (design 61): why it ended (a knockout in the error colour), a single player's "N right, M
// points", and for someone who played, the win or the web's encouragement. The celebration once per
// game per run of the app: on a knockout the K.O. stamp first, then -- for the winners (a single
// player: any right answer) -- the confetti and the success haptic once it fades. Reopening a finished
// game from the hub shows the words only.
import { gameEndLabel, type GameResultItem, type GameView } from '@tmi/shared';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, Chip, Portal, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { Panel } from '@/components/section';
import { DetailSkeleton } from '@/components/skeletons';
import { Confetti } from '@/features/home/confetti';
import { MathBody } from '@/features/question-bank/math-body';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { CHIP_HIT_SLOP, radius, space } from '@/theme/tokens';
import { gameResultHtml, gameResultSpeech, gameResultText } from './game-html';
import { GameRules } from './game-lobby';
import { KnockoutStamp } from './game-effects';
import {
  NO_ANSWERS_TEXT,
  celebrates,
  isOverseer,
  myTeam,
  outcomeLabel,
  resultsHeadline,
  resultsLine,
  reviewHeading,
  reviewLine,
} from './game-model';
import { Scoreboard } from './game-scoreboard';
import { useGameResults } from './games-api';
import { exitQuest } from './quest-frame';
import { questWide } from './quest-model';

/** Games already celebrated in this run of the app: once per game. */
const celebrated = new Set<string>();

/** A stable number from a game's id, for the confetti's pattern. */
function seedOf(id: string): number {
  let seed = 7;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 31 + id.charCodeAt(i)) % 233280;
  return seed;
}

export function GameResults({ game }: { game: GameView }) {
  const theme = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = questWide(width);
  const overseer = isOverseer(game);
  const [team, setTeam] = useState<string | null>(null);
  const results = useGameResults(game.id, team, true);
  const data = results.data?.data;
  const shownTeam = game.teams.find((t) => t.id === (data?.team_id ?? null));
  const mine = myTeam(game);
  const ending = gameEndLabel(game.end_reason);
  const knockout = game.end_reason === 'knockout';

  // The moment, once per game in this run of the app: the stamp (on a knockout), then the confetti.
  const [moment] = useState(() => !celebrated.has(game.id));
  const [stamped, setStamped] = useState(!knockout);
  const party = moment && stamped && celebrates(game);
  useEffect(() => {
    celebrated.add(game.id);
  }, [game.id]);
  useEffect(() => {
    if (party) haptics.success();
  }, [party]);

  const summary = (
    <View style={{ gap: space.lg, ...(wide ? { flex: 2 } : null) }}>
      <OutlinedCard style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Text
            variant="labelMedium"
            style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            The game is over
          </Text>
          {ending ? (
            <Text
              testID="game-end-reason"
              variant="titleSmall"
              style={{ fontWeight: '700', color: knockout ? theme.colors.error : theme.colors.onSurface }}
            >
              {ending}
            </Text>
          ) : null}
          <Text
            testID="game-winner"
            variant="headlineSmall"
            accessibilityRole="header"
            style={{ fontWeight: '700' }}
          >
            {resultsHeadline(game, mine)}
          </Text>
          {mine ? (
            <Text testID="game-encouragement" variant="bodyLarge">
              {resultsLine(game, mine)}
            </Text>
          ) : null}
          <GameRules game={game} />
        </View>
      </OutlinedCard>
      <Scoreboard game={game} title="Final places" />
      <Button
        testID="game-back"
        mode="outlined"
        onPress={exitQuest}
        style={{ alignSelf: 'flex-start' }}
        contentStyle={{ minHeight: 48 }}
      >
        Back to Quest
      </Button>
    </View>
  );

  const review = (
    <View style={wide ? { flex: 3 } : undefined}>
      <Panel title={reviewHeading(shownTeam?.name)} testID="game-review">
        <View style={{ gap: space.md }}>
          {overseer && game.teams.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {game.teams.map((t) => {
                const selected = t.id === data?.team_id;
                return (
                  <Chip
                    key={t.id}
                    testID={`game-review-team-${t.name}`}
                    selected={selected}
                    showSelectedCheck={false}
                    mode={selected ? 'flat' : 'outlined'}
                    onPress={() => {
                      haptics.selection();
                      setTeam(t.id);
                    }}
                    hitSlop={CHIP_HIT_SLOP}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    {t.name}
                  </Chip>
                );
              })}
            </View>
          ) : null}
          {results.isPending ? (
            <DetailSkeleton label="Loading the questions…" rows={3} />
          ) : !data || data.items.length === 0 ? (
            <Text
              testID="game-review-empty"
              variant="bodyMedium"
              style={{ color: theme.tokens.mutedForeground }}
            >
              {NO_ANSWERS_TEXT}
            </Text>
          ) : (
            <ResultPager key={data.team_id ?? 'none'} items={data.items} />
          )}
        </View>
      </Panel>
    </View>
  );

  const effects = (
    <>
      {moment && knockout && !stamped ? (
        <Portal>
          <KnockoutStamp onDone={() => setStamped(true)} />
        </Portal>
      ) : null}
      {party ? (
        <Portal>
          <Confetti testID="game-confetti" seed={seedOf(game.id)} fall={height + 40} />
        </Portal>
      ) : null}
    </>
  );

  return wide ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xl }}>
      {summary}
      {review}
      {effects}
    </View>
  ) : (
    <View style={{ gap: space.lg }}>
      {summary}
      {review}
      {effects}
    </View>
  );
}

/** One result at a time, in one web view: a native header, the chips, the page, Previous / Next. */
function ResultPager({ items }: { items: GameResultItem[] }) {
  const theme = useAppTheme();
  const [index, setIndex] = useState(0);
  const item = items[Math.min(index, items.length - 1)]!;
  const html = useMemo(
    () => gameResultHtml(item, { errorColor: theme.colors.error }),
    [item, theme.colors.error],
  );

  function tone(it: GameResultItem) {
    if (it.skipped)
      return { border: theme.colors.outline, fill: 'transparent', ink: theme.tokens.mutedForeground };
    if (it.correct)
      return {
        border: theme.colors.primary,
        fill: withAlpha(theme.colors.primary, 0.15),
        ink: theme.colors.primary,
      };
    return { border: theme.colors.error, fill: withAlpha(theme.colors.error, 0.12), ink: theme.colors.error };
  }

  const go = (next: number) => {
    haptics.selection();
    setIndex(next);
  };
  const current = tone(item);

  return (
    <View style={{ gap: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        {items.map((it, i) => {
          const t = tone(it);
          const selected = i === index;
          return (
            <Chip
              key={it.number}
              testID={`game-review-chip-${it.number}`}
              compact
              selected={selected}
              showSelectedCheck={false}
              onPress={() => go(i)}
              hitSlop={CHIP_HIT_SLOP}
              accessibilityLabel={`Question ${it.number}, ${outcomeLabel(it)}`}
              accessibilityState={{ selected }}
              style={{ borderWidth: selected ? 2 : 1, borderColor: t.border, backgroundColor: t.fill }}
              textStyle={{ color: t.ink, fontWeight: selected ? '700' : '400' }}
            >
              {String(it.number)}
            </Chip>
          );
        })}
      </ScrollView>
      <View
        testID={`game-review-${item.number}`}
        accessible
        accessibilityRole="header"
        accessibilityLabel={reviewLine(item)}
        style={{
          borderLeftWidth: 4,
          borderLeftColor: current.border,
          paddingLeft: space.md,
          gap: 2,
        }}
      >
        <Text variant="titleSmall" style={{ color: current.ink, fontWeight: '700' }}>
          {`Question ${item.number} · ${outcomeLabel(item)}${item.answered_by ? ` · ${item.answered_by}` : ''}`}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {reviewLine(item)
            .split(' · ')
            .filter((part) => part.startsWith('Answer'))
            .join(' · ')}
        </Text>
      </View>
      <MathBody
        testID="game-review-body"
        html={html}
        speech={gameResultSpeech(item)}
        plain={gameResultText(item)}
        contentKey={`${item.question.id}:${item.number}`}
        persistent
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Button
          testID="game-review-prev"
          mode="outlined"
          icon="chevron-left"
          disabled={index === 0}
          onPress={() => go(index - 1)}
          contentStyle={{ minHeight: 48 }}
        >
          Previous
        </Button>
        <Text variant="bodySmall" style={{ alignSelf: 'center', color: theme.tokens.mutedForeground }}>
          {`${index + 1} of ${items.length}`}
        </Text>
        <Button
          testID="game-review-next"
          mode="outlined"
          icon="chevron-right"
          contentStyle={{ minHeight: 48, flexDirection: 'row-reverse' }}
          disabled={index >= items.length - 1}
          onPress={() => go(index + 1)}
        >
          Next
        </Button>
      </View>
    </View>
  );
}
