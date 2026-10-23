// Ported from apps/web/src/features/quest/games-card.tsx @ cd0378d (working tree): JoinChoices.
//
// How to join (Phase 47, @ 9eccdf2 working tree): in a game of one-player teams, one "Join the game";
// in a game of teams, start a team -- which gets its own code to share -- or type a team's code, so a
// teammate types two codes, the game's then the team's (never "on my own"). In the join sheet and
// inline in the lobby (a full-screen game opens no sheet: design 60, U3). A team code that named the
// team offers that team only. Each choice is checked with the shared joinGameSchema before it is
// sent (a team name is refused if SSN-shaped); a refusal -- a full team, already in -- is the
// server's message, shown inline.
// Owner, 2026-10-23: one action, "Join the game". A player chooses Join a team or New team on a tab
// bar (New team first while the game has no teams); the host only ever starts a team. A new team's
// name is filled in as "Team <first name>".
import {
  GAME_CODE_LENGTH,
  defaultTeamName,
  joinGameSchema,
  type GameLookup,
  type JoinGameInput,
} from '@tmi/shared';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { SegmentedTabs } from '@/components/segmented-tabs';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { typedGameCode } from './game-model';
import { useJoinGame } from './games-api';
import { CODE_FONT } from './game-style';

type JoinTab = 'team' | 'new';

const JOIN_TABS = [
  { value: 'team', label: 'Join a team', icon: 'account-group-outline', testID: 'game-join-tab-team' },
  { value: 'new', label: 'New team', icon: 'account-multiple-plus-outline', testID: 'game-join-tab-new' },
] as const;

export function JoinChoices({
  gameId,
  maxTeamSize,
  team,
  host = false,
  teamCount = 0,
  onJoined,
}: {
  gameId: string;
  maxTeamSize: number;
  /** The team a team code named: joining joins it. */
  team?: GameLookup['team'];
  /** The game's host: they start a team, never join one. */
  host?: boolean;
  /** Teams in the game so far: with none, New team is the tab that opens. */
  teamCount?: number;
  /** After a join: the sheet gives way to the game; the lobby just carries on. */
  onJoined?: (gameId: string) => void;
}) {
  const join = useJoinGame();
  const { user } = useAuth();
  const [tab, setTab] = useState<JoinTab>(host || teamCount === 0 ? 'new' : 'team');
  const [teamName, setTeamName] = useState(() => defaultTeamName(user?.full_name));
  const [teamCode, setTeamCode] = useState('');
  const typedTeamCode = typedGameCode(teamCode);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function go(raw: JoinGameInput) {
    const parsed = joinGameSchema.safeParse(raw);
    if (!parsed.success) {
      setRefusal(parsed.error.issues[0]?.message ?? 'Could not join the game.');
      return;
    }
    setRefusal(null);
    try {
      await join.mutateAsync({ gameId, ...parsed.data });
      onJoined?.(gameId);
    } catch (caught) {
      setRefusal(caught instanceof ApiRequestError ? caught.message : 'Could not join the game.');
    }
  }

  const refused = refusal ? (
    <HelperText testID="game-join-refused" type="error" padding="none">
      {refusal}
    </HelperText>
  ) : null;

  if (team) {
    return (
      <View style={{ gap: space.md }}>
        <Text variant="bodyMedium">
          Join the team <Text style={{ fontWeight: '700' }}>{team.name}</Text> ({team.players} of{' '}
          {maxTeamSize} so far).
        </Text>
        <Button
          testID="game-join-team-named"
          mode="contained"
          icon="login"
          onPress={() => void go({ as: 'team', team_code: team.code })}
          disabled={join.isPending}
          loading={join.isPending}
          contentStyle={{ minHeight: 48 }}
        >
          Join the game
        </Button>
        {refused}
      </View>
    );
  }

  if (maxTeamSize === 1) {
    return (
      <View style={{ gap: space.md }}>
        <Button
          testID="game-join-solo"
          mode="contained"
          icon="login"
          onPress={() => void go({ as: 'solo' })}
          disabled={join.isPending}
          loading={join.isPending}
          contentStyle={{ minHeight: 48 }}
        >
          Join the game
        </Button>
        {refused}
      </View>
    );
  }

  const chosen: JoinGameInput | null =
    tab === 'new'
      ? teamName.trim()
        ? { as: 'new_team', team_name: teamName }
        : null
      : typedTeamCode
        ? { as: 'team', team_code: typedTeamCode }
        : null;
  const submit = () => {
    if (chosen && !join.isPending) void go(chosen);
  };

  return (
    <View style={{ gap: space.md }}>
      {host ? null : (
        <SegmentedTabs<JoinTab>
          tabs={JOIN_TABS}
          value={tab}
          onChange={(next) => {
            setRefusal(null);
            setTab(next);
          }}
          testID="game-join-tabs"
        />
      )}
      {tab === 'new' ? (
        <TextInput
          key="new"
          testID="game-team-name"
          mode="outlined"
          label="Team name"
          accessibilityLabel="Team name"
          value={teamName}
          onChangeText={setTeamName}
          maxLength={30}
          autoCorrect={false}
          selectTextOnFocus
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      ) : (
        <TextInput
          key="team"
          testID="game-team-code"
          mode="outlined"
          label="Team code"
          accessibilityLabel="Team code"
          value={teamCode}
          onChangeText={setTeamCode}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
          maxLength={GAME_CODE_LENGTH + 4}
          returnKeyType="go"
          onSubmitEditing={submit}
          contentStyle={{ fontFamily: CODE_FONT, letterSpacing: 4 }}
        />
      )}
      <Button
        testID="game-join-go"
        mode="contained"
        icon="login"
        disabled={!chosen || join.isPending}
        loading={join.isPending}
        onPress={submit}
        contentStyle={{ minHeight: 48 }}
      >
        Join the game
      </Button>
      {refused}
    </View>
  );
}
