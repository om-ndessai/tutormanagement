import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon, KeyRoundIcon, LockIcon } from 'lucide-react';
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
  parseTileCode,
  guestTodayLevel,
  type GuestTile,
  type QuestionBankLevelId,
} from '@tmi/shared';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { isAccessRefusal } from '@/features/auth/access-refused';
import { CodeSheet } from '@/features/organizations/code-sheet';
import { countEvent } from './guest-api';
import { declinedTab, guestMemory, type GuestToday } from './guest-store';
import { SignupSheet, type SignupSheetMode } from './signup-sheet';
import { NudgeSheet, benefitsFor } from './nudge-sheet';
import { GradeRow, QuestCard, TodayCard, type RingState } from '@/features/play/quest-card';

/**
 * The guest Play home, "Quest board" (docs/landing-page-proposal.md, direction C): the page a
 * signed-out visitor lands on while guest play is on. A deep band with the headline and Today's 5, a
 * grade row (1-8, remembered on this device), the grade's quests as game cards, previews for grown-ups,
 * three short answers and a three-link footer. Curricula are never named here: "Grade 4", "Adv G4".
 */
export function GuestHome() {
  const { config, pendingSignup, error } = useAuth();
  const guest = config?.guest;
  const navigate = useNavigate();
  const brand = useBrand();
  const tiles = guest?.tiles ?? [];
  const [grade, setGrade] = useState<number>(() => guestGradeOf(guestMemory.grade()) ?? GUEST_DEFAULT_GRADE);
  const [locked, setLocked] = useState<GuestTile | null>(null);
  // The sheet, and how it opened: "Sign in" says Sign in (UI audit JF11), the calls to action Sign up free.
  const [sheet, setSheet] = useState<SignupSheetMode | null>(null);
  // The one "Have a code?" sheet (JF4): signed out it keeps the code on this device. A shared game link
  // (`/?code=`, the lobby's QR code) opens it on that code.
  const [codeSheet, setCodeSheet] = useState<string | null>(() => new URLSearchParams(window.location.search).get('code'));
  // A friend's quest link a guest cannot play (JF9), kept for after sign-up.
  const [sent] = useState(() => {
    const code = guestMemory.sentTile();
    return code ? parseTileCode(code) : null;
  });

  useEffect(() => countEvent({ name: 'home_viewed', source: 'home' }), []);
  // P13: back from a redirect provider mid sign-up: the sheet opens at the age question.
  // Phase 65: back from a redirect provider with a sign-up access refusal: the sheet says it.
  useEffect(() => {
    if (pendingSignup || isAccessRefusal(error?.code)) setSheet((open) => open ?? 'signup');
  }, [pendingSignup, error]);

  if (!guest) return null;
  const board = guestBoard(tiles, grade);
  const todayLevel = guestTodayLevel(tiles, grade);
  // A tab whose sign-up was declined is offered Sign in only (UI audit J02).
  const signupOpen = config?.signup_open === true && !declinedTab.is();
  const signIn = () => setSheet('signin');
  const signUp = () => (signupOpen ? setSheet('signup') : signIn());

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
              onClick={signIn}
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
              <p className="text-[15px] font-semibold text-white/90" data-testid="guest-audience">
                For kids, teens, grown-ups and classes.
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[15px] sm:w-fit" aria-label="What you get">
                {GUEST_PROMISES.map((promise) => (
                  <li key={promise} className="flex items-center gap-2">
                    <CheckIcon className="text-warning size-4 flex-none" strokeWidth={3} aria-hidden />
                    {promise}
                  </li>
                ))}
              </ul>
              {/* A whole button, then the console's home bar as its own line. */}
              <div className="grid justify-items-start gap-2">
                <button
                  type="button"
                  onClick={signUp}
                  className="text-brand-900 inline-flex h-11 items-center rounded-full bg-white px-6 text-[15px] font-bold shadow-sm transition-colors hover:bg-white/90"
                  data-testid="guest-band-signup"
                >
                  {signupOpen ? 'Sign up free' : 'Sign in'}
                </button>
                <p className="text-sm text-white/80" data-testid="guest-home-bar">
                  {guest.settings.home_bar}
                </p>
              </div>
            </div>
            {todayLevel && (
              <GuestTodayCard
                level={todayLevel}
                played={guestMemory.today(guestDay(), todayLevel)}
                onPlay={() => navigate(`/play/today/${todayLevel}`)}
              />
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pt-6 sm:px-8">
        {sent && (
          <section className="bg-card flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm" data-testid="guest-sent">
            <span className="min-w-0 flex-1">
              You were sent <span className="font-semibold">{guestTileName(sent)}</span>. It needs a free account; it will be
              waiting once you are in.
            </span>
            <Button size="sm" onClick={signUp} data-testid="guest-sent-signup">
              {signupOpen ? 'Sign up free' : 'Sign in'}
            </Button>
          </section>
        )}
        <section className="grid gap-2" aria-labelledby="guest-grade-label">
          <h2 id="guest-grade-label" className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Your grade
          </h2>
          <GradeRow grades={GUEST_GRADES} value={grade} onChange={chooseGrade} labelId="guest-grade-label" testIdPrefix="guest-grade-" />
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
              {/* An illustration, not a code to type (UI audit J04): marked Example and left out of the reading order. */}
              <span className="relative select-none" aria-hidden>
                <span className="font-display bg-card text-muted-foreground block rounded-xl border border-dashed px-3 py-2 text-2xl font-extrabold tracking-[0.12em]">
                  QF7K2M
                </span>
                <span className="bg-muted text-muted-foreground absolute -top-2 left-2 rounded px-1 text-[10px] font-semibold tracking-wide uppercase">
                  Example
                </span>
              </span>
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
            <p className="text-muted-foreground text-sm">Family games with a free account.</p>
          </div>
          <div className="grid gap-2 md:justify-items-end">
            <Button size="lg" className="w-full md:w-fit" onClick={signUp} data-testid="guest-family-space">
              {signupOpen ? 'Create a free family space' : 'Sign in'}
            </Button>
            <Button variant="outline" className="w-full md:w-fit" onClick={() => setCodeSheet('')} data-testid="guest-have-code">
              <KeyRoundIcon /> Have a code?
            </Button>
          </div>
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

      {codeSheet !== null && (
        <CodeSheet
          initialCode={codeSheet}
          onClose={() => {
            setCodeSheet(null);
            if (window.location.search.includes('code=')) window.history.replaceState(null, '', window.location.pathname);
          }}
          onSignUp={signUp}
        />
      )}
      <SignupSheet open={sheet !== null} mode={sheet ?? 'signup'} onClose={() => setSheet(null)} />
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
  [
    'Can adults play?',
    'Yes. Quests go from Grade 1 to Algebra and contest maths, so grown-ups, teens and classes play too. An account is free.',
  ],
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
function GuestTodayCard({ level, played, onPlay }: { level: QuestionBankLevelId; played?: GuestToday; onPlay: () => void }) {
  const hits = played?.hits.filter(Boolean).length ?? 0;
  const states: RingState[] = Array.from({ length: GUEST_TODAY_SIZE }, (_, index) =>
    played ? (played.hits[index] ? 'hit' : 'miss') : 'open',
  );
  return (
    <TodayCard
      eyebrow={<>Today&apos;s {GUEST_TODAY_SIZE} · {guestLevelWords(level)}</>}
      title={played ? `You hit ${hits} of ${played.hits.length} today.` : 'Five questions. Can you hit all five?'}
      states={states}
      played={Boolean(played)}
      note={played ? 'A new five tomorrow.' : undefined}
      onPlay={onPlay}
      playLabel={played ? 'Play again' : "Play today's 5"}
      testId="guest-today"
      playTestId="guest-today-play"
    />
  );
}

function CardGrid({ tiles, onOpen, advanced = false }: { tiles: GuestTile[]; onOpen: (tile: GuestTile) => void; advanced?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => {
        const best = tile.locked ? undefined : guestMemory.best(tile.code);
        return (
          <QuestCard
            key={tile.code}
            title={guestTileTitle(tile)}
            detail={`${advanced ? `${guestLevelWords(tile.level_id)} · ` : ''}${guestTileDetail(tile)}`}
            icon={tile.kind === 'assessment' ? 'pencil' : tile.mode === 'timed' ? 'timer' : 'target'}
            // The guest board keeps its mode colours (H5: grade hues are the member home's).
            tone={tile.locked ? 'locked' : { mode: tile.mode }}
            locked={tile.locked}
            onOpen={() => onOpen(tile)}
            label={tile.locked ? `${guestTileName(tile)} is free with an account` : `Play ${guestTileName(tile)}`}
            testId={tile.locked ? `guest-locked-${tile.code}` : `guest-tile-${tile.code}`}
            footer={
              <>
                {tile.locked && (
                  <span className="text-primary mt-0.5 inline-flex items-center gap-1 text-xs font-bold">
                    <LockIcon className="size-3" aria-hidden /> Free account
                  </span>
                )}
                {best !== undefined && <span className="text-primary mt-0.5 text-xs font-semibold">Best: {best}</span>}
              </>
            }
          />
        );
      })}
    </div>
  );
}
