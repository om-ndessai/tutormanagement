import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Gamepad2Icon, LogInIcon, PlusIcon, UsersIcon } from 'lucide-react';
import {
  GAME_CODE_LENGTH,
  GAME_LIMITS,
  gameLengthLabel,
  gameMarkingLabel,
  levelLabel,
  normalizeGameCode,
  placeLabel,
  type CreateGameInput,
  type GameLookup,
  type GameMode,
  type JoinGameInput,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCreateGame, useGameLevels, useGames, useJoinGame, useLookupGame } from './games-api';

// Phase 46: Quest Games on the Quest page -- for everyone in the organization.
// Start a game, or type a code to join one. docs/quest-games-plan.md.

const message = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

export function GamesCard() {
  const games = useGames();
  const lookup = useLookupGame();
  const [code, setCode] = useState('');
  const [starting, setStarting] = useState(false);
  const [found, setFound] = useState<GameLookup | null>(null);
  const navigate = useNavigate();
  const rows = games.data?.data ?? [];

  async function join() {
    try {
      const result = await lookup.mutateAsync(code);
      if (result.data.joined) navigate(`/quest/games/${result.data.game_id}`);
      else setFound(result.data);
    } catch (caught) {
      toast.error(message(caught, 'Could not find that code.'));
    }
  }

  return (
    <Card className="py-0" data-testid="quest-games">
      <CardContent className="grid gap-4 p-5 text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="grid flex-1 gap-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <Gamepad2Icon className="size-4" /> Games
            </h2>
            <p className="text-muted-foreground text-xs">
              Play the question bank together. Start a game and share its code, or type a code to join, on your own or
              in a team.
            </p>
          </div>
          <Button onClick={() => setStarting(true)} data-testid="game-new">
            <PlusIcon /> Start a game
          </Button>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
        >
          <Input
            value={code}
            onChange={(event) => setCode(normalizeGameCode(event.target.value).slice(0, GAME_CODE_LENGTH))}
            placeholder="Game or team code"
            aria-label="Game or team code"
            autoComplete="off"
            className="font-mono tracking-widest uppercase sm:w-56"
            data-testid="game-code"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={code.length !== GAME_CODE_LENGTH || lookup.isPending}
            data-testid="game-join"
          >
            <LogInIcon /> Join
          </Button>
        </form>
        {rows.length > 0 && (
          <ul className="divide-y rounded-lg border" data-testid="game-list">
            {rows.map((game) => (
              <li key={game.id}>
                <Link
                  to={`/quest/games/${game.id}`}
                  className="hover:bg-muted flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
                  data-testid={`game-row-${game.code}`}
                >
                  <span className="font-mono font-medium">{game.code}</span>
                  <span>{levelLabel(game.level_id)}</span>
                  <span className="text-muted-foreground">{gameLengthLabel(game)}</span>
                  <span className="text-muted-foreground">
                    {game.is_host ? 'You host' : `${game.host_first_name} hosts`} · {game.teams}{' '}
                    {game.teams === 1 ? 'team' : 'teams'}
                  </span>
                  <span className="ml-auto text-xs font-medium">
                    {game.status === 'finished'
                      ? game.place
                        ? `Finished · ${placeLabel(game.place)}`
                        : 'Finished'
                      : game.status === 'running'
                        ? 'Playing now'
                        : 'Waiting to start'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <StartGameDialog open={starting} onOpenChange={setStarting} />
      <JoinDialog lookup={found} onClose={() => setFound(null)} />
    </Card>
  );
}

function StartGameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const levels = useGameLevels(open);
  const create = useCreateGame();
  const navigate = useNavigate();
  const [levelId, setLevelId] = useState('');
  const [mode, setMode] = useState<GameMode>('count');
  const [count, setCount] = useState('10');
  const [minutes, setMinutes] = useState('5');
  const [negative, setNegative] = useState(false);
  const [teamSize, setTeamSize] = useState(String(GAME_LIMITS.defaultTeamSize));
  const options = (levels.data?.data ?? []).filter((level) => level.available > 0);

  async function submit() {
    const input: CreateGameInput = {
      level_id: levelId as CreateGameInput['level_id'],
      mode,
      negative_marking: negative,
      max_team_size: Number(teamSize),
      ...(mode === 'count' ? { question_count: Number(count) } : { duration_minutes: Number(minutes) }),
    };
    try {
      const game = await create.mutateAsync(input);
      onOpenChange(false);
      navigate(`/quest/games/${game.data.id}`);
    } catch (caught) {
      toast.error(message(caught, 'Could not start the game.'));
    }
  }

  const amount = mode === 'count' ? Number(count) : Number(minutes);
  const valid =
    Boolean(levelId) &&
    Number.isInteger(amount) &&
    (mode === 'count'
      ? amount >= GAME_LIMITS.minQuestions && amount <= GAME_LIMITS.maxQuestions
      : amount >= GAME_LIMITS.minMinutes && amount <= GAME_LIMITS.maxMinutes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="game-new-dialog">
        <DialogHeader>
          <DialogTitle>Start a game</DialogTitle>
          <DialogDescription>Choose the questions and the rules. You will get a code to share.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          id="game-new-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) void submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="game-level">Level</Label>
            <Select value={levelId} onValueChange={setLevelId}>
              <SelectTrigger id="game-level" data-testid="game-level">
                <SelectValue placeholder={levels.isPending ? 'Loading…' : 'Choose a level'} />
              </SelectTrigger>
              <SelectContent>
                {options.map((level) => (
                  <SelectItem key={level.level_id} value={level.level_id}>
                    {level.label} · {level.available} questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {levels.isSuccess && options.length === 0 && (
              <p className="text-muted-foreground text-xs">No level has approved questions to play yet.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Length</Label>
            <Toggle
              value={mode}
              onChange={setMode}
              options={[
                { value: 'count', label: 'A number of questions' },
                { value: 'timed', label: 'Against the clock' },
              ]}
              testId="game-mode"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                className="w-24"
                min={mode === 'count' ? GAME_LIMITS.minQuestions : GAME_LIMITS.minMinutes}
                max={mode === 'count' ? GAME_LIMITS.maxQuestions : GAME_LIMITS.maxMinutes}
                value={mode === 'count' ? count : minutes}
                onChange={(event) => (mode === 'count' ? setCount : setMinutes)(event.target.value)}
                aria-label={mode === 'count' ? 'Questions' : 'Minutes'}
                data-testid="game-amount"
              />
              <span className="text-muted-foreground">
                {mode === 'count'
                  ? `questions (${GAME_LIMITS.minQuestions}-${GAME_LIMITS.maxQuestions})`
                  : `minutes (${GAME_LIMITS.minMinutes}-${GAME_LIMITS.maxMinutes})`}
              </span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Marking</Label>
            <Toggle
              value={negative ? 'on' : 'off'}
              onChange={(value) => setNegative(value === 'on')}
              options={[
                { value: 'off', label: gameMarkingLabel(false) },
                { value: 'on', label: gameMarkingLabel(true) },
              ]}
              testId="game-marking"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="game-team-size">Team size</Label>
            <Select value={teamSize} onValueChange={setTeamSize}>
              <SelectTrigger id="game-team-size" className="w-48" data-testid="game-team-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: GAME_LIMITS.maxTeamSize }, (_, i) => i + 1).map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size === 1 ? 'Everyone on their own' : `Up to ${size} a team`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="game-new-form" disabled={!valid || create.isPending} data-testid="game-create">
            Create the game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Toggle<T extends string>({
  value,
  onChange,
  options,
  testId,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  testId: string;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          data-testid={`${testId}-${option.value}`}
          className={cn(
            'rounded-lg border px-3 py-2 text-sm transition-colors',
            'focus-visible:ring-ring outline-none focus-visible:ring-2',
            value === option.value ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function JoinDialog({ lookup, onClose }: { lookup: GameLookup | null; onClose: () => void }) {
  return (
    <Dialog open={lookup !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="game-join-dialog">
        {lookup && (
          <>
            <DialogHeader>
              <DialogTitle>
                {levelLabel(lookup.level_id)} · {gameLengthLabel(lookup)}
              </DialogTitle>
              <DialogDescription>
                {lookup.host_first_name}’s game · {gameMarkingLabel(lookup.negative_marking)} ·{' '}
                {lookup.max_team_size === 1 ? 'everyone on their own' : `teams of up to ${lookup.max_team_size}`}
              </DialogDescription>
            </DialogHeader>
            {lookup.status !== 'lobby' ? (
              <p className="text-sm">This game has {lookup.status === 'running' ? 'started' : 'ended'}, so it cannot be joined now.</p>
            ) : (
              <JoinChoices gameId={lookup.game_id} maxTeamSize={lookup.max_team_size} team={lookup.team} onJoined={onClose} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** How to join: on your own, by starting a team, or into a team by its code. In the dialog and the lobby. */
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
  onJoined?: () => void;
}) {
  const join = useJoinGame();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');

  async function go(input: JoinGameInput) {
    try {
      await join.mutateAsync({ gameId, ...input });
      onJoined?.();
      navigate(`/quest/games/${gameId}`);
    } catch (caught) {
      toast.error(message(caught, 'Could not join the game.'));
    }
  }

  if (team) {
    return (
      <div className="grid gap-3 text-sm">
        <p>
          Join the team <span className="font-semibold">{team.name}</span> ({team.players} of {maxTeamSize} so far).
        </p>
        <Button onClick={() => void go({ as: 'team', team_code: team.code })} disabled={join.isPending} data-testid="game-join-team-named">
          <UsersIcon /> Join {team.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-sm">
      <Button onClick={() => void go({ as: 'solo' })} disabled={join.isPending} data-testid="game-join-solo">
        Play on my own
      </Button>
      {maxTeamSize > 1 && (
        <>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (teamName.trim()) void go({ as: 'new_team', team_name: teamName });
            }}
          >
            <Input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Team name"
              aria-label="Team name"
              maxLength={30}
              data-testid="game-team-name"
            />
            <Button type="submit" variant="outline" disabled={!teamName.trim() || join.isPending} data-testid="game-join-new-team">
              Start a team
            </Button>
          </form>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (teamCode.length === GAME_CODE_LENGTH) void go({ as: 'team', team_code: teamCode });
            }}
          >
            <Input
              value={teamCode}
              onChange={(event) => setTeamCode(normalizeGameCode(event.target.value).slice(0, GAME_CODE_LENGTH))}
              placeholder="Team code"
              aria-label="Team code"
              autoComplete="off"
              className="font-mono tracking-widest uppercase"
              data-testid="game-team-code"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={teamCode.length !== GAME_CODE_LENGTH || join.isPending}
              data-testid="game-join-team"
            >
              Join a team
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
