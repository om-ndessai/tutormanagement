import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRightLeftIcon, CheckIcon, CopyIcon, CrownIcon, FlagIcon, PlayIcon, SkipForwardIcon, TimerIcon, XIcon } from 'lucide-react';
import {
  clockLabel,
  gameEncouragement,
  gameEndLabel,
  gameLengthLabel,
  gameLevelLabel,
  gameMarkingLabel,
  gamePlayersLabel,
  levelLabel,
  placeLabel,
  pointsLabel,
  winnersLabel,
  type GameQuestion,
  type GameTeamView,
  type GameView,
} from '@tmi/shared';

import { LobbyInvite } from './lobby-invite';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { MathText } from '@/features/question-bank/math-text';
import { QuestFrame } from './fullscreen-frame';
import { Confetti, DoorsCountdown, KnockoutBurst, useCountdown } from './game-effects';
import { JoinChoices } from './games-card';
import { gameIsMissing, useGame, useGameAction, useGameResults } from './games-api';
import { backLabel, useExitTo } from './play-origin';
import { ShareButton } from '@/features/sharing/share-button';

// Phase 46: one Quest game, full screen -- the lobby while players join, the
// play with the scoreboard beside it, then the results. Polled every couple of
// seconds; the next question comes back with each answer. docs/quest-games-plan.md.
// Phase 47 (docs/quest-games-g2-plan.md): the doors' countdown when the host
// starts the Quest, the status page while a player waits for the others, and
// the ending -- confetti for the winners, a knockout stamp, encouragement.

const LETTERS = ['A', 'B', 'C', 'D'];
const message = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

/** Phase 73 (JF16): nobody answered anything (a skip counts) -- not a result: no winner, confetti or "You won". */
function nobodyPlayed(game: Pick<GameView, 'teams'>): boolean {
  return game.teams.every((team) => team.answered === 0);
}

/** Phase 77 (JF15): a game played on this device, by the reader and the children they seated (the host's view only). */
function isSeated(game: Pick<GameView, 'seats'>): boolean {
  return (game.seats?.length ?? 0) > 0;
}

/** One player's hand in a seated game: a child's (answered with `as_user_id`) or the reader's own. */
interface Hand {
  /** Null for the reader's own hand. */
  seat: string | null;
  name: string;
  team_id: string | null;
  question: GameQuestion | null;
}

/** The children first, in the order they were seated, then the reader: the child goes first on each question. */
function handsOf(game: GameView): Hand[] {
  const mine = game.teams.find((team) => team.id === game.me.team_id);
  return [
    ...(game.seats ?? []).map((seat) => ({
      seat: seat.user_id,
      name: seat.first_name,
      team_id: seat.team_id,
      question: seat.question,
    })),
    { seat: null, name: mine?.name ?? game.host.first_name, team_id: game.me.team_id, question: game.me.question },
  ];
}

/**
 * Whose turn it is: whoever is furthest behind in the series (every team plays the same one), the child before the
 * reader on a tie. Derived from the game alone, so leaving and coming back resumes on the same turn.
 */
function turnOf(hands: readonly Hand[]): Hand | null {
  let turn: Hand | null = null;
  for (const hand of hands) {
    if (hand.question && (!turn || hand.question.number < turn.question!.number)) turn = hand;
  }
  return turn;
}

const turnTitle = (hand: Hand) => (hand.seat ? `${hand.name}'s turn` : 'Your turn');

/** "Ben", "Ben and you", "Ben, Leo and you". */
function andList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

const pointWords = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

/**
 * Phase 73 (JF36): ending a game asks first, as the app does -- "Cancel the game" in the lobby, "End the game now"
 * while it runs.
 */
function ConfirmEnd({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  keep,
  onConfirm,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  keep: string;
  onConfirm: () => void;
  testId: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`${testId}-keep`}>{keep}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            data-testid={`${testId}-yes`}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Milliseconds left on a timed game, ticking on the device but set by the server's clock. */
function useTimeLeft(game: GameView | undefined): number | null {
  const [tick, setTick] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (game) setOffset(Date.parse(game.now) - Date.now());
  }, [game?.now]);
  const running = game?.status === 'running' && game.ends_at !== null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!game?.ends_at || game.status !== 'running') return null;
  return Date.parse(game.ends_at) - (tick + offset);
}

/** While a poll is failing: the game stays as it was, and this says it is catching up. */
function Reconnecting({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p
      role="status"
      className="bg-muted text-muted-foreground mb-3 rounded-md px-3 py-2 text-center text-sm"
      data-testid="game-reconnecting"
    >
      Reconnecting to the game…
    </p>
  );
}

export function GamePage() {
  const { gameId = '' } = useParams();
  const query = useGame(gameId);
  const game = query.data?.data;
  const left = useTimeLeft(game);
  const myTeam = game?.teams.find((team) => team.id === game.me.team_id);
  const countdown = useCountdown(game?.status === 'running' ? game.started_at : null, game?.now);
  const counting = countdown > 0;
  // Phase 73 (JF36): Exit returns to where the game was opened (the home, the Quest page).
  const exitTo = useExitTo();
  // The doors open: ask for the first question at once rather than at the next poll.
  const refetch = query.refetch;
  useEffect(() => {
    if (!counting && game?.status === 'running') void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting]);

  return (
    <QuestFrame
      title={game ? `Quest game · ${gameLevelLabel(game, levelLabel)}` : 'Quest game'}
      shortTitle="Game"
      testId="game-page"
      exitTo={exitTo}
      status={
        game ? (
          <>
            {left !== null && !counting && (
              <span
                className={cn('flex items-center gap-1 font-medium tabular-nums', left < 30_000 && 'text-destructive')}
                data-testid="game-clock"
              >
                <TimerIcon className="size-4" /> {clockLabel(left)}
              </span>
            )}
            {/* Phase 77 (JF15): on one device, every player's score side by side, by first name. */}
            {isSeated(game) && game.status !== 'lobby' ? (
              <SeatScores game={game} />
            ) : (
              myTeam &&
              game.status !== 'lobby' && (
                <span className="text-foreground font-medium tabular-nums" data-testid="game-my-score">
                  {myTeam.score} {myTeam.score === 1 ? 'point' : 'points'}
                </span>
              )
            )}
          </>
        ) : null
      }
    >
      {query.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : !game && !gameIsMissing(query.error) ? (
        <Card className="py-0" data-testid="game-unreachable">
          <CardContent className="grid gap-4 p-6 text-sm">
            <p>Could not reach the game just now. Check your connection, then try again.</p>
            <Button variant="outline" className="w-fit" onClick={() => void query.refetch()} disabled={query.isFetching}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !game || gameIsMissing(query.error) ? (
        <Card className="py-0" data-testid="game-missing">
          <CardContent className="grid gap-4 p-6 text-sm">
            <p>This game was not found, or you are not in it. Join it with its code from the Quest page.</p>
            <Button asChild variant="outline" className="w-fit">
              <Link to="/quest">Back to Quest</Link>
            </Button>
          </CardContent>
        </Card>
      ) : game.status === 'lobby' ? (
        <>
          <Reconnecting show={query.isError} />
          <Lobby game={game} exitTo={exitTo} />
        </>
      ) : game.status === 'running' ? (
        <>
          {counting && <DoorsCountdown msLeft={countdown} />}
          <Reconnecting show={query.isError} />
          <Play game={game} counting={counting} />
        </>
      ) : (
        <Results game={game} exitTo={exitTo} />
      )}
    </QuestFrame>
  );
}

function Rules({ game }: { game: GameView }) {
  // Phase 77 (JF15): a game on this device names who plays it, rather than how many may.
  const players = isSeated(game)
    ? `${andList([...(game.seats ?? []).map((seat) => seat.first_name), 'you'])}, on this device`
    : gamePlayersLabel(game);
  return (
    <p className="text-muted-foreground text-sm">
      {gameLevelLabel(game, levelLabel)} · {gameLengthLabel(game)} · {gameMarkingLabel(game)} · {players}
      {game.knockout && ' · knockout'}
      {game.late_join && ' · joining open while it runs'}
      {game.unreviewed && ' · may include questions not yet reviewed'}
    </p>
  );
}

function Lobby({ game, exitTo }: { game: GameView; exitTo: string }) {
  const action = useGameAction(game.id);
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const players = game.teams.reduce((n, team) => n + team.players.length, 0);
  const mine = game.teams.find((team) => team.id === game.me.team_id);

  async function run(kind: 'start' | 'leave' | 'end') {
    try {
      const reply = await action.mutateAsync({ kind });
      // Having left, a player may no longer see the game (the reply is null; an admin's is the game without them):
      // back to where it was opened, as in the app. A host who leaves their team stays to run it.
      const gone = reply.data === null || (!reply.data.is_host && reply.data.me.team_id === null);
      if (kind === 'leave' && gone) {
        toast.success('You left the game.');
        navigate(exitTo);
      }
    } catch (caught) {
      toast.error(message(caught, 'That did not work.'));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <Card className="py-0">
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Game code</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-5xl font-bold tracking-[0.2em]" data-testid="game-lobby-code">
                {game.code}
              </span>
              <CopyButton text={game.code} />
            </div>
            <Rules game={game} />
            {/* Phase 62 (P7): a QR code and Share, so the people at the table join in a tap. */}
            {game.status === 'lobby' && <LobbyInvite code={game.code} title="Aimtrue Quest game" />}
          </div>
          {mine?.code && (
            <p className="bg-primary/10 rounded-lg px-4 py-3 text-sm">
              Your team <span className="font-semibold">{mine.name}</span>’s code:{' '}
              <span className="font-mono font-semibold tracking-widest" data-testid="game-team-code-shown">
                {mine.code}
              </span>
              . Teammates type it to join you.
            </p>
          )}
          {/* Phase 77 (JF15): whom the roster invited -- the host's and the admins' to read. */}
          {(game.invited?.length ?? 0) > 0 && (
            <p className="text-sm" data-testid="game-lobby-invited">
              <span className="font-medium">Invited:</span>{' '}
              {game.invited!
                .map((person) =>
                  game.teams.some((team) => team.players.some((p) => p.user_id === person.user_id))
                    ? `${person.first_name} (joined)`
                    : person.first_name,
                )
                .join(', ')}
            </p>
          )}
          {!mine && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Join this game</p>
              <JoinChoices gameId={game.id} maxTeamSize={game.max_team_size} host={game.is_host} teamCount={game.teams.length} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {game.is_host && (
              <Button
                size="lg"
                onClick={() => void run('start')}
                disabled={players === 0 || action.isPending}
                data-testid="game-start"
              >
                <PlayIcon /> Start the Quest
              </Button>
            )}
            {mine && (
              <Button variant="outline" onClick={() => void run('leave')} disabled={action.isPending} data-testid="game-leave">
                Leave
              </Button>
            )}
            {game.is_host && (
              <Button variant="ghost" onClick={() => setCancelling(true)} disabled={action.isPending} data-testid="game-cancel">
                Cancel the game
              </Button>
            )}
          </div>
          <ConfirmEnd
            open={cancelling}
            onOpenChange={setCancelling}
            title="Cancel the game?"
            body="Nobody will be able to play it."
            confirm="Cancel the game"
            keep="Keep the game"
            onConfirm={() => void run('end')}
            testId="game-cancel-confirm"
          />
          {!game.is_host && <p className="text-muted-foreground text-sm">Waiting for {game.host.first_name} to begin…</p>}
        </CardContent>
      </Card>
      <Scoreboard
        game={game}
        title={`${players} ${players === 1 ? 'player' : 'players'} · ${game.teams.length} of ${game.max_teams} ${game.max_team_size === 1 ? 'places' : 'teams'}`}
      />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Copy the code"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => toast.success('Code copied.'))
          .catch(() => undefined);
      }}
    >
      <CopyIcon />
    </Button>
  );
}

function Scoreboard({ game, title }: { game: GameView; title: string }) {
  // A timed game's series is only the most it draws: no "of 150".
  const total = game.mode === 'count' ? game.series_length : null;
  return (
    <Card className="py-0" data-testid="game-scoreboard">
      <CardContent className="grid gap-3 p-5 text-sm">
        <h2 className="font-semibold">{title}</h2>
        {game.teams.length === 0 ? (
          <p className="text-muted-foreground">Nobody has joined yet. Share the code.</p>
        ) : (
          <ol className="grid gap-2">
            {game.teams.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                mine={team.id === game.me.team_id}
                total={total}
                showScore={game.status !== 'lobby'}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
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
  return (
    <li
      className={cn('flex items-start gap-3 rounded-lg border px-3 py-2', mine && 'border-primary bg-primary/5')}
      data-testid={`game-team-${team.name}`}
    >
      {team.place !== null && (
        <span className="flex w-10 shrink-0 items-center gap-1 pt-0.5 text-xs font-semibold">
          {team.place === 1 && <CrownIcon className="text-primary size-3.5" />}
          {placeLabel(team.place)}
        </span>
      )}
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium">
          {team.name}
          {mine && <span className="text-muted-foreground font-normal"> (you)</span>}
        </span>
        {!team.solo && (
          <span className="text-muted-foreground truncate text-xs">{team.players.map((p) => p.first_name).join(', ')}</span>
        )}
      </div>
      {showScore && (
        <div className="grid w-24 shrink-0 justify-items-end gap-1">
          <span className="font-semibold tabular-nums" data-testid={`game-team-score-${team.name}`}>
            {team.score}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums" data-testid={`game-team-status-${team.name}`}>
            {team.finished_at ? 'Done' : total !== null ? `${team.answered}/${total}` : `${team.answered} answered`}
          </span>
          {total !== null && (
            <span className="bg-muted h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
              <span
                className="bg-primary block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.min(100, (team.answered / Math.max(1, total)) * 100)}%` }}
              />
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function Play({ game, counting }: { game: GameView; counting: boolean }) {
  if (isSeated(game)) return <SeatedPlay game={game} counting={counting} />;
  return <TeamPlay game={game} counting={counting} />;
}

function TeamPlay({ game, counting }: { game: GameView; counting: boolean }) {
  const action = useGameAction(game.id);
  const [ending, setEnding] = useState(false);
  const playing = game.me.team_id !== null;
  const mine = game.teams.find((team) => team.id === game.me.team_id);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="grid gap-4">
        {!playing ? (
          <Card className="py-0">
            <CardContent className="grid gap-3 p-6 text-sm">
              <p>You are hosting. The scores update as the teams play.</p>
            </CardContent>
          </Card>
        ) : counting ? (
          <Card className="py-0">
            <CardContent className="grid gap-2 p-6 text-sm">
              <p className="font-medium">Get ready: the doors are opening…</p>
            </CardContent>
          </Card>
        ) : game.me.question ? (
          <div key={game.me.question.id} className="quest-enter">
            <QuestionPanel
              gameId={game.id}
              question={game.me.question}
              total={game.mode === 'count' ? game.series_length : null}
            />
          </div>
        ) : (
          <Card className="py-0" data-testid="game-waiting">
            <CardContent className="grid gap-2 p-6 text-sm">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Game status</p>
              {mine?.finished_at ? (
                <>
                  <p className="text-xl font-semibold">
                    {mine.solo ? 'You are done' : 'Your team is done'}: {mine.score} {mine.score === 1 ? 'point' : 'points'}.
                  </p>
                  <p className="text-muted-foreground">
                    Waiting for the others to finish{game.mode === 'timed' ? ' or the time to run out' : ''}
                    {game.knockout ? ', or for a knockout' : ''}. The scores update here as they play.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Your team has no more questions to hand out.</p>
                  <p className="text-muted-foreground">
                    Your teammates are answering the last ones. The game ends when every team is done
                    {game.mode === 'timed' ? ' or the time is up' : ''}.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
        {(game.is_host || false) && (
          <>
            <Button variant="outline" className="w-fit" onClick={() => setEnding(true)} data-testid="game-end">
              <FlagIcon /> End the game now
            </Button>
            <ConfirmEnd
              open={ending}
              onOpenChange={setEnding}
              title="End the game now?"
              body="Every team stops where it is, and the places are given."
              confirm="End the game"
              keep="Keep playing"
              onConfirm={() =>
                void action.mutateAsync({ kind: 'end' }).catch((caught) => toast.error(message(caught, 'Could not end the game.')))
              }
              testId="game-end-confirm"
            />
          </>
        )}
      </div>
      <Scoreboard game={game} title="Scores" />
    </div>
  );
}

/** Phase 77 (JF15): every player's score on one device, side by side by first name; the turn said in words too. */
function SeatScores({ game }: { game: GameView }) {
  const hands = handsOf(game);
  const turn = game.status === 'running' ? turnOf(hands) : null;
  return (
    <span className="flex items-center gap-1.5 font-medium tabular-nums sm:gap-3" data-testid="game-seat-scores">
      {hands.map((hand) => {
        const team = game.teams.find((t) => t.id === hand.team_id);
        const now = turn === hand;
        return (
          <span
            key={hand.seat ?? 'me'}
            className={cn('rounded-full border px-2.5 py-0.5', now ? 'border-primary bg-primary/10' : 'border-transparent')}
            data-testid={`game-seat-score-${hand.name}`}
          >
            {hand.name}
            {!hand.seat && <span className="max-sm:sr-only"> (you)</span>} {team?.score ?? 0}
            {now && <span className="sr-only">, whose turn it is</span>}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Phase 77 (JF15): a game on this device -- the reader and the children they seated, a solo team each, playing the same
 * series. Turns on one screen: the child first on each question ("Ben's turn", answered for Ben), then the reader
 * ("Your turn"); each says whose turn it is in words, with a hand-over line.
 */
function SeatedPlay({ game, counting }: { game: GameView; counting: boolean }) {
  const action = useGameAction(game.id);
  const [ending, setEnding] = useState(false);
  const hands = handsOf(game);
  const turn = turnOf(hands);
  const children = hands.filter((hand) => hand.seat).map((hand) => hand.name);
  const total = game.mode === 'count' ? game.series_length : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="grid gap-4">
        {counting ? (
          <Card className="py-0">
            <CardContent className="grid gap-2 p-6 text-sm">
              <p className="font-medium">Get ready: {children[0]} goes first.</p>
            </CardContent>
          </Card>
        ) : turn ? (
          <div key={`${turn.seat ?? 'me'}-${turn.question!.id}`} className="quest-enter grid gap-4">
            <Card className="py-0" data-testid="game-turn" data-turn={turn.seat ? turn.name : 'you'}>
              <CardContent className="flex items-center gap-4 p-5">
                <span
                  className="bg-primary text-primary-foreground font-display grid size-12 shrink-0 place-items-center rounded-full text-xl font-bold"
                  aria-hidden
                >
                  {turn.name[0]}
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <h2 className="font-display text-2xl font-bold" data-testid="game-turn-title">
                    {turnTitle(turn)}
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm" data-testid="game-hand-over">
                    <ArrowRightLeftIcon className="size-4 shrink-0" aria-hidden />
                    {turn.seat
                      ? `Pass the device to ${turn.name}.`
                      : `${andList(children)} ${children.length === 1 ? 'has' : 'have'} answered: take the device back.`}
                  </p>
                </div>
              </CardContent>
            </Card>
            <QuestionPanel
              gameId={game.id}
              question={turn.question!}
              total={total}
              seat={turn.seat ? { user_id: turn.seat, name: turn.name } : null}
            />
          </div>
        ) : (
          <Card className="py-0" data-testid="game-waiting">
            <CardContent className="grid gap-2 p-6 text-sm">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Game status</p>
              <p className="font-medium">Everyone has answered. The results are on their way.</p>
            </CardContent>
          </Card>
        )}
        <Button variant="outline" className="w-fit" onClick={() => setEnding(true)} data-testid="game-end">
          <FlagIcon /> End the game now
        </Button>
        <ConfirmEnd
          open={ending}
          onOpenChange={setEnding}
          title="End the game now?"
          body="Everyone stops where they are, and the places are given."
          confirm="End the game"
          keep="Keep playing"
          onConfirm={() =>
            void action.mutateAsync({ kind: 'end' }).catch((caught) => toast.error(message(caught, 'Could not end the game.')))
          }
          testId="game-end-confirm"
        />
      </div>
      <Scoreboard game={game} title="Scores" />
    </div>
  );
}

function QuestionPanel({
  gameId,
  question,
  total,
  seat = null,
}: {
  gameId: string;
  question: GameQuestion;
  total: number | null;
  /** Phase 77 (JF15): a child playing on this device, whose hand this answers. */
  seat?: { user_id: string; name: string } | null;
}) {
  const action = useGameAction(gameId);
  const [choice, setChoice] = useState<number | null>(null);
  const [number, setNumber] = useState('');
  const response = question.kind === 'choice' ? (choice === null ? '' : question.choices[choice]!) : number.trim();

  async function send(skip: boolean) {
    try {
      const whose = seat ? { as_user_id: seat.user_id } : {};
      const reply = await action.mutateAsync(
        skip
          ? { kind: 'answer', question_id: question.id, skip: true, ...whose }
          : { kind: 'answer', question_id: question.id, answer: response, ...whose },
      );
      const last = seat ? reply.data?.seats?.find((s) => s.user_id === seat.user_id)?.last : reply.data?.me.last;
      // On one device, the toast says whose answer it was.
      const who = seat ? `${seat.name}: ` : '';
      if (last?.skipped) toast(`${who}Skipped.`, { duration: 1200 });
      else if (last?.correct) toast.success(`${who}Right! ${pointsLabel(reply.data?.right_points ?? 1)}`, { duration: 1200 });
      else
        toast.error(
          reply.data && reply.data.wrong_points < 0 ? `${who}Not quite. ${pointsLabel(reply.data.wrong_points)}` : `${who}Not quite.`,
          { duration: 1200 },
        );
    } catch (caught) {
      toast.error(message(caught, 'Could not send your answer.'));
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="py-0" data-testid="game-question">
        <CardContent className="grid gap-3 p-6">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Question {question.number}
              {total !== null ? ` of ${total}` : ''}
            </p>
            {/* Phase 62 (P3): a checked question no person has approved yet. */}
            {question.beta && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px]"
                data-testid="game-question-beta"
                title="A new question: it passed every automatic check, and no person has approved it yet."
              >
                Beta
              </Badge>
            )}
          </div>
          <MathText text={question.stem} className="text-lg leading-relaxed" />
        </CardContent>
      </Card>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (response) void send(false);
        }}
      >
        {question.kind === 'choice' ? (
          <div role="radiogroup" aria-label={seat ? `${seat.name}'s answer` : 'Your answer'} className="grid gap-2">
            {question.choices.map((text, i) => {
              const selected = choice === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`game-choice-${LETTERS[i]}`}
                  onClick={() => setChoice(selected ? null : i)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors',
                    'focus-visible:ring-ring outline-none focus-visible:ring-2',
                    selected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  <MathText text={text} />
                </button>
              );
            })}
          </div>
        ) : (
          <Input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            // The full keyboard: iOS's decimal pad has no fraction bar and no minus sign, and an
            // answer may be 3/4 or -3. Nothing a phone corrects or capitalises.
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="A number, like 12, 3/4 or 2.5"
            className="h-14 text-lg"
            aria-label={seat ? `${seat.name}'s answer` : 'Your answer'}
            data-testid="game-number"
            autoFocus
          />
        )}
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={!response || action.isPending} data-testid="game-submit">
            Submit
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => void send(true)}
            disabled={action.isPending}
            data-testid="game-skip"
          >
            <SkipForwardIcon /> Skip
          </Button>
        </div>
      </form>
    </div>
  );
}

function Results({ game, exitTo }: { game: GameView; exitTo: string }) {
  const overseer = game.is_host || game.me.team_id === null;
  const [team, setTeam] = useState<string | null>(null);
  const results = useGameResults(game.id, team, true);
  const data = results.data?.data;
  const shownTeam = game.teams.find((t) => t.id === (data?.team_id ?? null));
  const mine = game.teams.find((t) => t.id === game.me.team_id);
  const single = game.players === 'single';
  // Phase 77 (JF15): on one device, each player's own result, and no "team" words.
  const seated = isSeated(game);
  // Phase 73 (JF16): a game nobody answered in is not a result -- "Nobody played", and nothing to celebrate.
  const empty = nobodyPlayed(game);
  // A single player has nobody to beat: confetti for any right answer, and their score as the headline. A family on
  // one device celebrates whoever wins.
  const won = !empty && (seated || (single ? (mine?.correct ?? 0) > 0 : mine?.place === 1));
  const ending = gameEndLabel(game.end_reason);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      {won && <Confetti />}
      {game.end_reason === 'knockout' && <KnockoutBurst />}
      <div className="grid gap-4">
        <Card className="py-0">
          <CardContent className="grid gap-2 p-6">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">The game is over</p>
            {ending && (
              <p
                className={cn('text-sm font-semibold', game.end_reason === 'knockout' && 'text-destructive')}
                data-testid="game-end-reason"
              >
                {ending}
              </p>
            )}
            {single && !empty && data?.new_best && (
              <Badge className="w-fit" data-testid="game-new-best">
                New best!
              </Badge>
            )}
            <h2 className="text-2xl font-bold" data-testid="game-winner">
              {empty
                ? 'Nobody played'
                : single && mine
                  ? `${mine.correct} right, ${mine.score} ${mine.score === 1 ? 'point' : 'points'}`
                  : winnersLabel(game.teams)}
            </h2>
            {seated && !empty && (
              <ul className="grid gap-1 text-base" data-testid="game-seated-results">
                {game.teams.map((t) => (
                  <li key={t.id} data-testid={`game-seated-result-${t.name}`}>
                    <span className="font-medium">{t.id === game.me.team_id ? 'You' : t.name}:</span> {t.correct} right,{' '}
                    {pointWords(t.score)}
                    {t.place !== null && <span className="text-muted-foreground"> · {placeLabel(t.place)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {mine && !seated && (
              <p className="text-base" data-testid="game-encouragement">
                {single
                  ? gameEncouragement(mine)
                  : won
                    ? mine.solo
                      ? `You won with ${mine.score} ${mine.score === 1 ? 'point' : 'points'}. Fantastic!`
                      : `Your team won with ${mine.score} ${mine.score === 1 ? 'point' : 'points'}. Fantastic!`
                    : gameEncouragement(mine)}
              </p>
            )}
            <Rules game={game} />
          </CardContent>
        </Card>
        <Scoreboard game={game} title="Final places" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="w-fit" data-testid="game-results-back">
            <Link to={exitTo}>{backLabel(exitTo)}</Link>
          </Button>
          {/* Phase 56: the reader's own team's result, as a public card. */}
          {mine && !empty && <ShareButton input={{ kind: 'game_result', game_id: game.id }} label="Share the result" size="default" />}
        </div>
      </div>
      <Card className="py-0" data-testid="game-review">
        <CardContent className="grid gap-4 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-semibold">{shownTeam ? `${shownTeam.name}’s questions` : 'Questions'}</h2>
            {overseer &&
              game.teams.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={t.id === data?.team_id ? 'default' : 'outline'}
                  onClick={() => setTeam(t.id)}
                >
                  {t.name}
                </Button>
              ))}
          </div>
          {results.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : !data || data.items.length === 0 ? (
            <p className="text-muted-foreground">No questions were answered.</p>
          ) : (
            <ol className="grid gap-3">
              {data.items.map((item) => (
                <li key={item.number} className="grid gap-2 rounded-lg border p-4" data-testid={`game-review-${item.number}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">Question {item.number}</span>
                    {item.skipped ? (
                      <Badge variant="outline">Skipped</Badge>
                    ) : item.correct ? (
                      <Badge>
                        <CheckIcon /> Right
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XIcon /> Not quite
                      </Badge>
                    )}
                    {item.answered_by && <span className="text-muted-foreground ml-auto text-xs">{item.answered_by}</span>}
                    {/* Phase 56: a question the reader's own team got right, as "Can you solve this?". */}
                    {item.correct && !item.skipped && data?.team_id === game.me.team_id && (
                      <ShareButton
                        input={{ kind: 'challenge', game_id: game.id, question_id: item.question.id }}
                        label="Challenge a friend"
                        testId={`share-challenge-${item.number}`}
                      />
                    )}
                  </div>
                  <MathText text={item.question.stem} />
                  {!item.skipped && item.answer !== null && (
                    <p className="text-muted-foreground">
                      Answered: <MathText text={item.answer} />
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Answer: </span>
                    <MathText text={item.question.answer} />
                  </p>
                  {item.question.solution && (
                    <details className="text-muted-foreground">
                      <summary className="cursor-pointer">Solution</summary>
                      <MathText text={item.question.solution} className="mt-2 block" />
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
