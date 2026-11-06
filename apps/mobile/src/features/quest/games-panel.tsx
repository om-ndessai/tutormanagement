// Ported from apps/web/src/features/quest/games-card.tsx @ cd0378d (working tree): GamesCard.
//
// Phase 46: Quest Games on the Quest page -- for everyone in the organization. Start a game, or type a
// code to join one. docs/quest-games-plan.md.
// Mobile (design 60): a Panel on the Quest hub. Start a game opens `quest/new-game`; a code
// (tidied as it is typed, six readable characters) opens the `quest/join-game` sheet, which looks it
// up itself, so a refused code is said there. The recent games are list rows into the game screen;
// with none, no list (as on the web). Phase 47 (design 61): New Quest (owner, 2026-10-23) opens the wizard
// (a card rising from the bottom); a row says a Random level's scope and "Single player".
// Phase 73 (JF32): a row leads with the game in words ("Grade 6 Quick 2"); its code follows, small.
import { GAME_CODE_LENGTH } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Divider, Text, TextInput } from 'react-native-paper';

import { ListItem } from '@/components/list-item';
import { Panel } from '@/components/section';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { CODE_FONT } from './game-style';
import { gameRowHost, gameRowStatus, gameRowTitle, typedGameCode } from './game-model';
import { useGames } from './games-api';

export function GamesPanel() {
  const theme = useAppTheme();
  const games = useGames();
  const [code, setCode] = useState('');
  const rows = games.data?.data ?? [];
  const typed = typedGameCode(code);
  const ready = typed !== null;

  function join() {
    if (!typed) return;
    router.push({ pathname: '/quest/join-game', params: { code: typed } });
    setCode('');
  }

  return (
    <Panel title="Games" testID="quest-games">
      <View style={{ gap: space.md }}>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Play the question bank together. Start a game and share its code, or type a code to join, on your
          own or in a team.
        </Text>
        <Button
          testID="game-new"
          mode="contained"
          icon="plus"
          onPress={() => router.push('/quest/new-game')}
          contentStyle={{ minHeight: 48 }}
          style={{ alignSelf: 'flex-start' }}
        >
          New Quest
        </Button>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          <TextInput
            testID="game-code"
            mode="outlined"
            label="Game or team code"
            accessibilityLabel="Game or team code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            // Android's keyboard would offer words; this one does not.
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            maxLength={GAME_CODE_LENGTH + 4}
            returnKeyType="go"
            onSubmitEditing={join}
            style={{ flexGrow: 1, minWidth: 180 }}
            contentStyle={{ fontFamily: CODE_FONT, letterSpacing: 4, fontSize: 18 }}
          />
          <Button
            testID="game-join"
            mode="outlined"
            icon="login"
            disabled={!ready}
            onPress={join}
            contentStyle={{ minHeight: 48 }}
          >
            Join
          </Button>
        </View>
        {rows.length > 0 ? (
          <View
            testID="game-list"
            style={{
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
              borderRadius: radius.md,
              overflow: 'hidden',
            }}
          >
            {rows.map((game, index) => (
              <View key={game.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  testID={`game-row-${game.code}`}
                  title={gameRowTitle(game)}
                  titleStyle={{ fontWeight: '600' }}
                  // Phase 77 (JF15): a game on one device has no code anyone could use, so none is shown.
                  description={game.seated ? gameRowHost(game) : `${gameRowHost(game)} · ${game.code}`}
                  accessibilityLabel={
                    game.seated
                      ? `${gameRowTitle(game)}, ${gameRowHost(game)}, ${gameRowStatus(game)}`
                      : `${gameRowTitle(game)}, ${gameRowHost(game)}, code ${game.code}, ${gameRowStatus(game)}`
                  }
                  onPress={() =>
                    router.push({ pathname: '/quest/games/[gameId]', params: { gameId: game.id } })
                  }
                  right={() => (
                    <Text
                      testID={`game-row-status-${game.code}`}
                      variant="labelMedium"
                      style={{ alignSelf: 'center', color: theme.colors.onSurface }}
                    >
                      {gameRowStatus(game)}
                    </Text>
                  )}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Panel>
  );
}
