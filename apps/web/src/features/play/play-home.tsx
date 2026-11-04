import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayIcon, PlusIcon, StarIcon, UsersIcon } from 'lucide-react';
import {
  DAILY_SET_SIZE,
  GAME_CODE_LENGTH,
  GAME_LIMITS,
  SPACE_CODE_LENGTH,
  tileGameRequest,
  gameLengthLabel,
  levelLabel,
  TILE_LEVEL_WORDS,
  boardGrades,
  boardLeadGrade,
  memberBoard,
  offBoardTiles,
  tileLook,
  tileSpoken,
  type CanvasAssessmentLevelId,
  type QuestionBankLevelId,
  type CreateGameRequest,
  type GameFavorite,
  type GameLookup,
  type MemberTile,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { guestLeadLevel, guestMemory } from '@/features/guest/guest-store';
import { MyProgressCard } from '@/features/habit/my-progress-card';
import { useAskToJoin } from '@/features/organizations/api';
import { JoinDialog } from '@/features/quest/games-card';
import { useCreateGame, useGameFavorites, useLookupGame, useSaveGameFavorite } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useStartCanvasAssessment } from '@/features/canvas-assessments/api';
import { useDaily } from '@/features/habit/habit-api';
import { GradeRow, QuestCard, TodayCard, type RingState } from './quest-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { readLastQuest, useMemberTiles, useRosterMembers, useWaitingGames, writeLastQuest } from './play-api';

/** One tap: the game is made and begun (a single player's), remembered for Continue, and opened. */
export function useStartQuest() {
  const create = useCreateGame();
  const navigate = useNavigate();
  const { organization } = useAuth();
  async function start(label: string, request: CreateGameRequest, roster?: string[] | null) {
    try {
      // Phase 62 (P7): from a multiplayer favorite the host is in the game from the start; (P8) its
      // roster's people are invited and see it under "Waiting for you".
      const game = await create.mutateAsync(
        request.players === 'multi'
          ? { ...request, host_plays: true, ...(roster?.length ? { invite_user_ids: roster } : {}) }
          : request,
      );
      writeLastQuest(organization?.slug, { label, request });
      navigate(`/quest/games/${game.data.id}`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'That quest could not start.');
    }
  }
  return { start, pending: create.isPending };
}

/**
 * Phase 63 (P13, "the device's played tiles become favorites"): once a member's tiles and favorites have
 * loaded, the tiles this browser played as a guest are saved as favorites -- those this space offers,
 * not already a favorite, within the limit -- and each is carried once.
 */
function useCarryGuestTiles(list: MemberTile[], favorites: GameFavorite[] | undefined) {
  const save = useSaveGameFavorite();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !favorites || list.length === 0) return;
    const codes = guestMemory.uncarried();
    if (codes.length === 0) return;
    done.current = true;
    const have = new Set(favorites.map((favorite) => favorite.name));
    const room = Math.max(0, GAME_LIMITS.maxFavorites - favorites.length);
    const carry = codes
      .map((code) => list.find((tile) => tile.code === code))
      .filter((tile): tile is MemberTile => tile !== undefined && !have.has(tile.code))
      .slice(0, room);
    void (async () => {
      for (const tile of carry) {
        try {
          await save.mutateAsync({ name: tile.code, config: tileGameRequest(tile) });
        } catch {
          // Not carried: the member can still star it.
        }
      }
      guestMemory.markCarried(codes);
    })();
  }, [list, favorites, save]);
}

/**
 * Phase 62 (P6): the members' Play home -- Continue, favorites, the tiles and a code box, every one a
 * quest in one tap. The home of a space without Tutoring, and of a student anywhere.
 */
export function PlayHome({ hideWaiting = false }: { hideWaiting?: boolean } = {}) {
  const { organization, user } = useAuth();
  const startAssessment = useStartCanvasAssessment();
  const tiles = useMemberTiles();
  const favorites = useGameFavorites();
  const saveFavorite = useSaveGameFavorite();
  const { start, pending } = useStartQuest();
  const navigate = useNavigate();
  const last = readLastQuest(organization?.slug);
  const list = tiles.data?.data.tiles ?? [];
  const starred = new Set((favorites.data?.data ?? []).map((favorite) => favorite.name));

  // P13: until a quest is started in this space here, a guest's grade (or the tile they played last) leads.
  const [guestLead] = useState(guestLeadLevel);
  const lead = (last?.request.level_id ?? guestLead) as QuestionBankLevelId | null | undefined;
  useCarryGuestTiles(list, favorites.data?.data);

  // Phase 67 (H5): the Quest board -- a grade row, that grade's cards in its hue, then levels off the row.
  const grades = boardGrades(list);
  const [chosenGrade, setChosenGrade] = useState<number | null>(null);
  const grade = chosenGrade ?? boardLeadGrade(list, lead);
  const board = useMemo(() => (grade ? memberBoard(list, grade) : { standard: [], advanced: [] }), [list, grade]);
  const offBoard = useMemo(() => {
    const map = new Map<string, MemberTile[]>();
    for (const tile of offBoardTiles(list)) {
      const words = TILE_LEVEL_WORDS[tile.level_id];
      map.set(words, [...(map.get(words) ?? []), tile]);
    }
    return [...map.entries()];
  }, [list]);

  if (tiles.data && !tiles.data.data.play_home) return null;

  // Phase 64 (P19): the Daily of the lead level, else of the chosen grade's first tile, else the first tile's.
  const dailyTile = list.find((tile) => tile.level_id === lead) ?? board.standard[0] ?? list[0];
  const dailyLevel = dailyTile?.level_id ?? null;
  const dailyTag = dailyTile ? `${dailyTile.code.replace(/[QTA]\d+$/, '')}D` : '';

  async function star(tile: MemberTile) {
    try {
      await saveFavorite.mutateAsync({ name: tile.code, config: tileGameRequest(tile) });
      toast.success(`${tile.code} is in your favorites.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not save that favorite.');
    }
  }

  async function open(tile: MemberTile) {
    if (tile.kind !== 'assessment') {
      void start(tile.code, tileGameRequest(tile));
      return;
    }
    // Phase 67 (H7): "Show your work" in a personal space is for oneself.
    if (!user) return;
    try {
      const made = await startAssessment.mutateAsync({
        student_user_id: user.id,
        level_id: tile.level_id as CanvasAssessmentLevelId,
        question_count: tile.value,
      });
      navigate(`/assessments/${made.data.id}`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'That assessment could not start.');
    }
  }

  const card = (tile: MemberTile) => {
    const look = tileLook(tile);
    return (
      <QuestCard
        key={tile.code}
        title={look.title}
        detail={`${look.level} · ${look.detail}`}
        icon={look.icon}
        tone={{ grade: look.grade }}
        advanced={look.advanced}
        code={tile.code}
        disabled={pending || startAssessment.isPending}
        onOpen={() => void open(tile)}
        label={`Start ${tile.code}: ${tileSpoken(tile)}`}
        testId={`play-tile-${tile.code}`}
        footer={
          <span className="flex flex-wrap items-center gap-1.5">
            {tile.best != null && (
              <span className="text-primary text-xs font-semibold" data-testid={`play-best-${tile.code}`}>
                Best {tile.best}
              </span>
            )}
            {tile.beta && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                Beta
              </Badge>
            )}
          </span>
        }
        aside={
          tile.kind === 'quest' ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-2.5"
              aria-label={starred.has(tile.code) ? `${tile.code} is a favorite` : `Add ${tile.code} to favorites`}
              aria-pressed={starred.has(tile.code)}
              disabled={starred.has(tile.code) || saveFavorite.isPending}
              onClick={() => void star(tile)}
            >
              <StarIcon className={cn('size-4', starred.has(tile.code) && 'fill-current')} />
            </button>
          ) : undefined
        }
      />
    );
  };

  return (
    <section className="grid gap-4" data-testid="play-home" aria-labelledby="play-home-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="play-home-heading" className="font-display text-xl font-semibold">
          Play
        </h2>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('/quest/games/new')}>
          <PlusIcon /> New Quest
        </Button>
      </div>

      {last && (
        <Button
          size="lg"
          className="justify-start"
          data-testid="play-continue"
          disabled={pending}
          onClick={() => void start(last.label, last.request)}
        >
          <PlayIcon /> Continue {last.label}
        </Button>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {dailyLevel && tiles.data?.data.daily && <DailyCard level={dailyLevel} tag={dailyTag} />}
        <MyProgressCard />
      </div>

      <PlayFavorites />

      {/* Phase 66: shown in the home's Next up instead, when a game is waiting. */}
      {!hideWaiting && <WaitingForYou />}

      {grade !== null && (
        <div className="grid gap-3">
          <h3 id="play-grade-label" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Grade
          </h3>
          <GradeRow grades={grades} value={grade} onChange={setChosenGrade} labelId="play-grade-label" testIdPrefix="play-grade-" hued />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={`Grade ${grade} quests`}>
            {board.standard.map(card)}
          </div>
          {board.advanced.length > 0 && (
            <>
              <h3 className="text-muted-foreground mt-1 text-xs font-semibold tracking-wide uppercase">Advanced</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{board.advanced.map(card)}</div>
            </>
          )}
        </div>
      )}

      {offBoard.length > 0 && (
        <div className="grid gap-3" data-testid="play-more-levels">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{grade !== null ? 'More levels' : 'Levels'}</h3>
          {offBoard.map(([words, levelTiles]) => (
            <div key={words} className="grid gap-2">
              <h4 className="text-sm font-semibold">{words}</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{levelTiles.map(card)}</div>
            </div>
          ))}
        </div>
      )}

      <HaveACode />
    </section>
  );
}

/**
 * Phase 67 (H6): today's Daily as five rings -- open until played, then hit or missed, from the
 * server's marks. Its tag (G5D) stays on the card, as the set's name.
 */
function DailyCard({ level, tag }: { level: QuestionBankLevelId; tag: string }) {
  const daily = useDaily(level);
  const navigate = useNavigate();
  const set = daily.data?.data;
  const result = set?.result ?? null;
  const size = set?.questions.length || DAILY_SET_SIZE;
  const states: RingState[] = Array.from({ length: size }, (_, i) => (result ? (result.marks[i] ? 'hit' : 'miss') : 'open'));
  return (
    <TodayCard
      eyebrow={
        <>
          Today&apos;s Daily · {TILE_LEVEL_WORDS[level]} · {tag}
          {set ? ` #${set.number}` : ''}
        </>
      }
      title={result ? `You hit ${result.right} of ${result.of} today.` : `${size} questions. Can you hit them all?`}
      states={states}
      played={result !== null}
      note={result ? 'A new set tomorrow.' : undefined}
      onPlay={() => navigate(`/quest/daily/${level}`)}
      playLabel={result ? 'See your answers' : "Play today's Daily"}
      testId="play-daily"
      playTestId="play-daily-play"
    />
  );
}

/** One box for both codes: six characters is a game here, eight a space to ask to join. */
function HaveACode() {
  // A shared game link (`/?code=`, the lobby's QR code) fills the box in.
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') ?? '');
  const [found, setFound] = useState<GameLookup | null>(null);
  const lookup = useLookupGame();
  const ask = useAskToJoin();
  const navigate = useNavigate();
  const typed = code.replace(/[\s-]/g, '').toUpperCase();

  async function go() {
    try {
      if (typed.length === GAME_CODE_LENGTH) {
        const result = await lookup.mutateAsync(typed);
        if (result.data.joined) navigate(`/quest/games/${result.data.game_id}`);
        else setFound(result.data);
      } else {
        await ask.mutateAsync(typed);
        toast.success('Asked to join. Its admins will let you in.');
        setCode('');
      }
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not find that code.');
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
        <label htmlFor="play-code" className="font-medium">
          Have a code?
        </label>
        <Input
          id="play-code"
          className="w-40 font-mono uppercase"
          placeholder="Game or space code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={(typed.length !== GAME_CODE_LENGTH && typed.length !== SPACE_CODE_LENGTH) || lookup.isPending || ask.isPending}
          onClick={() => void go()}
        >
          Go
        </Button>
        <span className="text-muted-foreground text-xs">Six characters join a game; eight ask to join a space.</span>
      </CardContent>
      <JoinDialog lookup={found} onClose={() => setFound(null)} />
    </Card>
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
    <div className={cn('grid gap-2', compact && 'mx-auto mb-4 max-w-6xl')} data-testid={compact ? 'play-favorites-row' : undefined}>
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{compact ? 'Play a favorite' : 'Favorites'}</h3>
      <div className="flex flex-wrap gap-2" data-testid="play-favorites">
        {list.map((favorite) => (
          <span key={favorite.id} className="inline-flex items-center gap-1">
            <Button
              variant="secondary"
              disabled={pending}
              data-testid={`play-favorite-${favorite.name}`}
              onClick={() => void start(favorite.name, favorite.config, favorite.roster)}
            >
              <StarIcon className="fill-current" /> {favorite.name}
              {favorite.roster?.length ? <UsersIcon className="size-3.5" aria-label="with its players" /> : null}
            </Button>
            {favorite.config.players === 'multi' && (
              <Button
                variant="ghost"
                size="sm"
                data-testid={`play-favorite-players-${favorite.name}`}
                onClick={() => setEditing(favorite)}
              >
                Players
              </Button>
            )}
          </span>
        ))}
        <RosterDialog favorite={editing} onClose={() => setEditing(null)} />
      </div>
    </div>
  );
}

/** Phase 62 (P8): games someone's roster invited the reader to -- one tap, no code to type. */
export function WaitingForYou() {
  const waiting = useWaitingGames();
  const lookup = useLookupGame();
  const [found, setFound] = useState<GameLookup | null>(null);
  const navigate = useNavigate();
  const list = waiting.data?.data ?? [];
  if (list.length === 0) return null;
  async function join(code: string) {
    try {
      const result = await lookup.mutateAsync(code);
      if (result.data.joined) navigate(`/quest/games/${result.data.game_id}`);
      else setFound(result.data);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'That game could not be opened.');
    }
  }
  return (
    <div className="grid gap-2" data-testid="play-waiting">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Waiting for you</h3>
      {list.map((game) => (
        <Card key={game.game_id} className="py-0">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{game.host_first_name}</span> started a {levelLabel(game.level_id)} game ·{' '}
              {gameLengthLabel(game)}
              {game.status === 'running' && ' · under way'}
            </span>
            <Button size="sm" disabled={lookup.isPending} onClick={() => void join(game.code)} data-testid={`play-waiting-join-${game.code}`}>
              Join
            </Button>
          </CardContent>
        </Card>
      ))}
      <JoinDialog lookup={found} onClose={() => setFound(null)} />
    </div>
  );
}

/** Phase 62 (P8): a multiplayer favorite's players (R27: first names, people the reader may name). */
function RosterDialog({ favorite, onClose }: { favorite: GameFavorite | null; onClose: () => void }) {
  const members = useRosterMembers(favorite !== null);
  const save = useSaveGameFavorite();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (favorite && loadedFor !== favorite.id) {
    setLoadedFor(favorite.id);
    setChosen(new Set(favorite.roster ?? []));
  }
  async function submit() {
    if (!favorite) return;
    try {
      await save.mutateAsync({ name: favorite.name, config: favorite.config, roster: chosen.size ? [...chosen] : null });
      toast.success(chosen.size ? `${favorite.name} invites ${chosen.size} ${chosen.size === 1 ? 'person' : 'people'}.` : `${favorite.name} is open to anyone with the code.`);
      onClose();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'The players could not be saved.');
    }
  }
  return (
    <Dialog open={favorite !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="play-roster-dialog">
        <DialogHeader>
          <DialogTitle>Players for {favorite?.name}</DialogTitle>
          <DialogDescription>One tap on the favorite invites them: they see it under Waiting for you, with no code.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {(members.data?.data ?? []).map((member) => (
            <li key={member.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.has(member.id)}
                  onChange={(event) =>
                    setChosen((set) => {
                      const next = new Set(set);
                      if (event.target.checked) next.add(member.id);
                      else next.delete(member.id);
                      return next;
                    })
                  }
                />
                {member.first_name}
              </label>
            </li>
          ))}
          {members.data && members.data.data.length === 0 && (
            <li className="text-muted-foreground text-sm">Nobody here to invite yet.</li>
          )}
        </ul>
        <DialogFooter>
          <Button disabled={save.isPending} onClick={() => void submit()}>
            Save players
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

