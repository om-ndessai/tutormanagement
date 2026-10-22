// Ported from apps/web/src/features/quest/game-page.tsx @ cd0378d (working tree): Scoreboard and
// TeamRow.
//
// The teams of a game: their place once it is over (a crown for the first), the name, "(you)", a
// team's first names, and once it has begun the score and how far along the team is ("1/2", "Done",
// or in a timed game the count -- never "of 150": a timed game's series is only the most it draws).
// Mobile (design 60): each row is read as one line; your team is edged in the primary colour; a team
// that joins fades in and a new score bumps, both stilled under reduce motion. First names only
// (R20): the server sends nothing more.
import { placeLabel, type GameTeamView, type GameView } from '@tmi/shared';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Panel } from '@/components/section';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { seriesTotal, teamProgress, teamRowSpeech } from './game-model';

export function Scoreboard({ game, title }: { game: GameView; title: string }) {
  const theme = useAppTheme();
  const total = seriesTotal(game);
  const showScore = game.status !== 'lobby';
  return (
    <Panel title={title} testID="game-scoreboard">
      {game.teams.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Nobody has joined yet. Share the code.
        </Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {game.teams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              mine={team.id === game.me.team_id}
              total={total}
              showScore={showScore}
            />
          ))}
        </View>
      )}
    </Panel>
  );
}

function TeamRow({
  team,
  mine,
  total,
  showScore,
}: {
  team: GameTeamView;
  mine: boolean;
  total: number | null;
  showScore: boolean;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const muted = theme.tokens.mutedForeground;
  // A new score bumps.
  const scale = useSharedValue(1);
  const last = useRef(team.score);
  useEffect(() => {
    if (last.current === team.score) return;
    last.current = team.score;
    if (!reduced)
      scale.set(withSequence(withTiming(1.3, { duration: 140 }), withTiming(1, { duration: 200 })));
  }, [team.score, reduced, scale]);
  const bump = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      testID={`game-team-${team.name}`}
      entering={reduced ? undefined : FadeIn.duration(240)}
      layout={reduced ? undefined : LinearTransition}
      accessible
      accessibilityLabel={teamRowSpeech(team, { mine, total, showScore })}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: space.md,
        borderWidth: mine ? 2 : 1,
        borderColor: mine ? theme.colors.primary : theme.colors.outlineVariant,
        backgroundColor: mine ? withAlpha(theme.colors.primary, 0.06) : 'transparent',
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
      }}
    >
      {team.place !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 44, paddingTop: 2 }}>
          {team.place === 1 ? <Icon source="crown" size={14} color={theme.colors.primary} /> : null}
          <Text variant="labelMedium" style={{ fontWeight: '700' }}>
            {placeLabel(team.place)}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 120, gap: 2 }}>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {team.name}
          {mine ? <Text style={{ color: muted, fontWeight: '400' }}> (you)</Text> : null}
        </Text>
        {!team.solo ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            {team.players.map((p) => p.first_name).join(', ')}
          </Text>
        ) : null}
      </View>
      {showScore ? (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Animated.View style={bump}>
            <Text
              testID={`game-team-score-${team.name}`}
              variant="titleMedium"
              style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}
            >
              {team.score}
            </Text>
          </Animated.View>
          <Text variant="bodySmall" style={{ color: muted, fontVariant: ['tabular-nums'] }}>
            {teamProgress(team, total)}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
