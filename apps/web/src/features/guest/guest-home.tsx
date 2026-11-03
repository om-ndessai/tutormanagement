import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon, LockIcon, PencilLineIcon, PlayIcon, TargetIcon, TimerIcon } from 'lucide-react';
import {
  GUEST_DEFAULT_GRADE,
  GUEST_GRADES,
  GUEST_PROMISES,
  GUEST_TODAY_SIZE,
  PLATFORM_CONTACT_EMAIL,
  guestBoard,
  guestDay,
  guestGradeOf,
  guestLevelWords,
  guestTileDetail,
  guestTileName,
  guestTileTitle,
  guestTodayLevel,
  homeBarAfterSignUp,
  type GuestTile,
  type QuestionBankLevelId,
} from '@tmi/shared';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { countEvent } from './guest-api';
import { guestMemory, type GuestToday } from './guest-store';
import { SignupSheet } from './signup-sheet';
import { NudgeSheet, benefitsFor } from './nudge-sheet';

/**
 * The guest Play home, "Quest board" (docs/landing-page-proposal.md, direction C): the page a
 * signed-out visitor lands on while guest play is on. A deep band with the headline and Today's 5, a
 * grade row (1-8, remembered on this device), the grade's quests as game cards, previews for grown-ups,
 * three short answers and a three-link footer. Curricula are never named here: "Grade 4", "Adv G4".
 */
export function GuestHome() {
  const { config, pendingSignup } = useAuth();
  const guest = config?.guest;
  const navigate = useNavigate();
  const brand = useBrand();
  const tiles = guest?.tiles ?? [];
  const [grade, setGrade] = useState<number>(() => guestGradeOf(guestMemory.grade()) ?? GUEST_DEFAULT_GRADE);
  const [locked, setLocked] = useState<GuestTile | null>(null);
  const [signingUp, setSigningUp] = useState(false);

  useEffect(() => countEvent({ name: 'home_viewed', source: 'home' }), []);
  // P13: back from a redirect provider mid sign-up: the sheet opens at the age question.
  useEffect(() => {
    if (pendingSignup) setSigningUp(true);
  }, [pendingSignup]);

  if (!guest) return null;
  const board = guestBoard(tiles, grade);
  const todayLevel = guestTodayLevel(tiles, grade);
  const signUp = () => setSigningUp(true);
  const signupOpen = config?.signup_open === true;
  const homeBar = homeBarAfterSignUp(guest.settings.home_bar);

  function chooseGrade(next: number) {
    setGrade(next);
    // Remembered as a level, so a member's Play home can still lead with it (guestLeadLevel).
    const { standard, advanced } = guestBoard(tiles, next);
    const level = (standard[0] ?? advanced[0])?.level_id;
    if (level) guestMemory.setGrade(level);
  }

  function openTile(tile: GuestTile) {
    if (!tile.locked) {
      navigate(`/play/${tile.code}`);
      return;
    }
    countEvent({ name: 'locked_tile_tapped', tile: tile.code, source: 'locked' });
    setLocked(tile);
  }

  return (
    <div className="bg-background text-foreground min-h-dvh" data-testid="guest-home">
      <div className="relative">
        {/* The band stops short of Today's 5 on a phone, so the card sits on its edge. */}
        <div
          aria-hidden
          className="from-brand-900 to-brand-800 absolute inset-x-0 top-0 bottom-16 overflow-hidden bg-gradient-to-br lg:bottom-0"
        >
          <Rings />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 sm:px-8">
          <header className="flex items-center gap-2.5 py-3 text-white">
            {/* The mark on a white tile: on the band, the brand's own colour would vanish. */}
            <span className="text-brand-800 grid size-10 place-items-center rounded-xl bg-white shadow-sm">
              <LogoMark onDark className="size-8" />
            </span>
            <span className="font-display text-lg font-extrabold">{brand.short}</span>
            <button
              type="button"
              onClick={signUp}
              className="ml-auto inline-flex h-10 items-center rounded-full border border-white/70 px-4 text-sm font-semibold transition-colors hover:bg-white/10"
              data-testid="guest-sign-in"
            >
              Sign in
            </button>
          </header>
          <div className="grid gap-5 pt-3 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:pt-6 lg:pb-12">
            <div className="grid gap-4 text-white">
              <h1 className="font-display text-[2.25rem] leading-[1.05] font-black sm:text-5xl">
                <span className="block">Math quests.</span>
                <span className="text-warning block">Hit the target.</span>
              </h1>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[15px] sm:w-fit" aria-label="What you get">
                {GUEST_PROMISES.map((promise) => (
                  <li key={promise} className="flex items-center gap-2">
                    <CheckIcon className="text-warning size-4 flex-none" strokeWidth={3} aria-hidden />
                    {promise}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="guest-home-bar">
                {homeBar !== null && signupOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={signUp}
                      className="text-brand-900 inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-bold shadow-sm transition-colors hover:bg-white/90"
                      data-testid="guest-band-signup"
                    >
                      Sign up
                    </button>
                    <span className="text-sm text-white/85">{homeBar}</span>
                  </>
                ) : (
                  <span className="text-sm text-white/85">{guest.settings.home_bar}</span>
                )}
              </div>
            </div>
            {todayLevel && (
              <TodayCard
                level={todayLevel}
                played={guestMemory.today(guestDay(), todayLevel)}
                onPlay={() => navigate(`/play/today/${todayLevel}`)}
              />
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pt-6 sm:px-8">
        <section className="grid gap-2" aria-labelledby="guest-grade-label">
          <h2 id="guest-grade-label" className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Your grade
          </h2>
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
            role="radiogroup"
            aria-labelledby="guest-grade-label"
          >
            {GUEST_GRADES.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={g === grade}
                aria-label={`Grade ${g}`}
                onClick={() => chooseGrade(g)}
                data-testid={`guest-grade-${g}`}
                className={cn(
                  'font-display min-h-11 min-w-11 flex-none rounded-full border px-3 text-base font-bold transition-colors',
                  g === grade ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3" aria-label={`Grade ${grade} quests`}>
          {board.standard.length + board.advanced.length === 0 ? (
            <p className="text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
              Quests for Grade {grade} are on their way.
            </p>
          ) : (
            <>
              <CardGrid tiles={board.standard} onOpen={openTile} />
              {board.advanced.length > 0 && (
                <>
                  <h2 className="text-muted-foreground mt-2 text-xs font-semibold tracking-wider uppercase">Advanced</h2>
                  <CardGrid tiles={board.advanced} onOpen={openTile} advanced />
                </>
              )}
            </>
          )}
        </section>

        <section
          className="bg-muted/60 border-foreground/10 mt-4 grid gap-4 rounded-2xl border p-5 md:grid-cols-[1fr_auto] md:items-center"
          aria-label="Play together"
          data-testid="guest-parents"
        >
          <div className="grid gap-2.5">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Play together</span>
            <h2 className="font-display text-xl font-black">One code, everyone joins</h2>
            <div className="flex items-center gap-3">
              <kbd className="font-display bg-card rounded-xl border px-3 py-2 text-2xl font-extrabold tracking-[0.12em]">QF7K2M</kbd>
              <span className="flex" aria-hidden>
                {[
                  ['M', 'bg-primary text-primary-foreground'],
                  ['A', 'bg-warning text-warning-foreground'],
                  ['J', 'bg-brand-500 text-white'],
                ].map(([initial, tone], index) => (
                  <i
                    key={initial}
                    className={cn(
                      'font-display ring-muted grid size-8 place-items-center rounded-full text-xs font-extrabold not-italic ring-2',
                      index > 0 && '-ml-2',
                      tone,
                    )}
                  >
                    {initial}
                  </i>
                ))}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">Family games with a free account. Example code.</p>
          </div>
          <Button size="lg" className="w-full md:w-fit" onClick={signUp} data-testid="guest-family-space">
            {signupOpen ? 'Create a free family space' : 'Sign in'}
          </Button>
        </section>

        <section className="grid gap-2" aria-labelledby="guest-faq">
          <h2 id="guest-faq" className="font-display text-lg font-bold">
            Questions from grown-ups
          </h2>
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group bg-card rounded-xl border px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {question}
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="text-muted-foreground mt-2 text-sm">{answer}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="mx-auto mt-10 max-w-5xl border-t px-4 pt-5 pb-8 sm:px-8">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px] font-semibold">
          <Link to="/privacy" className="text-primary underline underline-offset-4">
            Privacy
          </Link>
          <Link to="/terms" className="text-primary underline underline-offset-4">
            Terms
          </Link>
          <a href={`mailto:${PLATFORM_CONTACT_EMAIL}`} className="text-primary underline underline-offset-4" data-testid="guest-contact">
            Contact us
          </a>
        </nav>
      </footer>

      <SignupSheet open={signingUp} onClose={() => setSigningUp(false)} />
      <NudgeSheet
        open={locked !== null}
        headline={locked ? `${guestTileTitle(locked)} is free with an account` : ''}
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

const FAQ: [string, string][] = [
  [
    'Is it free?',
    'Yes. Anyone can play the free quests without an account. A free account unlocks every quest, family games and progress.',
  ],
  [
    'Is it safe for my child?',
    "Guests aren't tracked: no account, no ads, and answers stay on this device. Children under 13 join through a parent's account.",
  ],
  ['Which grades?', 'Grades 1 to 8, with harder Adv quests for a stretch.'],
];

/** The bullseye's rings, faint, in the band's top corner. */
function Rings() {
  return (
    <svg className="absolute -top-24 -right-24 size-80 text-white/[0.07] sm:size-[28rem]" viewBox="0 0 200 200" fill="none">
      {[96, 72, 48, 24].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} stroke="currentColor" strokeWidth="14" />
      ))}
    </svg>
  );
}

/** Today's 5: the day's five questions of the grade, the same for every visitor (guestTodaySet). */
function TodayCard({ level, played, onPlay }: { level: QuestionBankLevelId; played?: GuestToday; onPlay: () => void }) {
  const hits = played?.hits.filter(Boolean).length ?? 0;
  return (
    <div
      className="bg-card text-card-foreground grid gap-3 rounded-3xl border p-5 shadow-[var(--elevation-2)]"
      data-testid="guest-today"
    >
      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
        Today&apos;s {GUEST_TODAY_SIZE} · {guestLevelWords(level)}
      </span>
      <h2 className="font-display text-2xl font-black">
        {played ? `You hit ${hits} of ${played.hits.length} today.` : 'Five questions. Can you hit all five?'}
      </h2>
      <div
        className="flex gap-2"
        role="img"
        aria-label={played ? `${hits} of ${played.hits.length} hit` : `${GUEST_TODAY_SIZE} targets`}
      >
        {Array.from({ length: GUEST_TODAY_SIZE }, (_, index) => {
          const state = played ? (played.hits[index] ? 'hit' : 'miss') : 'open';
          return (
            <span
              key={index}
              className={cn(
                'grid size-7 place-items-center rounded-full border-[3px]',
                state === 'hit' ? 'border-warning bg-warning/25' : state === 'miss' ? 'border-muted-foreground/30' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  state === 'hit' ? 'bg-warning' : state === 'miss' ? 'bg-muted-foreground/30' : 'bg-border',
                )}
              />
            </span>
          );
        })}
      </div>
      {played && <p className="text-muted-foreground text-sm">A new five tomorrow.</p>}
      <Button
        size="lg"
        onClick={onPlay}
        variant={played ? 'outline' : 'default'}
        className={cn('w-full sm:w-fit', !played && 'bg-warning text-warning-foreground hover:bg-warning/90')}
        data-testid="guest-today-play"
      >
        {played ? 'Play again' : "Play today's 5"} <PlayIcon className="size-4" />
      </Button>
    </div>
  );
}

function CardGrid({ tiles, onOpen, advanced = false }: { tiles: GuestTile[]; onOpen: (tile: GuestTile) => void; advanced?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <QuestCard key={tile.code} tile={tile} onOpen={onOpen} advanced={advanced} />
      ))}
    </div>
  );
}

function QuestCard({ tile, onOpen, advanced }: { tile: GuestTile; onOpen: (tile: GuestTile) => void; advanced: boolean }) {
  // Locked: a big lock on a tinted band, so it reads at a glance and stands off the page.
  const Icon = tile.locked ? LockIcon : tile.kind === 'assessment' ? PencilLineIcon : tile.mode === 'timed' ? TimerIcon : TargetIcon;
  const tone = tile.locked
    ? 'bg-primary/15 text-primary'
    : tile.mode === 'timed'
      ? 'bg-warning text-warning-foreground'
      : 'bg-primary text-primary-foreground';
  const best = tile.locked ? undefined : guestMemory.best(tile.code);
  const detail = `${advanced ? `${guestLevelWords(tile.level_id)} · ` : ''}${guestTileDetail(tile)}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(tile)}
      aria-label={tile.locked ? `${guestTileName(tile)} is free with an account` : `Play ${guestTileName(tile)}`}
      data-testid={tile.locked ? `guest-locked-${tile.code}` : `guest-tile-${tile.code}`}
      className={cn(
        'bg-card focus-visible:ring-ring border-foreground/15 grid grid-rows-[auto_1fr] overflow-hidden rounded-2xl border text-left shadow-[var(--elevation-1)] transition-shadow hover:shadow-[var(--elevation-2)] focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <span className={cn('grid h-14 place-items-center', tone)}>
        <Icon className={tile.locked ? 'size-9' : 'size-7'} aria-hidden />
      </span>
      <span className="grid content-start gap-0.5 px-3 pt-2.5 pb-3">
        <span className="font-display text-base leading-tight font-extrabold">{guestTileTitle(tile)}</span>
        <span className="text-muted-foreground text-xs">{detail}</span>
        {tile.locked && (
          <span className="text-primary mt-0.5 inline-flex items-center gap-1 text-xs font-bold">
            <LockIcon className="size-3" aria-hidden /> Free account
          </span>
        )}
        {best !== undefined && <span className="text-primary mt-0.5 text-xs font-semibold">Best: {best}</span>}
      </span>
    </button>
  );
}
