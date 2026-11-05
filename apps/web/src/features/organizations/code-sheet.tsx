import { useEffect, useRef, useState } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  GAME_CODE_LENGTH,
  JOIN_NOTE_MAX,
  JOIN_REQUEST_ROLE_HINTS,
  JOIN_REQUEST_ROLE_LABELS,
  SPACE_CODE_LENGTH,
  guestTileName,
  joinAskRolesFor,
  parseTileCode,
  type GameLookup,
  type JoinRequestRole,
  type SpaceLookup,
} from '@tmi/shared';

import { useGoToGame } from '@/features/quest/play-origin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { guestMemory } from '@/features/guest/guest-store';
import { JoinDialog } from '@/features/quest/games-card';
import { useLookupGame } from '@/features/quest/games-api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAskToJoin, useLookupSpace } from './api';

/** "fmxy 2345" -> "FMXY2345". */
export function tidyCode(text: string): string {
  return text.replace(/[^0-9a-z]/gi, '').toUpperCase();
}

/** Six characters are a game (here), eight a space to ask to join. */
export function codeKind(code: string): 'game' | 'space' | null {
  return code.length === GAME_CODE_LENGTH ? 'game' : code.length === SPACE_CODE_LENGTH ? 'space' : null;
}

/**
 * The one "Have a code?" door (UI audit JF4, owner 2026-11-04): from the guest page, the home's quick action, the
 * Quest board and the Question Quest page, the same sheet. It always says what a code found before sending: a
 * space's name (then "Ask to join"), or a game (the join dialog). Signed out, a code is kept on this device through
 * sign-up and approval, and the first home offers it.
 */
export function CodeSheet({
  onClose,
  initialCode = '',
  onSignUp,
}: {
  /** Mounted only while open: closing unmounts it, so each opening starts afresh. */
  onClose: () => void;
  /** A code to start from (a kept one, a shared link's, the Quest board's box): looked up at once. */
  initialCode?: string;
  /** Signed out: the guest page's sign-up, offered once the code is kept. */
  onSignUp?: () => void;
}) {
  const { status } = useAuth();
  const goToGame = useGoToGame();
  const lookupSpace = useLookupSpace();
  const lookupGame = useLookupGame();
  const ask = useAskToJoin();
  const signedIn = status === 'authenticated';
  const [code, setCode] = useState(initialCode);
  const [space, setSpace] = useState<(SpaceLookup & { code: string }) | null>(null);
  const [game, setGame] = useState<GameLookup | null>(null);
  // Signed out, a code to start from is kept at once (idempotent, so a second render keeps the same).
  const [kept, setKept] = useState(() => {
    const start = tidyCode(initialCode);
    if (signedIn || !codeKind(start)) return false;
    guestMemory.keepCode(start);
    return true;
  });
  const started = useRef(false);
  const joining = useJoinAsk(space);
  const typed = tidyCode(code);
  const kind = codeKind(typed);
  const busy = lookupSpace.isPending || lookupGame.isPending || ask.isPending;

  async function go(value = typed) {
    const which = codeKind(value);
    if (!which) return;
    if (!signedIn) {
      guestMemory.keepCode(value);
      setKept(true);
      return;
    }
    try {
      if (which === 'game') {
        const found = (await lookupGame.mutateAsync(value)).data;
        guestMemory.dropCode();
        if (found.joined) {
          onClose();
          goToGame(found.game_id);
        } else setGame(found);
      } else {
        const found = (await lookupSpace.mutateAsync(value)).data;
        guestMemory.dropCode();
        setSpace({ ...found, code: value });
      }
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not find that code.');
    }
  }

  async function askToJoin() {
    if (!space) return;
    try {
      await ask.mutateAsync({ code: space.code, role: joining.role, note: joining.note.trim() || null });
      toast.success(`Asked to join ${space.name}. Its admins will let you in.`);
      onClose();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not ask to join.');
    }
  }

  // Signed in, a code to start from is looked up once, as the sheet opens.
  useEffect(() => {
    if (started.current || !signedIn || !codeKind(tidyCode(initialCode))) return;
    started.current = true;
    void go(tidyCode(initialCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (game) return <JoinDialog lookup={game} onClose={onClose} />;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="code-sheet">
        {kept ? (
          <>
            <DialogHeader>
              <DialogTitle>Kept on this device</DialogTitle>
              <DialogDescription>
                {typed} will be waiting on your first screen once you have signed up or signed in. Nothing is sent until you
                use it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} data-testid="code-sheet-keep-playing">
                Keep playing
              </Button>
              {onSignUp && (
                <Button
                  onClick={() => {
                    onClose();
                    onSignUp();
                  }}
                  data-testid="code-sheet-sign-up"
                >
                  Sign up or sign in
                </Button>
              )}
            </DialogFooter>
          </>
        ) : space ? (
          <>
            <DialogHeader>
              <DialogTitle data-testid="code-sheet-space">{space.name}</DialogTitle>
              <DialogDescription>
                {space.standing === 'member'
                  ? `You already belong to ${space.name}.`
                  : space.standing === 'requested'
                    ? `You have already asked to join ${space.name}.`
                    : 'Ask to join, and its admins let you in.'}
              </DialogDescription>
            </DialogHeader>
            {space.standing === null && <JoinAskFields space={space} ask={joining} />}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setSpace(null);
                  setCode('');
                }}
              >
                Another code
              </Button>
              {space.standing === null && (
                <Button disabled={busy} onClick={() => void askToJoin()} data-testid="code-sheet-ask">
                  Ask to join
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Have a code?</DialogTitle>
              <DialogDescription>Six characters join a game; eight ask to join a space.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void go();
              }}
            >
              <Label htmlFor="code-sheet-code">Code</Label>
              <Input
                id="code-sheet-code"
                className="font-mono uppercase"
                placeholder="Game or space code"
                autoComplete="off"
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                data-testid="code-sheet-code"
              />
              <DialogFooter>
                <Button type="submit" disabled={!kind || busy} data-testid="code-sheet-go">
                  {signedIn ? 'Look it up' : 'Keep it'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * What a signed-out visit left on this device for the first home (JF4, JF9): a code typed, or a quest link a
 * friend sent. Offered once; "Not now" forgets it.
 */
export function KeptForYou({ onCode }: { onCode: (code: string) => void }) {
  const navigate = useNavigate();
  const [kept, setKept] = useState(() => ({ code: guestMemory.keptCode(), sent: guestMemory.sentTile() }));
  const sentShape = kept.sent ? parseTileCode(kept.sent) : null;
  if (!kept.code && !sentShape) return null;
  const forget = () => {
    guestMemory.dropCode();
    guestMemory.dropSent();
    setKept({ code: undefined, sent: undefined });
  };
  return (
    <Card className="border-primary/40 py-0" data-testid="home-kept">
      <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <KeyRoundIcon className="text-primary size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          {kept.code ? (
            <>
              You kept a code on this device: <span className="font-mono font-semibold">{kept.code}</span>
            </>
          ) : (
            <>
              You were sent a quest: <span className="font-semibold">{guestTileName(sentShape!)}</span>
            </>
          )}
        </span>
        <span className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={forget} data-testid="home-kept-later">
            Not now
          </Button>
          <Button
            size="sm"
            data-testid="home-kept-use"
            onClick={() => {
              if (kept.code) {
                guestMemory.dropSent();
                onCode(kept.code);
              } else {
                guestMemory.dropSent();
                navigate(`/quest/tile/${kept.sent}`);
              }
              setKept({ code: undefined, sent: undefined });
            }}
          >
            {kept.code ? 'Use it' : 'Play it'}
          </Button>
        </span>
      </CardContent>
    </Card>
  );
}

/** What a request asks for (owner, 2026-11-04; UI audit JF26): a role, a parent's by default, and a short note. */
export interface JoinAsk {
  role: JoinRequestRole;
  note: string;
  roles: JoinRequestRole[];
  setRole: (role: JoinRequestRole) => void;
  setNote: (note: string) => void;
}

export function useJoinAsk(space: Pick<SpaceLookup, 'offers_tutoring'> | null): JoinAsk {
  const { account } = useAuth();
  const roles = joinAskRolesFor({ teen: account?.age_band === '13-17', tutoring: space?.offers_tutoring === true });
  const [chosen, setRole] = useState<JoinRequestRole | null>(null);
  const [note, setNote] = useState('');
  // A teen asks as a learner; anyone else as a parent unless they choose otherwise.
  const role = chosen && roles.includes(chosen) ? chosen : (roles[0] ?? 'parent');
  return { role, note, roles, setRole, setNote };
}

/** The role and the note, above "Ask to join". The space's admins read both; nobody else does (R32). */
export function JoinAskFields({ space, ask }: { space: Pick<SpaceLookup, 'name'>; ask: JoinAsk }) {
  return (
    <div className="grid gap-3" data-testid="join-ask">
      {ask.roles.length > 1 && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">You are joining {space.name} as</legend>
          {ask.roles.map((role) => (
            <Label
              key={role}
              htmlFor={`join-ask-role-${role}`}
              className="hover:bg-muted/50 has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal"
            >
              <input
                type="radio"
                name="join-ask-role"
                id={`join-ask-role-${role}`}
                className="accent-primary mt-1"
                checked={ask.role === role}
                onChange={() => ask.setRole(role)}
                data-testid={`join-ask-role-${role}`}
              />
              <span className="grid gap-0.5">
                <span className="font-medium">{JOIN_REQUEST_ROLE_LABELS[role]}</span>
                <span className="text-muted-foreground text-xs">{JOIN_REQUEST_ROLE_HINTS[role]}</span>
              </span>
            </Label>
          ))}
        </fieldset>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="join-ask-note">A note for its admins (optional)</Label>
        <textarea
          id="join-ask-note"
          rows={2}
          maxLength={JOIN_NOTE_MAX}
          placeholder="Who you are, or whose parent"
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          value={ask.note}
          onChange={(event) => ask.setNote(event.target.value)}
          data-testid="join-ask-note"
        />
      </div>
    </div>
  );
}
