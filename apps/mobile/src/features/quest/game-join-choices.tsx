// Ported from apps/web/src/features/quest/games-card.tsx @ cd0378d (working tree): JoinChoices.
//
// How to join (Phase 47, @ 9eccdf2 working tree): in a game of one-player teams, one "Join the game";
// in a game of teams, start a team -- which gets its own code to share -- or type a team's code, so a
// teammate types two codes, the game's then the team's (never "on my own"). In the join sheet and
// inline in the lobby (a full-screen game opens no sheet: design 60, U3). A team code that named the
// team offers that team only. Each choice is checked with the shared joinGameSchema before it is
// sent (a team name is refused if SSN-shaped); a refusal -- a full team, already in -- is the
// server's message, shown inline.
import { GAME_CODE_LENGTH, joinGameSchema, type GameLookup, type JoinGameInput } from '@tmi/shared';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiRequestError } from '@/lib/api-client';
import { space } from '@/theme/tokens';
import { gameCodeInput, gameCodeReady } from './game-model';
import { useJoinGame } from './games-api';
import { CODE_FONT } from './game-style';

export function JoinChoices({
  gameId,
  maxTeamSize,
  team,
  onJoined,
}: {
  gameId: string;
  maxTeamSize: number;
  /** The team a team code named: joining joins it. */
  team?: GameLookup['team'];
  /** After a join: the sheet gives way to the game; the lobby just carries on. */
  onJoined?: (gameId: string) => void;
}) {
  const join = useJoinGame();
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
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
          icon="account-group-outline"
          onPress={() => void go({ as: 'team', team_code: team.code })}
          disabled={join.isPending}
          loading={join.isPending}
          contentStyle={{ minHeight: 48 }}
        >
          {`Join ${team.name}`}
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

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <TextInput
          testID="game-team-name"
          mode="outlined"
          label="Team name"
          accessibilityLabel="Team name"
          value={teamName}
          onChangeText={setTeamName}
          maxLength={30}
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (teamName.trim()) void go({ as: 'new_team', team_name: teamName });
          }}
        />
        <Button
          testID="game-join-new-team"
          mode="outlined"
          disabled={!teamName.trim() || join.isPending}
          onPress={() => void go({ as: 'new_team', team_name: teamName })}
          contentStyle={{ minHeight: 48 }}
        >
          Start a team
        </Button>
      </View>
      <View style={{ gap: space.sm }}>
        <TextInput
          testID="game-team-code"
          mode="outlined"
          label="Team code"
          accessibilityLabel="Team code"
          value={teamCode}
          onChangeText={(text) => setTeamCode(gameCodeInput(text))}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
          maxLength={GAME_CODE_LENGTH + 4}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (gameCodeReady(teamCode)) void go({ as: 'team', team_code: teamCode });
          }}
          contentStyle={{ fontFamily: CODE_FONT, letterSpacing: 4 }}
        />
        <Button
          testID="game-join-team"
          mode="outlined"
          disabled={!gameCodeReady(teamCode) || join.isPending}
          onPress={() => void go({ as: 'team', team_code: teamCode })}
          contentStyle={{ minHeight: 48 }}
        >
          Join a team
        </Button>
      </View>
      {refused}
    </View>
  );
}
