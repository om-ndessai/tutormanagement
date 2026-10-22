// Ported from apps/web/src/features/quest/start-game-page.tsx @ 9eccdf2 (working tree): StartGamePage,
// Section, QuestionsStep and ReviewStep (Tile is game-tile.tsx, Stepper components/number-stepper.tsx,
// the draft and its request game-wizard-model.ts).
//
// Phase 47 (docs/quest-games-g2-plan.md): starting a game is a wizard of five steps -- the questions
// (level tiles, Random from a level upward, and the person's favorites), the length, the scoring, the
// players, the review. Its last action replaces the wizard with the game, so there is no going back
// once a code is made.
// Mobile (design 61): the app's StepFlow on the `quest/new-game` route (a card rising from the bottom),
// so the Review is its cards with Edit, and the favorite's name and Save follow them. A favorite's tap
// fills every step and jumps to the Review; its × asks first, natively. The first step validates
// rather than disabling Next: the message shows under the tiles, with the error buzz. Each step is
// capped at 720 pt and centred on an iPad. Nothing worth guarding is lost on Close (`dirty` false).
import {
  GAME_LIMITS,
  createGameSchema,
  gameFavoriteSchema,
  pointsLabel,
  type GameFavorite,
  type GameLevel,
  type GameMode,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, View, useWindowDimensions } from 'react-native';
import { Button, Checkbox, Divider, HelperText, Text, TextInput } from 'react-native-paper';

import { Choice, Field } from '@/components/form-choice';
import { IconButton } from '@/components/icon-button';
import { NumberStepper } from '@/components/number-stepper';
import { OptionPicker } from '@/components/option-picker';
import { OutlinedCard } from '@/components/outlined-card';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { Skeleton } from '@/components/skeleton';
import { REVIEW_KEY, StepFlow, type StepDef, type StepFlowHandle } from '@/components/step-flow';
import { useToast } from '@/components/toast';
import { useLargeText } from '@/hooks/use-large-text';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { GameTile, TileGrid } from './game-tile';
import {
  WIZARD_START,
  favoriteDetail,
  favoritePlayable,
  favoriteRefusal,
  fromConfig,
  levelProblem,
  reviewHint,
  reviewLines,
  submitLabel,
  toRequest,
  type WizardDraft,
  type WizardStepKey,
} from './game-wizard-model';
import {
  useCreateGame,
  useDeleteGameFavorite,
  useGameFavorites,
  useGameLevels,
  useSaveGameFavorite,
} from './games-api';
import { questWide } from './quest-model';

const message = (caught: unknown, fallback: string) =>
  caught instanceof ApiRequestError ? caught.message : fallback;

const MODE_TABS = [
  { value: 'count', label: 'A number of questions', icon: 'format-list-numbered', testID: 'game-mode-count' },
  { value: 'timed', label: 'Against the clock', icon: 'timer-outline', testID: 'game-mode-timed' },
] as const;

/** The widest a step grows on an iPad. */
const STEP_MAX_WIDTH = 720;

type Patch = (patch: Partial<WizardDraft>) => void;

export function StartGameFlow() {
  const levels = useGameLevels();
  const favorites = useGameFavorites();
  const create = useCreateGame();
  const toast = useToast();
  const flow = useRef<StepFlowHandle>(null);
  const [draft, setDraft] = useState<WizardDraft>(WIZARD_START);
  const [refusal, setRefusal] = useState<string | null>(null);
  const set: Patch = (patch) => setDraft((was) => ({ ...was, ...patch }));
  const playable = useMemo(
    () => (levels.data?.data ?? []).filter((level) => level.available > 0),
    [levels.data],
  );
  const request = toRequest(draft);
  const lines = reviewLines(request);

  function pickFavorite(favorite: GameFavorite) {
    if (!favoritePlayable(favorite, playable)) {
      toast.error(favoriteRefusal(favorite));
      return;
    }
    setDraft(fromConfig(favorite.config));
    flow.current?.goTo(REVIEW_KEY);
  }

  async function submit() {
    setRefusal(null);
    const parsed = createGameSchema.safeParse(request);
    if (!parsed.success) {
      haptics.error();
      setRefusal(parsed.error.issues[0]?.message ?? 'Could not start the game.');
      return;
    }
    try {
      const game = await create.mutateAsync(request);
      // Replace the wizard: Exit from the game lands on Quest, never in a made game's settings.
      router.replace({ pathname: '/quest/games/[gameId]', params: { gameId: game.data.id } });
    } catch (caught) {
      haptics.error();
      setRefusal(message(caught, 'Could not start the game.'));
    }
  }

  /** A step's card on the Review: its lines, read as one. */
  function summary(key: WizardStepKey) {
    return <SummaryLines testID={`game-summary-${key}`} lines={lines[key]} />;
  }

  const steps: StepDef<WizardDraft>[] = [
    {
      key: 'questions',
      title: 'Which questions?',
      description: 'A level of the question bank, or Random from a starting level upward.',
      fields: ['level_id'],
      validate: (d) => {
        const problem = levelProblem(d);
        return problem ? { level_id: problem } : null;
      },
      render: ({ errors }) => (
        <StepBody n={1}>
          <QuestionsStep
            draft={draft}
            set={set}
            levels={playable}
            loading={levels.isPending}
            favorites={favorites.data?.data ?? []}
            onFavorite={pickFavorite}
            onFavoritesStale={() => void favorites.refetch()}
            error={errors.level_id}
          />
        </StepBody>
      ),
      summary: () => summary('questions'),
    },
    {
      key: 'length',
      title: 'How long is the game?',
      description: 'A number of questions, or as many as you can in the time.',
      fields: ['question_count', 'duration_minutes'],
      render: () => (
        <StepBody n={2}>
          <SegmentedTabs<GameMode>
            tabs={MODE_TABS}
            value={draft.mode}
            onChange={(mode) => set({ mode })}
            testID="game-mode"
          />
          {draft.mode === 'count' ? (
            <NumberStepper
              key="count"
              label="Questions"
              value={draft.question_count}
              min={GAME_LIMITS.minQuestions}
              max={GAME_LIMITS.maxQuestions}
              onChange={(question_count) => set({ question_count })}
              testID="game-amount"
            />
          ) : (
            <NumberStepper
              key="timed"
              label="Minutes"
              value={draft.duration_minutes}
              min={GAME_LIMITS.minMinutes}
              max={GAME_LIMITS.maxMinutes}
              onChange={(duration_minutes) => set({ duration_minutes })}
              testID="game-amount"
            />
          )}
        </StepBody>
      ),
      summary: () => summary('length'),
    },
    {
      key: 'scoring',
      title: 'How is it scored?',
      description:
        'A skipped question always scores 0, so points off for a wrong answer make skipping a real choice.',
      fields: ['right_points', 'wrong_points'],
      render: () => (
        <StepBody n={3}>
          <ScoringStep draft={draft} set={set} />
        </StepBody>
      ),
      summary: () => summary('scoring'),
    },
    {
      key: 'players',
      title: 'Who plays?',
      fields: ['max_teams', 'max_team_size'],
      render: () => (
        <StepBody n={4}>
          <PlayersStep draft={draft} set={set} />
        </StepBody>
      ),
      summary: () => summary('players'),
    },
  ];

  return (
    <View testID="screen-quest-new-game" style={{ flex: 1 }}>
      <StepFlow
        ref={flow}
        title="Start a Quest game"
        steps={steps}
        draft={draft}
        review={{
          title: 'Ready?',
          description: reviewHint(draft.players),
          trail: () => (
            <StepBody n={5}>
              <FavoriteSave request={request} />
            </StepBody>
          ),
        }}
        submitLabel={submitLabel(draft.players)}
        submitTestID="game-create"
        submitting={create.isPending}
        formError={refusal}
        dirty={false}
        onSubmit={() => submit()}
        onStepChange={() => setRefusal(null)}
      />
    </View>
  );
}

/** A step's content: `game-step-<n>`, capped and centred on an iPad. */
function StepBody({ n, children }: { n: number; children: ReactNode }) {
  return (
    <View
      testID={`game-step-${n}`}
      style={{ width: '100%', maxWidth: STEP_MAX_WIDTH, alignSelf: 'center', gap: space.lg }}
    >
      {children}
    </View>
  );
}

/** A Review card's lines, read as one element. */
function SummaryLines({ testID, lines }: { testID: string; lines: string[] }) {
  return (
    <View testID={testID} accessible accessibilityLabel={lines.join('. ')} style={{ gap: 2 }}>
      {lines.map((line) => (
        <Text key={line} variant="bodyMedium">
          {line}
        </Text>
      ))}
    </View>
  );
}

function SubHeading({ title, hint }: { title: string; hint?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
      {hint ? (
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Tiles two to a row on a phone, four on an iPad, one at the largest text sizes. */
function useTileColumns(): number {
  const { width } = useWindowDimensions();
  const large = useLargeText();
  if (large) return 1;
  return questWide(width) ? 4 : 2;
}

function QuestionsStep({
  draft,
  set,
  levels,
  loading,
  favorites,
  onFavorite,
  onFavoritesStale,
  error,
}: {
  draft: WizardDraft;
  set: Patch;
  levels: GameLevel[];
  loading: boolean;
  favorites: GameFavorite[];
  onFavorite: (favorite: GameFavorite) => void;
  onFavoritesStale: () => void;
  error?: string;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const remove = useDeleteGameFavorite();
  const columns = useTileColumns();

  function confirmDelete(favorite: GameFavorite) {
    haptics.warning();
    Alert.alert(`Delete “${favorite.name}”?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void remove
            .mutateAsync(favorite.id)
            .then(() => toast.success(`Deleted “${favorite.name}”.`))
            .catch((caught: unknown) => {
              // Deleted on another device (404): say so, and read the list again.
              toast.error(message(caught, 'Could not delete it.'));
              onFavoritesStale();
            }),
      },
    ]);
  }

  const levelTiles = levels.map((level) => (
    <GameTile
      key={level.level_id}
      testID={`game-tile-${level.level_id}`}
      title={level.label}
      detail={`${level.available} questions`}
      selected={!draft.random && draft.level_id === level.level_id}
      onPress={() => set({ level_id: level.level_id, random: false })}
    />
  ));
  levelTiles.push(
    <GameTile
      key="random"
      testID="game-tile-random"
      icon="shuffle-variant"
      title="Random"
      detail="Any level from a starting one up"
      selected={draft.random}
      onPress={() => set({ random: true, level_id: draft.random ? draft.level_id : '' })}
    />,
  );

  return (
    <>
      {favorites.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SubHeading title="Your favorites" hint="Your saved games: one tap fills in every step." />
          <View testID="game-favorites">
            <TileGrid columns={columns}>
              {favorites.map((favorite) => (
                <GameTile
                  key={favorite.id}
                  testID={`game-fav-${favorite.name}`}
                  role="button"
                  icon="star"
                  title={favorite.name}
                  detail={favoriteDetail(favorite)}
                  onPress={() => onFavorite(favorite)}
                  corner={
                    <IconButton
                      testID={`game-fav-delete-${favorite.name}`}
                      icon="close"
                      size={20}
                      accessibilityLabel={`Delete the favorite ${favorite.name}`}
                      disabled={remove.isPending}
                      onPress={() => confirmDelete(favorite)}
                    />
                  }
                />
              ))}
            </TileGrid>
          </View>
          <Divider style={{ marginTop: space.sm }} />
        </View>
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Level" style={{ gap: space.sm }}>
        {loading ? (
          <Skeleton width="100%" height={176} />
        ) : levels.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            No level has approved questions to play yet.
          </Text>
        ) : (
          <TileGrid columns={columns}>{levelTiles}</TileGrid>
        )}
        {error ? (
          <HelperText testID="game-level-error" type="error" padding="none">
            {error}
          </HelperText>
        ) : null}
      </View>
      {draft.random ? (
        <View style={{ gap: space.xs, maxWidth: 420 }}>
          <OptionPicker
            testID="game-random-start"
            label="Starting at"
            placeholder="Choose the lowest level"
            options={levels.map((level) => ({ id: level.level_id, label: level.label }))}
            value={draft.level_id}
            onChange={(level_id) => set({ level_id })}
            searchPlaceholder="Search levels"
            scroll
          />
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            Questions come at random from this level and the ones above it, never below.
          </Text>
        </View>
      ) : null}
    </>
  );
}

function ScoringStep({ draft, set }: { draft: WizardDraft; set: Patch }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const side = questWide(width);
  return (
    <>
      <View style={{ flexDirection: side ? 'row' : 'column', gap: space.lg }}>
        <View style={side ? { flex: 1 } : undefined}>
          <NumberStepper
            label="A right answer"
            value={draft.right_points}
            min={GAME_LIMITS.minRightPoints}
            max={GAME_LIMITS.maxRightPoints}
            onChange={(right_points) => set({ right_points })}
            format={pointsLabel}
            testID="game-right"
          />
        </View>
        <View style={side ? { flex: 1 } : undefined}>
          <NumberStepper
            label="A wrong answer"
            value={draft.wrong_points}
            min={GAME_LIMITS.minWrongPoints}
            max={GAME_LIMITS.maxWrongPoints}
            onChange={(wrong_points) => set({ wrong_points })}
            format={pointsLabel}
            testID="game-wrong"
          />
        </View>
      </View>
      <Pressable
        testID="game-knockout"
        accessibilityRole="checkbox"
        accessibilityLabel="Knockout. End the game as soon as nobody can catch the leader, even mid-play. For games with two teams or more."
        accessibilityState={{ checked: draft.knockout }}
        onPress={() => {
          haptics.selection();
          set({ knockout: !draft.knockout });
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
        })}
      >
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Checkbox.Android status={draft.knockout ? 'checked' : 'unchecked'} />
        </View>
        <View style={{ flex: 1, gap: space.xs, paddingTop: space.sm }}>
          <Text variant="titleSmall">Knockout</Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            End the game as soon as nobody can catch the leader, even mid-play. For games with two teams or
            more.
          </Text>
        </View>
      </Pressable>
    </>
  );
}

function PlayersStep({ draft, set }: { draft: WizardDraft; set: Patch }) {
  const { width } = useWindowDimensions();
  const large = useLargeText();
  const multi = draft.players === 'multi';
  const row = questWide(width) && !large;
  return (
    <>
      <View accessibilityRole="radiogroup" style={{ flexDirection: row ? 'row' : 'column', gap: space.md }}>
        <GameTile
          testID="game-players-single"
          icon="account-outline"
          title="Single player"
          detail="Just you, for practice. It starts straight away."
          selected={draft.players === 'single'}
          onPress={() => set({ players: 'single' })}
        />
        <GameTile
          testID="game-players-multi"
          icon="account-group-outline"
          title="Multiplayer"
          detail="Others join with a code, on their own or in teams."
          selected={multi}
          onPress={() => set({ players: 'multi' })}
        />
      </View>
      {multi ? (
        <OutlinedCard style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, gap: space.lg }}>
            <NumberStepper
              label={draft.teams ? 'Most teams' : 'Most players'}
              value={draft.max_teams}
              min={GAME_LIMITS.minTeams}
              max={GAME_LIMITS.maxTeams}
              onChange={(max_teams) => set({ max_teams })}
              testID="game-max-teams"
            />
            <Field label="Teams">
              <View
                accessibilityRole="radiogroup"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
              >
                <Choice
                  testID="game-team-style-solo"
                  label="Everyone on their own"
                  selected={!draft.teams}
                  onPress={() => set({ teams: false })}
                  wide
                />
                <Choice
                  testID="game-team-style-teams"
                  label="Teams of several"
                  selected={draft.teams}
                  onPress={() => set({ teams: true })}
                  wide
                />
              </View>
            </Field>
            {draft.teams ? (
              <NumberStepper
                label="Players in a team, at most"
                value={draft.max_team_size}
                min={2}
                max={GAME_LIMITS.maxTeamSize}
                onChange={(max_team_size) => set({ max_team_size })}
                testID="game-team-size"
              />
            ) : null}
            <Field label="Joining">
              <View
                accessibilityRole="radiogroup"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
              >
                <Choice
                  testID="game-late-join-closed"
                  label="Closed once it starts"
                  selected={!draft.late_join}
                  onPress={() => set({ late_join: false })}
                  wide
                />
                <Choice
                  testID="game-late-join-open"
                  label="Open while it runs"
                  selected={draft.late_join}
                  onPress={() => set({ late_join: true })}
                  wide
                />
              </View>
            </Field>
          </View>
        </OutlinedCard>
      ) : null}
    </>
  );
}

/** After the Review's cards: Save as a favorite, under a name of the person's own. */
function FavoriteSave({ request }: { request: ReturnType<typeof toRequest> }) {
  const toast = useToast();
  const save = useSaveGameFavorite();
  const [name, setName] = useState('');

  async function saveFavorite() {
    if (!name.trim() || save.isPending) return;
    // Checked first: an SSN-shaped name is refused before it is sent.
    const parsed = gameFavoriteSchema.safeParse({ name, config: request });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Could not save the favorite.');
      return;
    }
    try {
      const saved = await save.mutateAsync({ name: parsed.data.name, config: request });
      toast.success(`Saved “${saved.data.name}” to your favorites.`);
    } catch (caught) {
      toast.error(message(caught, 'Could not save the favorite.'));
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        testID="game-fav-name"
        mode="outlined"
        label="Save as a favorite"
        accessibilityLabel="Save as a favorite"
        placeholder="A name, like Friday G5 race"
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => void saveFavorite()}
      />
      <Button
        testID="game-fav-save"
        mode="outlined"
        icon="star-outline"
        disabled={!name.trim() || save.isPending}
        loading={save.isPending}
        onPress={() => void saveFavorite()}
        style={{ alignSelf: 'flex-start' }}
        contentStyle={{ minHeight: 48 }}
      >
        Save as favorite
      </Button>
    </View>
  );
}
