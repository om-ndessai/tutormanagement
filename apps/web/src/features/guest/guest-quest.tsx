import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon, XIcon } from 'lucide-react';
import {
  checkAnswer,
  guestLevelWords,
  guestPoolUsedUp,
  guestSeries,
  guestTileName,
  guestTodaySet,
  type GuestQuestion,
  type GuestTile,
} from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MathText } from '@/features/question-bank/math-text';
import { useAuth } from '@/providers/auth-provider';
import { countEvent, flushEvents, useGuestPool } from './guest-api';
import { guestMemory, readQuestState, writeQuestState, type GuestQuestState } from './guest-store';
import { SignupSheet } from './signup-sheet';
import { NudgeSheet, benefitsFor } from './nudge-sheet';

/** The clock as it stands, paused time left out. */
function elapsedMs(state: GuestQuestState, now: number): number {
  const pausedNow = state.pausedAt !== null ? now - state.pausedAt : 0;
  return now - state.startedAt - state.pausedMs - pausedNow;
}

/**
 * Phase 63 (P10, P12): a guest's quest, played entirely on the device from the level's guest pool:
 * marked by shared `checkAnswer`, timed by a clock that pauses for the sign-up sheet, the series unseen
 * first (`guestSeries`). Nothing is sent but anonymous counts. Kept in this tab's storage, so a sign-up
 * that reloads the page comes back to it.
 */
/** What a guest reads for a quest: never its code or its curriculum. */
export function guestQuestName(tile: GuestTile, today: boolean): string {
  return today ? `Today's 5 · ${guestLevelWords(tile.level_id)}` : guestTileName(tile);
}

export function GuestQuest({ tile, today }: { tile: GuestTile; today?: { day: string } }) {
  const { config } = useAuth();
  const guest = config!.guest!;
  const navigate = useNavigate();
  const pool = useGuestPool(guest.version, tile.level_id);
  const [state, setState] = useState<GuestQuestState | null>(() => readQuestState(tile.code));
  const [now, setNow] = useState(() => Date.now());
  const [nudge, setNudge] = useState<{ right: boolean } | null>(null);
  const [typed, setTyped] = useState('');
  const [signingUp, setSigningUp] = useState(false);
  // P13: back from a redirect provider mid sign-up: the sheet opens at the age question.
  const { pendingSignup } = useAuth();
  useEffect(() => {
    if (pendingSignup) setSigningUp(true);
  }, [pendingSignup]);
  const questions = pool.data?.data.questions ?? [];
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const limitMs = tile.mode === 'timed' ? tile.value * 60_000 : null;

  // Start (or resume) once the pool is here: the series unseen first, as many as the tile asks.
  useEffect(() => {
    if (state || questions.length === 0) return;
    // Today's 5 is the day's own five, the same for every visitor; a tile is the unseen first.
    const series = today ? guestTodaySet(questions, today.day, tile.level_id) : guestSeries(questions, guestMemory.seen(tile.level_id));
    const ids = (tile.mode === 'count' ? series.slice(0, tile.value) : series).map((q) => q.id);
    const fresh: GuestQuestState = { code: tile.code, questionIds: ids, answers: [], startedAt: Date.now(), pausedMs: 0, pausedAt: null, nudged: false };
    setState(fresh);
    // Today's 5 is not a tile: it is never carried into a member's favorites.
    if (!today) guestMemory.addPlayed(tile.code);
    countEvent({ name: 'tile_started', tile: tile.code, source: 'guest' });
  }, [state, questions, tile, today]);

  useEffect(() => writeQuestState(state), [state]);

  // The clock: a timed quest ends at its limit; the sheet stops it.
  useEffect(() => {
    if (!limitMs || !state || state.pausedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [limitMs, state]);

  // The end, by the last answer or the clock: recorded once (the device's memory and the counts).
  const ended =
    state !== null &&
    (state.answers.length >= state.questionIds.length || (limitMs !== null && elapsedMs(state, now) >= limitMs));
  useEffect(() => {
    if (!state || !ended || state.finished) return;
    record(state);
    setState({ ...state, finished: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  if (pool.isPending || !state) {
    return <Shell><p className="text-muted-foreground text-sm">Getting your quest ready…</p></Shell>;
  }
  if (pool.isError || questions.length === 0) {
    return <Shell><p className="text-sm">This quest is not available just now.</p></Shell>;
  }

  const timeLeft = limitMs !== null ? Math.max(0, limitMs - elapsedMs(state, now)) : null;
  const done = state.answers.length >= state.questionIds.length || timeLeft === 0;
  const current = done ? null : byId.get(state.questionIds[state.answers.length]!);
  const signUp = () => {
    countEvent({ name: 'signup_started', source: done ? 'results' : 'nudge', tile: tile.code });
    flushEvents();
    setSigningUp(true);
  };

  function answer(question: GuestQuestion, given: string | null) {
    const correct = given !== null && checkAnswer({ kind: question.kind, answer: question.answer }, given);
    const answers = [...state!.answers, { id: question.id, answer: given, correct }];
    let next: GuestQuestState = { ...state!, answers };
    setTyped('');
    if (answers.length === 1) countEvent({ name: 'first_answer', tile: tile.code, value: correct ? 1 : 0 });
    // The sheet, after the configured answer: once a quest, and not again soon after a dismissal.
    const after = guest.settings.nudge_after;
    const cooled = (guestMemory.nudgeDismissedAt() ?? 0) + guest.settings.nudge_cooldown_hours * 3_600_000 < Date.now();
    const finished = answers.length >= state!.questionIds.length;
    if (after > 0 && answers.length === after && !state!.nudged && cooled && !finished) {
      next = { ...next, nudged: true, pausedAt: Date.now() };
      setNudge({ right: correct });
      countEvent({ name: 'nudge_shown', tile: tile.code, variant: `n${after}` });
    }
    setState(next);
  }

  function record(final: GuestQuestState) {
    const score = final.answers.filter((a) => a.correct).length;
    guestMemory.addSeen(tile.level_id, final.answers.map((a) => a.id));
    if (today) guestMemory.setToday({ day: today.day, level: tile.level_id, hits: final.answers.map((a) => a.correct) });
    else guestMemory.setBest(tile.code, score);
    countEvent({ name: 'quest_finished', tile: tile.code, value: score });
    if (guestPoolUsedUp(questions, guestMemory.seen(tile.level_id))) countEvent({ name: 'pool_used_up', tile: tile.code });
    flushEvents();
  }

  function resume(accepted: boolean) {
    if (!accepted) {
      guestMemory.dismissNudge();
      countEvent({ name: 'nudge_dismissed', tile: tile.code });
    } else countEvent({ name: 'nudge_accepted', tile: tile.code });
    setNudge(null);
    setState((s) => (s && s.pausedAt !== null ? { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null } : s));
    setNow(Date.now());
  }

  const sheet = <SignupSheet open={signingUp} onClose={() => setSigningUp(false)} />;
  if (done) {
    return (
      <>
      {sheet}
      <Results
        tile={tile}
        name={guestQuestName(tile, Boolean(today))}
        state={state}
        byId={byId}
        usedUp={guestPoolUsedUp(questions, guestMemory.seen(tile.level_id))}
        benefits={benefitsFor(tile.level_id, guest.member_counts)}
        onSignUp={signUp}
        onAgain={() => {
          writeQuestState(null);
          setState(null);
        }}
        key={state.finished ? 'final' : 'ending'}
      />
      </>
    );
  }

  return (
    <Shell
      right={
        <span className="text-muted-foreground text-sm" data-testid="guest-progress">
          {timeLeft !== null
            ? `${Math.floor(timeLeft / 60_000)}:${String(Math.floor((timeLeft % 60_000) / 1000)).padStart(2, '0')}`
            : `${state.answers.length + 1} of ${state.questionIds.length}`}
        </span>
      }
    >
      {current && (
        <Card className="py-0" data-testid="guest-question">
          <CardContent className="grid gap-4 p-6">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase" data-testid="guest-quest-name">
                {guestQuestName(tile, Boolean(today))}
              </span>
              {current.beta && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]" data-testid="guest-question-beta">
                  Beta
                </Badge>
              )}
            </div>
            <MathText text={current.stem} className="text-lg leading-relaxed" />
            {current.kind === 'choice' ? (
              <div className="grid gap-2" role="group" aria-label="Your answer">
                {current.choices.map((choice, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-3 text-left"
                    onClick={() => answer(current, choice)}
                    data-testid={`guest-choice-${index}`}
                  >
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}</span>
                    <MathText text={choice} />
                  </Button>
                ))}
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (typed.trim()) answer(current, typed.trim());
                }}
              >
                <Input aria-label="Your answer" value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="decimal" data-testid="guest-number" />
                <Button type="submit">Answer</Button>
              </form>
            )}
            <Button variant="ghost" className="w-fit" onClick={() => answer(current, null)} data-testid="guest-skip">
              Skip
            </Button>
          </CardContent>
        </Card>
      )}
      <NudgeSheet
        open={nudge !== null}
        headline={nudge?.right ? guest.settings.nudge_right : guest.settings.nudge_wrong}
        benefits={benefitsFor(tile.level_id, guest.member_counts)}
        onSignUp={() => {
          resume(true);
          signUp();
        }}
        onClose={() => resume(false)}
        shareLink={`${window.location.origin}/play/${tile.code}`}
      />
      {sheet}
    </Shell>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-background min-h-dvh">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-8">
        <Link to="/" aria-label="Home">
          <LogoLockup />
        </Link>
        <span className="ml-auto">{right}</span>
      </header>
      <main className="mx-auto grid max-w-2xl gap-4 px-4 py-6">{children}</main>
    </div>
  );
}

/** The results: the main moment to offer an account (P12), with the worked solutions. */
function Results({
  tile,
  name,
  state,
  byId,
  usedUp,
  benefits,
  onSignUp,
  onAgain,
}: {
  tile: GuestTile;
  name: string;
  state: GuestQuestState;
  byId: Map<string, GuestQuestion>;
  usedUp: boolean;
  benefits: string[];
  onSignUp: () => void;
  onAgain: () => void;
}) {
  const { config } = useAuth();
  const score = state.answers.filter((a) => a.correct).length;
  const link = `${window.location.origin}/play/${tile.code}`;
  async function challenge() {
    const text = `I got ${score}/${state.answers.length} on ${name} on Aimtrue. Can you beat it?`;
    try {
      if (navigator.share) await navigator.share({ title: 'Aimtrue', text, url: link });
      else await navigator.clipboard.writeText(`${text} ${link}`);
    } catch {
      // Dismissed.
    }
  }
  return (
    <Shell>
      <Card className="py-0" data-testid="guest-results">
        <CardContent className="grid gap-3 p-6">
          <h1 className="font-display text-2xl font-semibold" data-testid="guest-score">
            {score} of {state.answers.length} right
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="guest-results-name">{name}</p>
          {usedUp && (
            <p className="bg-primary/10 rounded-lg px-3 py-2 text-sm" data-testid="guest-used-up">
              You&apos;ve played all the free {guestLevelWords(tile.level_id)} questions. {benefits[0]} with a free account.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSignUp} data-testid="guest-save-score">
              {config?.signup_open ? 'Save this score: sign up free' : 'Sign in'}
            </Button>
            <Button variant="outline" onClick={() => void challenge()}>
              Challenge a friend
            </Button>
            <Button variant="outline" onClick={onAgain} data-testid="guest-again">
              {usedUp ? 'Play these again' : 'Play again'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ol className="grid gap-3">
        {state.answers.map((given, index) => {
          const q = byId.get(given.id);
          if (!q) return null;
          return (
            <li key={given.id}>
              <Card className="py-0">
                <CardContent className="grid gap-2 p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    {given.correct ? <CheckIcon className="text-primary size-4" /> : <XIcon className="text-destructive size-4" />}
                    Question {index + 1}
                  </p>
                  <MathText text={q.stem} />
                  <p className="text-muted-foreground">
                    Answer: <MathText text={q.answer} />
                    {given.answer !== null && !given.correct && <> · yours: <MathText text={given.answer} /></>}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-xs">How to solve it</summary>
                    <MathText text={q.solution} className="mt-1 block" />
                  </details>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </Shell>
  );
}
