import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ShuffleIcon, StarIcon, UserIcon, UsersIcon, XIcon } from 'lucide-react';
import {
  GAME_LIMITS,
  gameLengthLabel,
  gameLevelLabel,
  gameMarkingLabel,
  gamePlayersLabel,
  levelLabel,
  pointsLabel,
  type CreateGameInput,
  type CreateGameRequest,
  type GameFavorite,
  type GameLevel,
  type GameMode,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { QuestFrame } from './fullscreen-frame';
import { Toggle } from './games-card';
import { useCreateGame, useDeleteGameFavorite, useGameFavorites, useGameLevels, useSaveGameFavorite } from './games-api';

// Phase 47 (docs/quest-games-g2-plan.md): starting a game is a wizard of five
// steps -- the questions (level tiles, Random from a level upward, and the
// person's favorites), the length, the scoring, the players, the review --
// full screen like the game itself. Its last action replaces the wizard with
// the game, so there is no going back once a code is made.

const STEPS = ['Questions', 'Length', 'Scoring', 'Players', 'Review'] as const;
const REVIEW = STEPS.length - 1;

const message = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

/** What the wizard holds; the request is built from it at the end. */
interface Draft {
  level_id: string;
  random: boolean;
  mode: GameMode;
  question_count: number;
  duration_minutes: number;
  right_points: number;
  wrong_points: number;
  knockout: boolean;
  players: 'single' | 'multi';
  max_teams: number;
  teams: boolean;
  max_team_size: number;
  late_join: boolean;
}

const START: Draft = {
  level_id: '',
  random: false,
  mode: 'count',
  question_count: 10,
  duration_minutes: 5,
  right_points: 1,
  wrong_points: 0,
  knockout: false,
  players: 'multi',
  max_teams: GAME_LIMITS.defaultTeams,
  teams: true,
  max_team_size: GAME_LIMITS.defaultTeamSize,
  late_join: false,
};

function toRequest(draft: Draft): CreateGameRequest {
  const multi = draft.players === 'multi';
  return {
    level_id: draft.level_id as CreateGameRequest['level_id'],
    level_scope: draft.random ? 'upward' : 'level',
    mode: draft.mode,
    ...(draft.mode === 'count' ? { question_count: draft.question_count } : { duration_minutes: draft.duration_minutes }),
    right_points: draft.right_points,
    wrong_points: draft.wrong_points,
    knockout: multi && draft.knockout,
    players: draft.players,
    ...(multi ? { max_teams: draft.max_teams } : {}),
    max_team_size: multi && draft.teams ? draft.max_team_size : 1,
    late_join: multi && draft.late_join,
  };
}

function fromConfig(config: CreateGameInput): Draft {
  return {
    level_id: config.level_id,
    random: config.level_scope === 'upward',
    mode: config.mode,
    question_count: config.question_count ?? START.question_count,
    duration_minutes: config.duration_minutes ?? START.duration_minutes,
    right_points: config.right_points,
    wrong_points: config.wrong_points,
    knockout: config.knockout,
    players: config.players,
    max_teams: config.players === 'multi' ? config.max_teams : START.max_teams,
    teams: config.max_team_size > 1,
    max_team_size: config.max_team_size > 1 ? config.max_team_size : START.max_team_size,
    late_join: config.late_join,
  };
}

/** The settings in words, for the review and a favorite's tile. */
function summaryOf(request: CreateGameRequest) {
  const view = {
    level_id: request.level_id,
    level_scope: request.level_scope ?? 'level',
    mode: request.mode,
    question_count: request.question_count ?? null,
    duration_seconds: request.duration_minutes ? request.duration_minutes * 60 : null,
    players: request.players ?? 'multi',
    max_teams: request.max_teams ?? GAME_LIMITS.maxTeams,
    max_team_size: request.max_team_size,
  };
  return {
    level: gameLevelLabel(view, levelLabel),
    length: gameLengthLabel(view),
    scoring: gameMarkingLabel({ right_points: request.right_points ?? 1, wrong_points: request.wrong_points ?? 0 }),
    players: gamePlayersLabel(view),
  };
}

export function StartGamePage() {
  const levels = useGameLevels();
  const favorites = useGameFavorites();
  const create = useCreateGame();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(START);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const playable = useMemo(() => (levels.data?.data ?? []).filter((level) => level.available > 0), [levels.data]);
  const request = toRequest(draft);
  const multi = draft.players === 'multi';

  const canNext = step === 0 ? Boolean(draft.level_id) : true;

  function pickFavorite(favorite: GameFavorite) {
    if (!playable.some((level) => level.level_id === favorite.config.level_id)) {
      toast.error(`${levelLabel(favorite.config.level_id)} has no questions to play here now.`);
      return;
    }
    setDraft(fromConfig(favorite.config));
    setStep(REVIEW);
  }

  async function go() {
    try {
      const game = await create.mutateAsync(request);
      // Replace the wizard: Back leads to Quest, never into a made game's settings.
      navigate(`/quest/games/${game.data.id}`, { replace: true });
    } catch (caught) {
      toast.error(message(caught, 'Could not start the game.'));
    }
  }

  return (
    <QuestFrame title="Start a Quest game" shortTitle="New game" testId="game-wizard">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium',
              i === step
                ? 'border-primary bg-primary text-primary-foreground'
                : i < step
                  ? 'border-primary/40 text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {i < step ? <CheckIcon className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {/* The step slides in from the side: clipped, so it never widens a phone's page. */}
      <div className="overflow-x-clip">
        <div key={step} className="quest-enter grid gap-6" data-testid={`game-step-${step + 1}`}>
          {step === 0 && (
            <QuestionsStep
              draft={draft}
              set={set}
              levels={playable}
              loading={levels.isPending}
              favorites={favorites.data?.data ?? []}
              onFavorite={pickFavorite}
            />
          )}
          {step === 1 && (
            <Section title="How long is the game?" hint="A number of questions, or as many as you can in the time.">
              <Toggle
                value={draft.mode}
                onChange={(mode) => set({ mode })}
                options={[
                  { value: 'count', label: 'A number of questions' },
                  { value: 'timed', label: 'Against the clock' },
                ]}
                testId="game-mode"
              />
              {draft.mode === 'count' ? (
                <Stepper
                  label="Questions"
                  value={draft.question_count}
                  min={GAME_LIMITS.minQuestions}
                  max={GAME_LIMITS.maxQuestions}
                  onChange={(question_count) => set({ question_count })}
                  testId="game-amount"
                />
              ) : (
                <Stepper
                  label="Minutes"
                  value={draft.duration_minutes}
                  min={GAME_LIMITS.minMinutes}
                  max={GAME_LIMITS.maxMinutes}
                  onChange={(duration_minutes) => set({ duration_minutes })}
                  testId="game-amount"
                />
              )}
            </Section>
          )}
          {step === 2 && (
            <Section
              title="How is it scored?"
              hint="A skipped question always scores 0, so points off for a wrong answer make skipping a real choice."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Stepper
                  label="A right answer"
                  value={draft.right_points}
                  min={GAME_LIMITS.minRightPoints}
                  max={GAME_LIMITS.maxRightPoints}
                  onChange={(right_points) => set({ right_points })}
                  format={pointsLabel}
                  testId="game-right"
                />
                <Stepper
                  label="A wrong answer"
                  value={draft.wrong_points}
                  min={GAME_LIMITS.minWrongPoints}
                  max={GAME_LIMITS.maxWrongPoints}
                  onChange={(wrong_points) => set({ wrong_points })}
                  format={pointsLabel}
                  testId="game-wrong"
                />
              </div>
              <label className="hover:bg-muted flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4"
                  checked={draft.knockout}
                  onChange={(event) => set({ knockout: event.target.checked })}
                  data-testid="game-knockout"
                />
                <span className="grid gap-1 text-sm">
                  <span className="font-medium">Knockout</span>
                  <span className="text-muted-foreground">
                    End the game as soon as nobody can catch the leader, even mid-play. For games with two teams or more.
                  </span>
                </span>
              </label>
            </Section>
          )}
          {step === 3 && (
            <Section title="Who plays?">
              <div className="grid gap-3 sm:grid-cols-2">
                <Tile
                  selected={draft.players === 'single'}
                  onClick={() => set({ players: 'single' })}
                  icon={<UserIcon />}
                  title="Single player"
                  detail="Just you, for practice. It starts straight away."
                  testId="game-players-single"
                />
                <Tile
                  selected={multi}
                  onClick={() => set({ players: 'multi' })}
                  icon={<UsersIcon />}
                  title="Multiplayer"
                  detail="Others join with a code, on their own or in teams."
                  testId="game-players-multi"
                />
              </div>
              {multi && (
                <div className="grid gap-5 rounded-lg border p-4">
                  <Stepper
                    label={draft.teams ? 'Most teams' : 'Most players'}
                    value={draft.max_teams}
                    min={GAME_LIMITS.minTeams}
                    max={GAME_LIMITS.maxTeams}
                    onChange={(max_teams) => set({ max_teams })}
                    testId="game-max-teams"
                  />
                  <div className="grid gap-2">
                    <Label>Teams</Label>
                    <Toggle
                      value={draft.teams ? 'teams' : 'solo'}
                      onChange={(value) => set({ teams: value === 'teams' })}
                      options={[
                        { value: 'solo', label: 'Everyone on their own' },
                        { value: 'teams', label: 'Teams of several' },
                      ]}
                      testId="game-team-style"
                    />
                  </div>
                  {draft.teams && (
                    <Stepper
                      label="Players in a team, at most"
                      value={draft.max_team_size}
                      min={2}
                      max={GAME_LIMITS.maxTeamSize}
                      onChange={(max_team_size) => set({ max_team_size })}
                      testId="game-team-size"
                    />
                  )}
                  <div className="grid gap-2">
                    <Label>Joining</Label>
                    <Toggle
                      value={draft.late_join ? 'open' : 'closed'}
                      onChange={(value) => set({ late_join: value === 'open' })}
                      options={[
                        { value: 'closed', label: 'Closed once it starts' },
                        { value: 'open', label: 'Open while it runs' },
                      ]}
                      testId="game-late-join"
                    />
                  </div>
                </div>
              )}
            </Section>
          )}
          {step === REVIEW && <ReviewStep request={request} multi={multi} />}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} disabled={create.isPending} data-testid="game-back">
            <ArrowLeftIcon /> Back
          </Button>
        )}
        <span className="flex-1" />
        {step < REVIEW ? (
          <Button size="lg" onClick={() => setStep(step + 1)} disabled={!canNext} data-testid="game-next">
            Next <ArrowRightIcon />
          </Button>
        ) : (
          <Button size="lg" onClick={() => void go()} disabled={create.isPending} data-testid="game-create">
            {multi ? 'Generate game code' : 'Start game'}
          </Button>
        )}
      </div>
    </QuestFrame>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({
  selected,
  onClick,
  icon,
  title,
  detail,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  detail?: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'flex min-h-20 w-full flex-col items-start justify-center gap-1 rounded-xl border p-4 pr-9 text-left transition-all',
        'focus-visible:ring-ring outline-none focus-visible:ring-2',
        selected ? 'border-primary bg-primary/10 ring-primary ring-1' : 'hover:bg-muted hover:-translate-y-0.5',
      )}
    >
      <span className="flex items-center gap-2 text-base font-semibold [&_svg]:size-4">
        {icon}
        {title}
      </span>
      {detail && <span className="text-muted-foreground text-xs">{detail}</span>}
    </button>
  );
}

function QuestionsStep({
  draft,
  set,
  levels,
  loading,
  favorites,
  onFavorite,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  levels: GameLevel[];
  loading: boolean;
  favorites: GameFavorite[];
  onFavorite: (favorite: GameFavorite) => void;
}) {
  const remove = useDeleteGameFavorite();
  return (
    <>
      {favorites.length > 0 && (
        <Section title="Your favorites" hint="Your saved games: one tap fills in every step.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="game-favorites">
            {favorites.map((favorite) => {
              const words = summaryOf(favorite.config);
              return (
                <div key={favorite.id} className="relative">
                  <Tile
                    selected={false}
                    onClick={() => onFavorite(favorite)}
                    icon={<StarIcon className="text-primary" />}
                    title={favorite.name}
                    detail={`${words.level} · ${words.length} · ${words.players}`}
                    testId={`game-fav-${favorite.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 size-7"
                    aria-label={`Delete the favorite ${favorite.name}`}
                    onClick={() =>
                      void remove
                        .mutateAsync(favorite.id)
                        .then(() => toast.success(`Deleted “${favorite.name}”.`))
                        .catch((caught) => toast.error(message(caught, 'Could not delete it.')))
                    }
                    data-testid={`game-fav-delete-${favorite.name}`}
                  >
                    <XIcon />
                  </Button>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      <Section title="Which questions?" hint="A level of the question bank, or Random from a starting level upward.">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : levels.length === 0 ? (
          <p className="text-muted-foreground text-sm">No level has approved questions to play yet.</p>
        ) : (
          <div role="radiogroup" aria-label="Level" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {levels.map((level) => (
              <Tile
                key={level.level_id}
                selected={!draft.random && draft.level_id === level.level_id}
                onClick={() => set({ level_id: level.level_id, random: false })}
                title={level.label}
                detail={`${level.available} questions`}
                testId={`game-tile-${level.level_id}`}
              />
            ))}
            <Tile
              selected={draft.random}
              onClick={() => set({ random: true, level_id: draft.random ? draft.level_id : '' })}
              icon={<ShuffleIcon />}
              title="Random"
              detail="Any level from a starting one up"
              testId="game-tile-random"
            />
          </div>
        )}
        {draft.random && (
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="game-random-start">Starting at</Label>
            <Select value={draft.level_id} onValueChange={(level_id) => set({ level_id })}>
              <SelectTrigger id="game-random-start" data-testid="game-random-start">
                <SelectValue placeholder="Choose the lowest level" />
              </SelectTrigger>
              <SelectContent>
                {levels.map((level) => (
                  <SelectItem key={level.level_id} value={level.level_id}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Questions come at random from this level and the ones above it, never below.
            </p>
          </div>
        )}
      </Section>
    </>
  );
}

function ReviewStep({ request, multi }: { request: CreateGameRequest; multi: boolean }) {
  const save = useSaveGameFavorite();
  const [name, setName] = useState('');
  const words = summaryOf(request);
  const rows: [string, string][] = [
    ['Questions', words.level],
    ['Length', words.length],
    ['Scoring', words.scoring],
    ...(multi ? ([['Knockout', request.knockout ? 'On' : 'Off']] as [string, string][]) : []),
    ['Players', words.players],
    ...(multi ? ([['Joining', request.late_join ? 'Open while it runs' : 'Closed once it starts']] as [string, string][]) : []),
  ];

  async function saveFavorite() {
    try {
      const saved = await save.mutateAsync({ name, config: request });
      toast.success(`Saved “${saved.data.name}” to your favorites.`);
    } catch (caught) {
      toast.error(message(caught, 'Could not save the favorite.'));
    }
  }

  return (
    <Section
      title="Ready?"
      hint={multi ? 'Once you generate the code, the settings are fixed.' : 'The game starts as soon as you press Start game.'}
    >
      <Card className="py-0">
        <CardContent className="p-0">
          <dl className="divide-y text-sm" data-testid="game-review-summary">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3">
                <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void saveFavorite();
        }}
      >
        <Label htmlFor="game-fav-name">Save as a favorite</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="game-fav-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="A name, like Friday G5 race"
            maxLength={40}
            className="sm:max-w-xs"
            data-testid="game-fav-name"
          />
          <Button type="submit" variant="outline" disabled={!name.trim() || save.isPending} data-testid="game-fav-save">
            <StarIcon /> Save as favorite
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** A number counter with − and +: typed or stepped, kept within its bounds. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  testId: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="grid gap-2">
      <Label htmlFor={testId}>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 text-lg"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={`${label}: one less`}
          data-testid={`${testId}-minus`}
        >
          −
        </Button>
        <Input
          id={testId}
          inputMode="numeric"
          className="h-11 w-20 text-center text-lg font-semibold tabular-nums"
          value={text ?? (format ? format(value) : String(value))}
          onFocus={() => setText(String(value))}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            const n = Number.parseInt((text ?? '').replace('−', '-'), 10);
            if (Number.isFinite(n)) onChange(clamp(n));
            setText(null);
          }}
          data-testid={testId}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 text-lg"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={`${label}: one more`}
          data-testid={`${testId}-plus`}
        >
          +
        </Button>
        <span className="text-muted-foreground text-xs">{format ? `${format(min)} to ${format(max)}` : `${min} to ${max}`}</span>
      </div>
    </div>
  );
}
