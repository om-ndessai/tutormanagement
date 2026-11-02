import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockIcon } from 'lucide-react';
import { TILE_LEVEL_WORDS, type GuestTile, type QuestionBankLevelId } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { countEvent } from './guest-api';
import { guestMemory } from './guest-store';
import { SignupSheet } from './signup-sheet';
import { NudgeSheet, benefitsFor } from './nudge-sheet';

/**
 * Phase 63 (P10): the guest Play home -- the page a signed-out visitor lands on while guest play is
 * on. One tap plays: grade chips (remembered on this device), the open tiles large, the locked ones
 * as "Free with an account", a strip for parents, and the trust line.
 */
export function GuestHome() {
  const { config } = useAuth();
  const guest = config?.guest;
  const navigate = useNavigate();
  const tiles = guest?.tiles ?? [];
  const levels = useMemo(() => [...new Set(tiles.map((tile) => tile.level_id))], [tiles]);
  const [grade, setGrade] = useState<QuestionBankLevelId | undefined>(() => guestMemory.grade());
  const [locked, setLocked] = useState<GuestTile | null>(null);
  const chosen = grade && levels.includes(grade) ? grade : levels.find((l) => l === 'NC26.4') ?? levels[0];

  useEffect(() => countEvent({ name: 'home_viewed', source: 'home' }), []);
  const [signingUp, setSigningUp] = useState(false);
  // P13: back from a redirect provider mid sign-up: the sheet opens at the age question.
  const { pendingSignup } = useAuth();
  useEffect(() => {
    if (pendingSignup) setSigningUp(true);
  }, [pendingSignup]);

  if (!guest) return null;
  const open = tiles.filter((tile) => !tile.locked && tile.level_id === chosen);
  const lockedTiles = tiles.filter((tile) => tile.locked && tile.level_id === chosen);
  const signUp = () => setSigningUp(true);

  return (
    <div className="bg-background min-h-dvh" data-testid="guest-home">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-8">
        <LogoLockup />
        <Button className="ml-auto" variant="outline" size="sm" onClick={signUp} data-testid="guest-sign-in">
          Sign in
        </Button>
      </header>
      <p className="bg-primary/10 px-4 py-2 text-center text-sm sm:px-8" data-testid="guest-home-bar">
        {guest.settings.home_bar}
      </p>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8">
        <div className="grid gap-2">
          <h1 className="font-display text-2xl font-semibold">Math practice that feels like a game</h1>
          <p className="text-muted-foreground text-sm">No sign-up to start. Pick your grade and tap a quest.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Your grade">
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={level === chosen}
              onClick={() => {
                setGrade(level);
                guestMemory.setGrade(level);
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                level === chosen ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {TILE_LEVEL_WORDS[level]}
            </button>
          ))}
        </div>

        <section className="grid gap-2" aria-label="Play now">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Play now</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {open.map((tile) => {
              const best = guestMemory.best(tile.code);
              return (
                <button
                  key={tile.code}
                  type="button"
                  className="hover:border-primary rounded-xl border p-4 text-left transition-colors"
                  aria-label={`Play ${tile.code}: ${tile.words}`}
                  data-testid={`guest-tile-${tile.code}`}
                  onClick={() => navigate(`/play/${tile.code}`)}
                >
                  <span className="font-display block text-2xl font-semibold">{tile.code}</span>
                  <span className="text-muted-foreground block text-xs">{tile.words}</span>
                  {best !== undefined && <span className="text-primary mt-1 block text-xs">Best: {best}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {lockedTiles.length > 0 && (
          <section className="grid gap-2" aria-label="More with a free account">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">More with a free account</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {lockedTiles.map((tile) => (
                <button
                  key={tile.code}
                  type="button"
                  className="bg-muted/40 text-muted-foreground rounded-xl border p-3 text-left"
                  aria-label={`${tile.code} is free with an account`}
                  data-testid={`guest-locked-${tile.code}`}
                  onClick={() => {
                    countEvent({ name: 'locked_tile_tapped', tile: tile.code, source: 'locked' });
                    setLocked(tile);
                  }}
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <LockIcon className="size-3.5" /> {tile.code}
                  </span>
                  <span className="block text-xs">{tile.words}</span>
                  <Badge variant="secondary" className="mt-1 px-1.5 py-0 text-[10px]">
                    Free
                  </Badge>
                </button>
              ))}
            </div>
          </section>
        )}

        <Card className="py-0" data-testid="guest-parents">
          <CardContent className="grid gap-1 p-4 text-sm">
            <h2 className="font-semibold">For parents and tutors</h2>
            <p className="text-muted-foreground">
              Start your family&apos;s space: add your children, play family games, follow their progress and give
              assessments.
            </p>
            <Button className="mt-2 w-fit" variant="outline" onClick={signUp}>
              Get started free
            </Button>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          No ads. No account needed to try. Written to NC standards, checked twice.{' '}
          <Link to="/privacy" className="underline">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link to="/terms" className="underline">
            Terms
          </Link>
        </p>
      </main>

      <SignupSheet open={signingUp} onClose={() => setSigningUp(false)} />
      <NudgeSheet
        open={locked !== null}
        headline={locked ? `${locked.code} is free with an account` : ''}
        benefits={benefitsFor(locked?.level_id, guest.member_counts)}
        onSignUp={() => {
          countEvent({ name: 'signup_started', source: 'locked', tile: locked?.code });
          signUp();
        }}
        onClose={() => setLocked(null)}
        closeLabel="Not now"
        shareLink={`${window.location.origin}/`}
      />
    </div>
  );
}
