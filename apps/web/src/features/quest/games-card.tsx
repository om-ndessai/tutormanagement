import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Gamepad2Icon, LogInIcon, PlusIcon, UsersIcon } from 'lucide-react';
import {
  GAME_CODE_LENGTH,
  gameLengthLabel,
  gameLevelLabel,
  gameMarkingLabel,
  gamePlayersLabel,
  levelLabel,
  normalizeGameCode,
  placeLabel,
  type GameLookup,
  type JoinGameInput,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGames, useJoinGame, useLookupGame } from './games-api';

// Phase 46: Quest Games on the Quest page -- for everyone in the organization.
// Start a game (Phase 47: the wizard, /quest/games/new), or type a code to
// join one. docs/quest-games-plan.md, docs/quest-games-g2-plan.md.

const message = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

export function GamesCard() {
  const games = useGames();
  const lookup = useLookupGame();
  const [code, setCode] = useState('');
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
              Play the question bank together. Start a game and share its code, or type a code to join, on your own or in a team.
            </p>
          </div>
          <Button asChild data-testid="game-new">
            <Link to="/quest/games/new">
              <PlusIcon /> Start a game
            </Link>
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
                  <span>{gameLevelLabel(game, levelLabel)}</span>
                  <span className="text-muted-foreground">{gameLengthLabel(game)}</span>
                  <span className="text-muted-foreground">
                    {game.players === 'single'
                      ? 'Single player'
                      : `${game.is_host ? 'You host' : `${game.host_first_name} hosts`} · ${game.teams} ${game.teams === 1 ? 'team' : 'teams'}`}
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
      <JoinDialog lookup={found} onClose={() => setFound(null)} />
    </Card>
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
                {gameLevelLabel(lookup, levelLabel)} · {gameLengthLabel(lookup)}
              </DialogTitle>
              <DialogDescription>
                {lookup.host_first_name}’s game · {gameMarkingLabel(lookup)} · {gamePlayersLabel(lookup)}
                {lookup.knockout ? ' · knockout' : ''}
              </DialogDescription>
            </DialogHeader>
            {lookup.players === 'single' ? (
              <p className="text-sm">This is {lookup.host_first_name}’s single-player game, so it cannot be joined.</p>
            ) : !lookup.open ? (
              <p className="text-sm">
                This game has {lookup.status === 'finished' ? 'ended' : 'started'}, so it cannot be joined now.
              </p>
            ) : (
              <>
                {lookup.status === 'running' && (
                  <p className="text-sm">This game is under way: you can still join, and start from its first question.</p>
                )}
                <JoinChoices gameId={lookup.game_id} maxTeamSize={lookup.max_team_size} team={lookup.team} onJoined={onClose} />
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * How to join, in the dialog and the lobby. Everyone on their own: one Join.
 * Teams (Phase 47): start a team -- which gets its own code to share -- or
 * type a team's code, so a teammate types two codes, the game's then the team's.
 */
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
        <Button
          onClick={() => void go({ as: 'team', team_code: team.code })}
          disabled={join.isPending}
          data-testid="game-join-team-named"
        >
          <UsersIcon /> Join {team.name}
        </Button>
      </div>
    );
  }

  if (maxTeamSize === 1) {
    return (
      <div className="grid gap-4 text-sm">
        <Button onClick={() => void go({ as: 'solo' })} disabled={join.isPending} data-testid="game-join-solo">
          Join the game
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-sm">
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
    </div>
  );
}
