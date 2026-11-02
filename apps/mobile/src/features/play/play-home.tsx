// Ported from apps/web/src/features/play/play-home.tsx @ 0e3ec7a (working tree). Phase 62 (P6-P8,
// docs/stickiness-plan.md): the members' Play home -- Continue, Favorites, Waiting for you, the tiles
// grouped by curriculum and "Have a code?", every one a quest in one tap. The same copy, testIDs and
// requests as the web.
//
// Mobile: a code (six characters) and a waiting game's Join open the existing `quest/join-game` sheet,
// which looks the code up and offers the join choices (JoinChoices), so there is one join path. The
// roster is a Paper dialog of tick rows. A tile is a card of two targets: the code starts it, the star
// keeps it as a favorite named by its code.
//
// Phase 64 (P17-P20): My progress under Continue, "Today's Daily · <tag>D" (while the console has the
// Daily on) for the level last played or the first tile's, and a tile's "Best N".
import {
  tileGameRequest,
  gameLengthLabel,
  levelLabel,
  type CreateGameRequest,
  type GameFavorite,
  type MemberTile,
} from '@tmi/shared';
import { router, useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { BadgePill } from '@/components/badge-pill';
import { CheckRow } from '@/components/check-row';
import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { useHabit } from '@/features/habit/api';
import { MyProgressCard } from '@/features/habit/my-progress-card';
import { dailyButtonLabel, dailyTileFor } from '@/features/habit/habit-model';
import { useAskToJoin } from '@/features/organizations/api';
import { CODE_FONT } from '@/features/quest/game-style';
import { useCreateGame, useGameFavorites, useSaveGameFavorite } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import {
  useCarryGuestTiles,
  useGuestLeadLevel,
  useLastQuest,
  useMemberTiles,
  useRememberLastQuest,
  useRosterMembers,
  useWaitingGames,
} from './play-api';
import { codeKind, groupTiles, rosterSavedText, startRequest, tidyCode } from './play-model';

const failure = (caught: unknown, fallback: string) =>
  caught instanceof ApiRequestError ? caught.message : fallback;

function openGame(gameId: string) {
  // `from=home`: the game's Exit comes back here, where Continue is.
  router.push({ pathname: '/quest/games/[gameId]', params: { gameId, from: 'home' } });
}

function joinByCode(code: string) {
  router.push({ pathname: '/quest/join-game', params: { code } });
}

/** One tap: the game is made (and begun, a single player's), remembered for Continue, and opened. */
export function useStartQuest() {
  const create = useCreateGame();
  const toast = useToast();
  const { organization } = useAuth();
  const remember = useRememberLastQuest(organization?.slug);
  async function start(label: string, request: CreateGameRequest, roster?: string[] | null) {
    haptics.selection();
    try {
      // Phase 62 (P7): from a multiplayer favorite the host is in the game from the start; (P8) its
      // roster's people are invited and see it under "Waiting for you".
      const game = await create.mutateAsync(startRequest(request, roster));
      remember({ label, request });
      openGame(game.data.id);
    } catch (caught) {
      haptics.error();
      toast.error(failure(caught, 'That quest could not start.'));
    }
  }
  return { start, pending: create.isPending };
}

function GroupHeading({ children }: { children: string }) {
  const theme = useAppTheme();
  return (
    <Text
      variant="labelMedium"
      accessibilityRole="header"
      style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
}

/**
 * Phase 62 (P6): the members' Play home. The home of a space without Tutoring, and of a student
 * anywhere. Nothing at all while the console has the Play home off (`play_home: false`).
 */
export function PlayHome() {
  const theme = useAppTheme();
  const toast = useToast();
  const { organization } = useAuth();
  const tiles = useMemberTiles();
  const favorites = useGameFavorites();
  const saveFavorite = useSaveGameFavorite();
  const lastQuest = useLastQuest(organization?.slug);
  const last = lastQuest.data ?? null;
  const { start, pending } = useStartQuest();
  // Two tiles a row on a phone, three or four on a tablet; the percentages leave room for the gaps.
  const { width } = useWindowDimensions();
  const tileWidth = width >= 1000 ? '23.5%' : width >= 700 ? '31.5%' : '48.5%';

  // Phase 64: My progress is read beside the tiles, and the home waits for it to settle (or fail), so
  // the card never arrives later and pushes the tiles down under a finger (or a test's tap).
  const habit = useHabit();
  const guestLead = useGuestLeadLevel();
  useCarryGuestTiles(guestLead.isSuccess, tiles.data?.data.tiles, favorites.data?.data);

  if (!tiles.data || !tiles.data.data.play_home || habit.isPending || guestLead.isPending || lastQuest.isLoading)
    return null;
  // The level last played here leads; before any, a guest's grade on this phone (P13).
  const lead = last?.request.level_id ?? guestLead.data ?? null;
  const groups = groupTiles(tiles.data.data.tiles, lead);
  // Phase 64 (P19): the Daily of that level, else of the first tile's.
  const dailyTile = dailyTileFor(tiles.data.data.tiles, lead);
  const starred = new Set((favorites.data?.data ?? []).map((favorite) => favorite.name));

  async function star(tile: MemberTile) {
    haptics.selection();
    try {
      await saveFavorite.mutateAsync({ name: tile.code, config: tileGameRequest(tile) });
      haptics.success();
      toast.success(`${tile.code} is in your favorites.`);
    } catch (caught) {
      toast.error(failure(caught, 'Could not save that favorite.'));
    }
  }

  return (
    <View testID="play-home" style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="titleLarge" accessibilityRole="header" style={{ flex: 1, fontWeight: '600' }}>
          Play
        </Text>
        <Button
          testID="play-new"
          mode="outlined"
          compact
          icon="plus"
          onPress={() => router.push('/quest/new-game')}
        >
          New Quest
        </Button>
      </View>

      {last ? (
        <Button
          testID="play-continue"
          mode="contained"
          icon="play"
          disabled={pending}
          onPress={() => void start(last.label, last.request)}
          contentStyle={{ minHeight: 52, justifyContent: 'flex-start' }}
        >
          {`Continue ${last.label}`}
        </Button>
      ) : null}

      {/* Phase 64 (P17-P18): the streak, today's ring and the badges. */}
      <MyProgressCard />

      {dailyTile && tiles.data.data.daily ? (
        <Button
          testID="play-daily"
          mode="outlined"
          icon="calendar-check"
          onPress={() => {
            haptics.selection();
            router.push({ pathname: '/quest/daily/[level]', params: { level: dailyTile.level_id } });
          }}
          contentStyle={{ minHeight: 48, justifyContent: 'flex-start' }}
        >
          {dailyButtonLabel(dailyTile.level_id)}
        </Button>
      ) : null}

      <PlayFavorites />

      <WaitingForYou />

      {groups.map(([group, groupTiles]) => (
        <View key={group} style={{ gap: space.sm }}>
          <GroupHeading>{group}</GroupHeading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {groupTiles.map((tile) => {
              const isStarred = starred.has(tile.code);
              return (
                // A plain View holds the column's width: Paper's Card splits its style between an
                // outer shadow view and an inner one on iOS, where a flexBasis on it squeezed the
                // tiles into four narrow columns.
                <View key={tile.code} style={{ width: tileWidth }}>
                  <OutlinedCard testID={`play-tile-${tile.code}`} style={{ borderRadius: radius.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Pressable
                        testID={`play-tile-start-${tile.code}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Start ${tile.code}: ${tile.words}`}
                        disabled={pending}
                        onPress={() => void start(tile.code, tileGameRequest(tile))}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: MIN_TARGET + space.lg,
                          padding: space.md,
                          gap: 2,
                          borderRadius: radius.lg,
                          backgroundColor: pressed ? theme.tokens.muted : undefined,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                          <Text variant="titleMedium" style={{ fontFamily: CODE_FONT, fontWeight: '700' }}>
                            {tile.code}
                          </Text>
                          {tile.beta ? <BadgePill testID={`play-tile-beta-${tile.code}`} /> : null}
                        </View>
                        <Text
                          variant="bodySmall"
                          numberOfLines={2}
                          style={{ color: theme.tokens.mutedForeground }}
                        >
                          {tile.words}
                        </Text>
                        {/* Phase 64 (P20): the reader's best score of this tile's shape. */}
                        {tile.best != null ? (
                          <Text
                            testID={`play-best-${tile.code}`}
                            variant="labelMedium"
                            style={{ color: theme.colors.primary, fontWeight: '600' }}
                          >
                            {`Best ${tile.best}`}
                          </Text>
                        ) : null}
                      </Pressable>
                      <IconButton
                        testID={`play-tile-star-${tile.code}`}
                        icon={isStarred ? 'star' : 'star-outline'}
                        size={20}
                        iconColor={isStarred ? theme.colors.primary : theme.tokens.mutedForeground}
                        accessibilityLabel={
                          isStarred ? `${tile.code} is a favorite` : `Add ${tile.code} to favorites`
                        }
                        accessibilityState={{
                          selected: isStarred,
                          disabled: isStarred || saveFavorite.isPending,
                        }}
                        disabled={isStarred || saveFavorite.isPending}
                        onPress={() => void star(tile)}
                      />
                    </View>
                  </OutlinedCard>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <HaveACode />
    </View>
  );
}

/** One box for both codes: six characters is a game here, eight a space to ask to join. */
export function HaveACode() {
  const theme = useAppTheme();
  const toast = useToast();
  const ask = useAskToJoin();
  const [code, setCode] = useState('');
  const kind = codeKind(code);

  async function go() {
    if (!kind) return;
    const typed = tidyCode(code);
    if (kind === 'game') {
      joinByCode(typed);
      setCode('');
      return;
    }
    try {
      await ask.mutateAsync(typed);
      haptics.success();
      toast.success('Asked to join. Its admins will let you in.');
      setCode('');
    } catch (caught) {
      toast.error(failure(caught, 'Could not find that code.'));
    }
  }

  return (
    <OutlinedCard testID="play-code-card" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text variant="titleSmall" accessibilityRole="header">
          Have a code?
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          <TextInput
            testID="play-code"
            mode="outlined"
            label="Game or space code"
            accessibilityLabel="Game or space code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={() => void go()}
            style={{ flexGrow: 1, minWidth: 180 }}
            contentStyle={{ fontFamily: CODE_FONT, letterSpacing: 3, fontSize: 18 }}
          />
          <Button
            testID="play-code-go"
            mode="outlined"
            disabled={kind === null || ask.isPending}
            onPress={() => void go()}
            contentStyle={{ minHeight: 48 }}
          >
            Go
          </Button>
        </View>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Six characters join a game; eight ask to join a space.
        </Text>
      </View>
    </OutlinedCard>
  );
}

/**
 * Phase 62 (P6/P7): the person's favorites, each a quest in one tap -- on the Play home, and as a
 * compact row above a Tutoring dashboard for staff and parents who keep favorites. Nothing when none.
 */
export function PlayFavorites({ compact = false }: { compact?: boolean }) {
  const favorites = useGameFavorites();
  const { start, pending } = useStartQuest();
  const [editing, setEditing] = useState<GameFavorite | null>(null);
  const list = favorites.data?.data ?? [];
  if (list.length === 0) return null;
  return (
    <View testID={compact ? 'play-favorites-row' : undefined} style={{ gap: space.sm }}>
      <GroupHeading>{compact ? 'Play a favorite' : 'Favorites'}</GroupHeading>
      <View testID="play-favorites" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {list.map((favorite) => (
          <View key={favorite.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Button
              testID={`play-favorite-${favorite.name}`}
              mode="contained-tonal"
              // A favorite with its players wears people beside the star (the web's users icon).
              icon={favorite.roster?.length ? 'account-star' : 'star'}
              disabled={pending}
              accessibilityLabel={`Start ${favorite.name}${favorite.roster?.length ? ', with its players' : ''}`}
              onPress={() => void start(favorite.name, favorite.config, favorite.roster)}
              contentStyle={{ minHeight: 44 }}
            >
              {favorite.name}
            </Button>
            {favorite.config.players === 'multi' ? (
              <Button
                testID={`play-favorite-players-${favorite.name}`}
                mode="text"
                compact
                onPress={() => setEditing(favorite)}
                contentStyle={{ minHeight: 44 }}
              >
                Players
              </Button>
            ) : null}
          </View>
        ))}
      </View>
      <RosterDialog favorite={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

/** Phase 62 (P8): games someone's roster invited the reader to -- one tap, no code to type. */
export function WaitingForYou() {
  const theme = useAppTheme();
  // Read only while Home is in front (and the app is), at most once a minute.
  const focused = useIsFocused();
  const waiting = useWaitingGames(focused);
  const list = waiting.data?.data ?? [];
  if (list.length === 0) return null;
  return (
    <View testID="play-waiting" style={{ gap: space.sm }}>
      <GroupHeading>Waiting for you</GroupHeading>
      {list.map((game) => (
        <OutlinedCard key={game.game_id} style={{ borderRadius: radius.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{game.host_first_name}</Text>
              {` started a ${levelLabel(game.level_id)} game · ${gameLengthLabel(game)}`}
              {game.status === 'running' ? (
                <Text style={{ color: theme.tokens.mutedForeground }}> · under way</Text>
              ) : null}
            </Text>
            <Button
              testID={`play-waiting-join-${game.code}`}
              mode="contained"
              onPress={() => {
                haptics.selection();
                joinByCode(game.code);
              }}
              contentStyle={{ minHeight: 44 }}
            >
              Join
            </Button>
          </View>
        </OutlinedCard>
      ))}
    </View>
  );
}

/** The roster's members first (in the server's order), then everyone else. */
export function rosterFirst<T extends { id: string }>(
  members: readonly T[],
  roster: readonly string[] | null | undefined,
): T[] {
  const on = new Set(roster ?? []);
  return [...members.filter((m) => on.has(m.id)), ...members.filter((m) => !on.has(m.id))];
}

/** Phase 62 (P8): a multiplayer favorite's players (R27: first names, people the reader may name). */
export function RosterDialog({ favorite, onClose }: { favorite: GameFavorite | null; onClose: () => void }) {
  const theme = useAppTheme();
  const toast = useToast();
  const members = useRosterMembers(favorite !== null);
  const save = useSaveGameFavorite();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (favorite && loadedFor !== favorite.id) {
    setLoadedFor(favorite.id);
    setChosen(new Set(favorite.roster ?? []));
  }

  function close() {
    setLoadedFor(null);
    onClose();
  }

  async function submit() {
    if (!favorite) return;
    try {
      await save.mutateAsync({
        name: favorite.name,
        config: favorite.config,
        roster: chosen.size ? [...chosen] : null,
      });
      haptics.success();
      toast.success(rosterSavedText(favorite.name, chosen.size));
      close();
    } catch (caught) {
      toast.error(failure(caught, 'The players could not be saved.'));
    }
  }

  // An admin's list is everyone in the space: the favorite's players come first, so they are seen
  // without scrolling. Ordered by the saved roster, not the ticks, so a row never jumps when tapped.
  const list = rosterFirst(members.data?.data ?? [], favorite?.roster);
  return (
    <Portal>
      <Dialog visible={favorite !== null} onDismiss={close} testID="play-roster-dialog">
        <Dialog.Title>{`Players for ${favorite?.name ?? ''}`}</Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: 360, paddingHorizontal: space.xl }}>
          <View style={{ paddingVertical: space.sm }}>
            <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, marginBottom: space.sm }}>
              One tap on the favorite invites them: they see it under Waiting for you, with no code.
            </Text>
            {list.map((member) => (
              <CheckRow
                key={member.id}
                testID={`play-roster-member-${member.id}`}
                label={member.first_name}
                checked={chosen.has(member.id)}
                onChange={(on) =>
                  setChosen((set) => {
                    const next = new Set(set);
                    if (on) next.add(member.id);
                    else next.delete(member.id);
                    return next;
                  })
                }
              />
            ))}
            {members.data && list.length === 0 ? (
              <Text
                testID="play-roster-empty"
                variant="bodyMedium"
                style={{ color: theme.tokens.mutedForeground }}
              >
                Nobody here to invite yet.
              </Text>
            ) : null}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button testID="play-roster-cancel" onPress={close}>
            Cancel
          </Button>
          <Button testID="play-roster-save" disabled={save.isPending} onPress={() => void submit()}>
            Save players
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
