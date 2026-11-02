import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarCheckIcon, PlayIcon, PlusIcon, StarIcon, UsersIcon } from 'lucide-react';
import {
  GAME_CODE_LENGTH,
  GAME_LIMITS,
  SPACE_CODE_LENGTH,
  tileGameRequest,
  gameLengthLabel,
  levelLabel,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { readLastQuest, useMemberTiles, useRosterMembers, useWaitingGames, writeLastQuest } from './play-api';

/** A curriculum's group on the home, in the order shown. */
function groupOf(levelId: string): string {
  if (levelId.startsWith('NC26.')) return 'NC standards';
  if (levelId.startsWith('NC17.')) return 'NC standards (2017)';
  if (/^BA\d$/.test(levelId)) return 'Beast Academy';
  if (['PRE', 'ALG', 'GEO'].includes(levelId)) return 'Art of Problem Solving';
  return 'Math Kangaroo';
}

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
export function PlayHome() {
  const { organization } = useAuth();
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
  const lead = last?.request.level_id ?? guestLead;
  useCarryGuestTiles(list, favorites.data?.data);

  // The lead level first, then the catalogue's order.
  const groups = useMemo(() => {
    const ordered = [...list].sort((a, b) => Number(b.level_id === lead) - Number(a.level_id === lead));
    const map = new Map<string, MemberTile[]>();
    for (const tile of ordered) map.set(groupOf(tile.level_id), [...(map.get(groupOf(tile.level_id)) ?? []), tile]);
    return [...map.entries()];
  }, [list, lead]);

  if (tiles.data && !tiles.data.data.play_home) return null;

  // Phase 64 (P19): the Daily of the lead level, else of the first tile's.
  const dailyTile = list.find((tile) => tile.level_id === lead) ?? list[0];
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

      <MyProgressCard />

      {dailyLevel && tiles.data?.data.daily && (
        <Button variant="outline" className="justify-start" data-testid="play-daily" onClick={() => navigate(`/quest/daily/${dailyLevel}`)}>
          <CalendarCheckIcon /> Today&apos;s Daily · {dailyTag}
        </Button>
      )}

      <PlayFavorites />

      <WaitingForYou />

      {groups.map(([group, groupTiles]) => (
        <div key={group} className="grid gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{group}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {groupTiles.map((tile) => (
              <Card key={tile.code} className="py-0" data-testid={`play-tile-${tile.code}`}>
                <CardContent className="flex items-start gap-1 p-0">
                  <button
                    type="button"
                    className="hover:bg-muted min-w-0 flex-1 rounded-l-xl p-3 text-left transition-colors"
                    disabled={pending}
                    aria-label={`Start ${tile.code}: ${tile.words}`}
                    onClick={() => void start(tile.code, tileGameRequest(tile))}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="font-display text-lg font-semibold">{tile.code}</span>
                      {tile.beta && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          Beta
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">{tile.words}</span>
                    {tile.best != null && (
                      <span className="text-primary block text-xs font-medium" data-testid={`play-best-${tile.code}`}>
                        Best {tile.best}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-3"
                    aria-label={starred.has(tile.code) ? `${tile.code} is a favorite` : `Add ${tile.code} to favorites`}
                    aria-pressed={starred.has(tile.code)}
                    disabled={starred.has(tile.code) || saveFavorite.isPending}
                    onClick={() => void star(tile)}
                  >
                    <StarIcon className={cn('size-4', starred.has(tile.code) && 'fill-current')} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <HaveACode />
    </section>
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

