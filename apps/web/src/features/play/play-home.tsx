import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayIcon, PlusIcon, RotateCcwIcon, StarIcon, UsersIcon } from 'lucide-react';
import {
  DAILY_NAME,
  DAILY_SET_SIZE,
  GAME_LIMITS,
  QUEST_GRADE_NOT_IN_SCHOOL,
  TILE_LEVEL_TAGS,
  tileGameRequest,
  gameWords,
  TILE_LEVEL_WORDS,
  boardGrades,
  dailyLevelFor,
  levelGrade,
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
  type MemberTilesResponse,
  type NextUp,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { guestLeadLevel, guestMemory } from '@/features/guest/guest-store';
import { MyProgressCard } from '@/features/habit/my-progress-card';
import { CodeSheet, codeKind, tidyCode } from '@/features/organizations/code-sheet';
import { JoinDialog } from '@/features/quest/games-card';
import { useCreateGame, useGameFavorites, useLookupGame, useSaveGameFavorite } from '@/features/quest/games-api';
import { useGoToGame, usePlayFrom, type PlayOriginState } from '@/features/quest/play-origin';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useStartCanvasAssessment } from '@/features/canvas-assessments/api';
import { useDaily } from '@/features/habit/habit-api';
import { GradeRow, QuestCard, TodayCard, type RingState } from './quest-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { leadGradeOf, useMemberTiles, useOpenGame, useRosterMembers, useSaveQuestGrade, useWaitingGames } from './play-api';

/**
 * One tap: the game is made and begun (a single player's) and opened, carrying where it was opened from (JF36).
 * Since Phase 73 nothing is kept on the device for Continue: the server's open game is (JF13).
 */
export function useStartQuest() {
  const create = useCreateGame();
  const goToGame = useGoToGame();
  async function start(request: CreateGameRequest, options: { roster?: string[] | null; replace?: boolean } = {}) {
    try {
      // Phase 62 (P7): from a multiplayer favorite the host is in the game from the start; (P8) its
      // roster's people are invited and see it under "Waiting for you".
      const game = await create.mutateAsync(
        request.players === 'multi'
          ? { ...request, host_plays: true, ...(options.roster?.length ? { invite_user_ids: options.roster } : {}) }
          : request,
      );
      goToGame(game.data.id, { replace: options.replace });
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

/** "Not now" on "Which grade?" lasts for this tab's session, per space. */
const askLaterKey = (space: string | undefined) => `aimtrue.ask-grade-later.${space ?? ''}`;

/**
 * Phase 73 (JF14): asked once, only when nothing says the grade. A guest's grade on this device answers it instead
 * (once); otherwise "Which grade?" sits above the board until answered, or put off for the session.
 */
function useGradeQuestion(data: MemberTilesResponse | undefined, onCarry: (grade: number) => void) {
  const { organization } = useAuth();
  const save = useSaveQuestGrade();
  const [later, setLater] = useState(() => {
    try {
      return sessionStorage.getItem(askLaterKey(organization?.slug)) === '1';
    } catch {
      return false;
    }
  });
  const [answered, setAnswered] = useState(false);
  const carried = useRef(false);
  // The device's guest grade, if it has not answered the question somewhere already and is on this row.
  const [guestGrade] = useState(() => {
    if (guestMemory.gradeCarried()) return null;
    const level = guestLeadLevel();
    return level ? levelGrade(level) : null;
  });
  const asked = Boolean(data?.ask_grade);
  // The guest page's promise (Phase 67): a grade chosen as a guest leads, over the age guess (`from: 'age'`) or the
  // question -- never over a grade picked here, one the space records, or real play.
  const open = asked || data?.lead?.from === 'age';
  const carry = open && guestGrade !== null && boardGrades(data?.tiles ?? []).includes(guestGrade) ? guestGrade : null;

  useEffect(() => {
    if (carry === null || carried.current) return;
    carried.current = true;
    onCarry(carry);
    save.mutate({ grade: carry }, { onSuccess: () => guestMemory.markGradeCarried() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carry]);

  return {
    show: asked && carry === null && !later && !answered,
    pending: save.isPending,
    answer(grade: number) {
      setAnswered(true);
      save.mutate(
        { grade },
        { onError: (caught) => toast.error(caught instanceof ApiRequestError ? caught.message : 'Your grade could not be saved.') },
      );
    },
    notNow() {
      setLater(true);
      try {
        sessionStorage.setItem(askLaterKey(organization?.slug), '1');
      } catch {
        // Storage blocked: "Not now" lasts until the page is reloaded.
      }
    },
  };
}

/** The one-time "Which grade?" (Phase 73, JF14): the grades on the row, and "Not in school". */
function WhichGrade({ grades, onAnswer, onLater, disabled }: { grades: number[]; onAnswer: (grade: number) => void; onLater: () => void; disabled: boolean }) {
  return (
    <Card className="py-0" data-testid="play-ask-grade">
      <CardContent className="grid gap-3 p-4">
        <div className="grid gap-0.5">
          <h3 className="font-display text-lg font-bold" id="play-ask-grade-heading">
            Which grade?
          </h3>
          <p className="text-muted-foreground text-sm">So your quests and today&apos;s Daily start at the right level. You can change it on the row below.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="play-ask-grade-heading">
          {grades.map((grade) => (
            <Button key={grade} variant="outline" size="sm" disabled={disabled} onClick={() => onAnswer(grade)} data-testid={`play-ask-grade-${grade}`}>
              Grade {grade}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onAnswer(QUEST_GRADE_NOT_IN_SCHOOL)}
            data-testid={`play-ask-grade-${QUEST_GRADE_NOT_IN_SCHOOL}`}
          >
            Not in school
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onLater} data-testid="play-ask-grade-later">
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Phase 73 (JF13): Continue -- the reader's open game, in words with where they are ("Grade 7 Quick 5 · question 3 of
 * 5 · 2 points"), else "Play Grade 7 Quick 5 again"; nothing when they have played nothing here.
 */
function ContinueButton({ quiet = false }: { quiet?: boolean }) {
  const open = useOpenGame();
  const goToGame = useGoToGame();
  const { start, pending } = useStartQuest();
  const data = open.data?.data;
  // Phase 74 (JF23): when Next up already offers it, this twin is a normal-weight outline button.
  const size = quiet ? 'default' : 'lg';
  if (data?.open) {
    const game = data.open;
    return (
      <Button
        size={size}
        variant={quiet ? 'outline' : 'default'}
        className={cn('h-auto justify-start py-2.5 whitespace-normal', quiet && 'sm:w-fit')}
        data-testid="play-continue"
        data-quiet={quiet || undefined}
        onClick={() => goToGame(game.game_id)}
      >
        <PlayIcon /> Continue {game.label}
      </Button>
    );
  }
  if (data?.again) {
    const again = data.again;
    return (
      <Button
        size={size}
        variant={quiet ? 'outline' : 'secondary'}
        data-quiet={quiet || undefined}
        className={cn('h-auto justify-start py-2.5 whitespace-normal', quiet && 'sm:w-fit')}
        data-testid="play-continue"
        disabled={pending}
        onClick={() => void start(again.request)}
      >
        <RotateCcwIcon /> {again.label}
      </Button>
    );
  }
  return null;
}

/**
 * Phase 62 (P6): the members' Play home -- Continue, favorites, the tiles and a code box, every one a
 * quest in one tap. The home of a space without Tutoring, and of a student anywhere.
 *
 * Phase 74 (JF23): `nextUp` is the home's Next up item. When it already offers the Daily, or Continue, the board's
 * own twin is quiet, so the heavier button on the page is the one in Next up.
 */
export function PlayHome({ hideWaiting = false, nextUp = null }: { hideWaiting?: boolean; nextUp?: NextUp | null } = {}) {
  const quietDaily = nextUp?.kind === 'daily' || (nextUp?.kind === 'welcome_back' && nextUp.level_id !== null);
  const quietContinue = nextUp?.kind === 'open_game' || nextUp?.kind === 'continue_quest';
  const { user } = useAuth();
  const startAssessment = useStartCanvasAssessment();
  const tiles = useMemberTiles();
  const favorites = useGameFavorites();
  const saveFavorite = useSaveGameFavorite();
  const saveGrade = useSaveQuestGrade();
  const { start, pending } = useStartQuest();
  const navigate = useNavigate();
  const from = usePlayFrom();
  const data = tiles.data?.data;
  const list = data?.tiles ?? [];
  const starred = new Set((favorites.data?.data ?? []).map((favorite) => favorite.name));
  useCarryGuestTiles(list, favorites.data?.data);

  // Phase 67 (H5): the Quest board -- a grade row, that grade's cards in its hue, then levels off the row.
  // Phase 73 (JF14): led by the server's lead grade; a grade picked on the row is saved there, so it is kept.
  const grades = boardGrades(list);
  const [chosenGrade, setChosenGrade] = useState<number | null>(null);
  const question = useGradeQuestion(data, setChosenGrade);
  const grade = chosenGrade ?? leadGradeOf(data);
  const board = useMemo(() => (grade ? memberBoard(list, grade) : { standard: [], advanced: [] }), [list, grade]);
  const offBoard = useMemo(() => {
    const map = new Map<string, MemberTile[]>();
    for (const tile of offBoardTiles(list)) {
      const words = TILE_LEVEL_WORDS[tile.level_id];
      map.set(words, [...(map.get(words) ?? []), tile]);
    }
    return [...map.entries()];
  }, [list]);

  if (data && !data.play_home) return null;

  // Phase 73 (JF14, JF23): ONE Daily rule, the same as Next up's -- the shown grade's first card's level.
  const dailyLevel = dailyLevelFor(list, grade);

  function pickGrade(next: number) {
    setChosenGrade(next);
    if (data?.lead?.from === 'picked' && data.picked_grade === next) return; // already kept
    saveGrade.mutate(
      { grade: next },
      { onError: (caught) => toast.error(caught instanceof ApiRequestError ? caught.message : 'Your grade could not be saved.') },
    );
  }

  function answerGrade(next: number) {
    // "Not in school" leads with the top of the row.
    setChosenGrade(next === QUEST_GRADE_NOT_IN_SCHOOL ? (grades[grades.length - 1] ?? null) : next);
    question.answer(next);
  }

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
      void start(tileGameRequest(tile));
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
        <h3 id="play-home-heading" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Quest
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => navigate('/quest/games/new', { state: { from } satisfies PlayOriginState })}
        >
          <PlusIcon /> New Quest
        </Button>
      </div>

      <ContinueButton quiet={quietContinue} />

      {question.show && grades.length > 0 && (
        <WhichGrade grades={grades} onAnswer={answerGrade} onLater={question.notNow} disabled={question.pending} />
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {dailyLevel && data?.daily && <DailyCard level={dailyLevel} quiet={quietDaily} />}
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
          <GradeRow grades={grades} value={grade} onChange={pickGrade} labelId="play-grade-label" testIdPrefix="play-grade-" hued />
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
 * server's marks. Its tag (G5D) stays on the card, as the set's name; the level is in words beside it.
 */
function DailyCard({ level, quiet = false }: { level: QuestionBankLevelId; quiet?: boolean }) {
  const daily = useDaily(level);
  const navigate = useNavigate();
  const from = usePlayFrom();
  const set = daily.data?.data;
  const result = set?.result ?? null;
  const size = set?.questions.length || DAILY_SET_SIZE;
  const states: RingState[] = Array.from({ length: size }, (_, i) => (result ? (result.marks[i] ? 'hit' : 'miss') : 'open'));
  return (
    <TodayCard
      eyebrow={
        <>
          {DAILY_NAME} · {TILE_LEVEL_WORDS[level]} · {TILE_LEVEL_TAGS[level]}D
          {set ? ` #${set.number}` : ''}
        </>
      }
      title={result ? `You hit ${result.right} of ${result.of} today.` : `${size} questions. Can you hit them all?`}
      states={states}
      played={result !== null}
      note={result ? 'A new set tomorrow.' : undefined}
      onPlay={() => navigate(`/quest/daily/${level}`, { state: { from } satisfies PlayOriginState })}
      playLabel={result ? 'See your answers' : `Play ${DAILY_NAME.replace(/^T/, 't')}`}
      testId="play-daily"
      playTestId="play-daily-play"
      quiet={quiet}
    />
  );
}

/**
 * One box for both codes, on the board: Go opens the one "Have a code?" sheet on what was typed (JF4), which says
 * what the code found -- the game's join choices, or the space's name -- before sending anything.
 */
function HaveACode() {
  const [code, setCode] = useState('');
  const [sheet, setSheet] = useState<string | null>(null);
  const typed = tidyCode(code);

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
        <Button variant="outline" disabled={!codeKind(typed)} onClick={() => setSheet(typed)}>
          Go
        </Button>
        <span className="text-muted-foreground text-xs">Six characters join a game; eight ask to join a space.</span>
      </CardContent>
      {sheet !== null && (
        <CodeSheet
          initialCode={sheet}
          onClose={() => {
            setSheet(null);
            setCode('');
          }}
        />
      )}
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
              onClick={() => void start(favorite.config, { roster: favorite.roster })}
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
  const goToGame = useGoToGame();
  const list = waiting.data?.data ?? [];
  if (list.length === 0) return null;
  async function join(code: string) {
    try {
      const result = await lookup.mutateAsync(code);
      if (result.data.joined) goToGame(result.data.game_id);
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
            {/* Phase 73 (JF32): the game in words ("Grade 5 Quick 3"), never its code first. */}
            <span className="min-w-0 flex-1" data-testid={`play-waiting-words-${game.code}`}>
              <span className="font-medium">{game.host_first_name}</span> started{' '}
              {gameWords({ ...game, level_id: game.level_id as QuestionBankLevelId, level_scope: game.level_scope ?? 'level' })}
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

