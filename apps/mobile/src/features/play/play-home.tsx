// Ported from apps/web/src/features/play/play-home.tsx @ 0e3ec7a (working tree). Phase 62 (P6-P8,
// docs/stickiness-plan.md): the members' Play home -- Continue, Favorites, Waiting for you, the tiles
// grouped by curriculum and "Have a code?", every one a quest in one tap. The same copy, testIDs and
// requests as the web.
//
// Mobile: a waiting game's Join opens the existing `quest/join-game` sheet, which looks the code up and offers
// the join choices (JoinChoices), so there is one join path. Phase 72 (UI audit JF4): the board's "Have a code?"
// box opens the one code sheet (`/have-a-code`) on what was typed -- a game's code reaches the same join sheet. The
// roster is a Paper dialog of tick rows. A tile is a card of two targets: the code starts it, the star
// keeps it as a favorite named by its code.
//
// Phase 64 (P17-P20): My progress under Continue, "Today's Daily · <tag>D" (while the console has the
// Daily on) for the level last played or the first tile's, and a tile's "Best N".
//
// Phase 67 (H5-H8, docs/member-home-plan.md): the curriculum groups become the Quest board -- the grade
// row, the grade's cards in its hue (QuestCard, shared with the guest home), "Advanced", and "More levels";
// the Daily is a TodayCard of five rings; "Show your work" starts the reader's own assessment. Each card
// keeps `play-tile-<code>` (now its root), `play-tile-start-<code>` and `play-tile-star-<code>`.
import {
  boardGrades,
  memberBoard,
  tileGameRequest,
  tileLook,
  tileSpoken,
  gameLengthLabel,
  levelLabel,
  type CreateGameRequest,
  type GameFavorite,
  type MemberTile,
} from '@tmi/shared';
import { router, useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { BadgePill } from '@/components/badge-pill';
import { CheckRow } from '@/components/check-row';
import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { useStartCanvasAssessment } from '@/features/canvas-assessments/api';
import { useDaily, useHabit } from '@/features/habit/api';
import { MyProgressCard } from '@/features/habit/my-progress-card';
import {
  DAILY_NEXT_TEXT,
  dailyButtonLabel,
  dailyCardTitle,
  dailyRings,
  dailyRingsLabel,
  dailyTileFor,
} from '@/features/habit/habit-model';
import { CODE_SHEET_HINT } from '@/features/organizations/code-sheet-model';
import { CODE_FONT } from '@/features/quest/game-style';
import { useCreateGame, useGameFavorites, useSaveGameFavorite } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import {
  useCarryGuestTiles,
  useGuestLeadLevel,
  useLastQuest,
  useMemberTiles,
  useRememberLastQuest,
  useRosterMembers,
  useWaitingGames,
} from './play-api';
import {
  assessmentTileRequest,
  codeKind,
  offBoardGroups,
  rosterSavedText,
  shownGrade,
  startRequest,
  tidyCode,
} from './play-model';
import { CardGrid, GradeRow, QuestCard, TodayCard } from './quest-card';

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
 *
 * Phase 67 (H5-H8): the Quest board -- the Daily as five rings, the grade row (only the grades the
 * reader's tiles reach), that grade's cards in its hue (its standards, then "Advanced"), and "More
 * levels" for the tiles off the 1-8 row.
 */
export function PlayHome() {
  const theme = useAppTheme();
  const toast = useToast();
  const { organization, user } = useAuth();
  const tiles = useMemberTiles();
  const favorites = useGameFavorites();
  const saveFavorite = useSaveGameFavorite();
  const lastQuest = useLastQuest(organization?.slug);
  const last = lastQuest.data ?? null;
  const { start, pending } = useStartQuest();
  const startAssessment = useStartCanvasAssessment();
  const [chosenGrade, setChosenGrade] = useState<number | null>(null);
  // Two cards a row on a phone, three or four on a tablet.
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 4 : width >= 700 ? 3 : 2;

  // Phase 64: My progress is read beside the tiles, and the home waits for it to settle (or fail), so
  // the card never arrives later and pushes the tiles down under a finger (or a test's tap).
  const habit = useHabit();
  const guestLead = useGuestLeadLevel();
  useCarryGuestTiles(guestLead.isSuccess, tiles.data?.data.tiles, favorites.data?.data);
  const list = tiles.data?.data.tiles ?? [];
  // The level last played here leads; before any, a guest's grade on this phone (P13).
  const lead = last?.request.level_id ?? guestLead.data ?? null;
  // Phase 64 (P19): the Daily of that level, else of the first tile's; Phase 67 shows it as rings.
  const dailyTile = dailyTileFor(list, lead);
  const dailyLevel = tiles.data?.data.daily && dailyTile ? dailyTile.level_id : null;
  const daily = useDaily(dailyLevel);

  if (
    !tiles.data ||
    !tiles.data.data.play_home ||
    habit.isPending ||
    guestLead.isPending ||
    lastQuest.isLoading ||
    daily.isLoading
  )
    return null;
  const grades = boardGrades(list);
  const grade = shownGrade(list, chosenGrade, lead);
  const board = grade === null ? { standard: [], advanced: [] } : memberBoard(list, grade);
  const more = offBoardGroups(list);
  const starred = new Set((favorites.data?.data ?? []).map((favorite) => favorite.name));
  const dailySet = daily.data?.data ?? null;

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

  // Phase 67 (H7): "Show your work" is the reader's own assessment (a personal space serves it).
  async function showYourWork(tile: MemberTile) {
    if (!user) return;
    haptics.selection();
    try {
      const made = await startAssessment.mutateAsync(assessmentTileRequest(tile, user.id));
      router.push({ pathname: '/assessments/[id]', params: { id: made.data.id } });
    } catch (caught) {
      haptics.error();
      toast.error(failure(caught, 'That assessment could not start.'));
    }
  }

  function card(tile: MemberTile) {
    const look = tileLook(tile);
    const isStarred = starred.has(tile.code);
    const assessment = tile.kind === 'assessment';
    return (
      <QuestCard
        testID={`play-tile-${tile.code}`}
        pressTestID={`play-tile-start-${tile.code}`}
        label={`Start ${tile.code}: ${tileSpoken(tile)}`}
        title={look.title}
        detail={look.detail}
        level={look.level}
        icon={look.icon}
        tone={{ grade: look.grade }}
        advanced={look.advanced}
        code={tile.code}
        disabled={pending || startAssessment.isPending}
        onPress={() => void (assessment ? showYourWork(tile) : start(tile.code, tileGameRequest(tile)))}
        footer={
          <>
            {tile.beta ? (
              <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <BadgePill testID={`play-tile-beta-${tile.code}`} />
              </View>
            ) : null}
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
          </>
        }
        // A favorite is a game: "Show your work" is not one, so it has no star.
        aside={
          assessment ? undefined : (
            <IconButton
              testID={`play-tile-star-${tile.code}`}
              icon={isStarred ? 'star' : 'star-outline'}
              size={20}
              iconColor={isStarred ? theme.colors.primary : theme.tokens.mutedForeground}
              accessibilityLabel={isStarred ? `${tile.code} is a favorite` : `Add ${tile.code} to favorites`}
              accessibilityState={{ selected: isStarred, disabled: isStarred || saveFavorite.isPending }}
              disabled={isStarred || saveFavorite.isPending}
              onPress={() => void star(tile)}
            />
          )
        }
      />
    );
  }

  return (
    <View testID="play-home" style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {/* A sub-label under the section's own heading ("Your learning"), as the board's other groups: never
            two big headings in a row. */}
        <View testID="play-home-heading" style={{ flex: 1 }}>
          <GroupHeading>Quest</GroupHeading>
        </View>
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

      {/* Phase 64 (P17-P18): the streak, today's ring and the badges; Phase 67: the week's dots. */}
      <MyProgressCard />

      {/* Phase 67 (H8): today's Daily as five rings, filled once played. */}
      {dailyLevel && dailySet && (dailySet.result || dailySet.questions.length > 0) ? (
        <TodayCard
          testID="play-daily"
          eyebrow={dailyButtonLabel(dailyLevel)}
          eyebrowTestID="play-daily-eyebrow"
          title={dailyCardTitle(dailySet.result)}
          titleTestID="play-daily-title"
          states={dailyRings(dailySet.result, Math.max(dailySet.questions.length, dailySet.result?.of ?? 0))}
          ringsTestID="play-daily-rings"
          ringsLabel={dailyRingsLabel(dailySet.result, dailySet.questions.length)}
          note={dailySet.result ? DAILY_NEXT_TEXT : null}
          playTestID="play-daily-play"
          playIcon={dailySet.result ? 'eye-outline' : 'bullseye-arrow'}
          playLabel={dailySet.result ? 'See today’s result' : 'Play today’s Daily'}
          quiet={dailySet.result !== null}
          onPlay={() => {
            haptics.selection();
            router.push({ pathname: '/quest/daily/[level]', params: { level: dailyLevel } });
          }}
        />
      ) : null}

      <PlayFavorites />

      <WaitingForYou />

      {grades.length > 0 ? (
        <View testID="play-board" style={{ gap: space.md }}>
          <GroupHeading>Your grade</GroupHeading>
          <GradeRow
            grades={grades}
            value={grade}
            hued
            testIDPrefix="play-grade-"
            onChange={(g) => {
              haptics.selection();
              setChosenGrade(g);
            }}
          />
          {board.standard.length > 0 ? (
            <CardGrid items={board.standard} columns={columns} keyOf={(t) => t.code} render={card} />
          ) : null}
          {board.advanced.length > 0 ? (
            <>
              <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '700', marginTop: space.sm }}>
                Advanced
              </Text>
              <CardGrid items={board.advanced} columns={columns} keyOf={(t) => t.code} render={card} />
            </>
          ) : null}
        </View>
      ) : null}

      {more.length > 0 ? (
        <View testID="play-more" style={{ gap: space.md }}>
          <GroupHeading>More levels</GroupHeading>
          {more.map(([words, group]) => (
            <View key={words} style={{ gap: space.sm }}>
              <Text variant="titleSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
                {words}
              </Text>
              <CardGrid items={group} columns={columns} keyOf={(t) => t.code} render={card} />
            </View>
          ))}
        </View>
      ) : null}

      <HaveACode />
    </View>
  );
}

/**
 * One box for both codes, on the board: Go opens the one "Have a code?" sheet on what was typed (UI audit JF4),
 * which says what the code found -- the game's join choices, or the space's name -- before sending anything.
 */
export function HaveACode() {
  const theme = useAppTheme();
  const [code, setCode] = useState('');
  const kind = codeKind(code);

  function go() {
    if (!kind) return;
    haptics.selection();
    router.push({ pathname: '/have-a-code', params: { code: tidyCode(code) } });
    setCode('');
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
            onSubmitEditing={go}
            style={{ flexGrow: 1, minWidth: 180 }}
            contentStyle={{ fontFamily: CODE_FONT, letterSpacing: 3, fontSize: 18 }}
          />
          <Button
            testID="play-code-go"
            mode="outlined"
            disabled={kind === null}
            onPress={go}
            contentStyle={{ minHeight: 48 }}
          >
            Go
          </Button>
        </View>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {CODE_SHEET_HINT}
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
