import { useEffect, useMemo, useState } from 'react';

// Phase 47 (docs/quest-games-g2-plan.md): the moments of a game. The doors
// that open on 3, 2, 1, Go! when the host starts the Quest (every screen
// counts to the same instant, the server's), the knockout stamp when a game
// ends early, and confetti for the winners. Under reduced motion there is no
// animation: the countdown is its numbers, the rest is the words beside it.

const COLOURS = ['#f2b632', '#3f48b0', '#e2556b', '#3a9a72', '#8a5cd8'];

export function prefersLessMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Milliseconds left until `at` (an ISO instant on the server's clock), ticking on the device. */
export function useCountdown(at: string | null, serverNow: string | undefined): number {
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (serverNow) setOffset(Date.parse(serverNow) - Date.now());
  }, [serverNow]);
  const target = at ? Date.parse(at) : 0;
  const pending = target > tick + offset;
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setTick(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [pending]);
  return Math.max(0, target - (tick + offset));
}

/** The doors: two panels with the count on them, swinging apart as it reaches Go. */
export function DoorsCountdown({ msLeft }: { msLeft: number }) {
  const [still] = useState(prefersLessMotion);
  const seconds = Math.ceil(msLeft / 1000);
  // The last second opens the doors: "Go!" is what is behind them.
  const opening = msLeft <= 1000;
  // 5 s: "Get ready", then 3, 2, 1, and the doors open on the last second.
  const label = seconds > 4 ? 'Get ready' : opening ? 'Go!' : String(seconds - 1);
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/60"
      role="alert"
      aria-live="assertive"
      aria-label={`The game starts in ${seconds} seconds`}
      data-testid="game-countdown"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={'text-7xl font-black tracking-tight text-white drop-shadow-lg sm:text-9xl ' + (opening ? 'quest-go' : '')}
        >
          {opening ? 'Go!' : ''}
        </span>
      </div>
      {!still || !opening ? (
        <>
          <Door side="left" open={opening && !still} />
          <Door side="right" open={opening && !still} />
        </>
      ) : null}
      {!opening && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
          <span className="text-sm font-semibold tracking-[0.3em] uppercase opacity-80">The Quest begins</span>
          <span
            key={label}
            className="quest-count-pop text-8xl font-black tabular-nums drop-shadow-lg sm:text-[10rem]"
            data-testid="game-countdown-number"
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

function Door({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'absolute inset-y-0 w-1/2 border-white/20 from-brand-700 to-brand-950 bg-gradient-to-b shadow-2xl ' +
        (side === 'left' ? 'left-0 origin-left border-r-4 ' : 'right-0 origin-right border-l-4 ') +
        (open ? (side === 'left' ? 'quest-door-left' : 'quest-door-right') : '')
      }
    >
      {/* The panels and the handle, so it reads as a door. */}
      <div className="absolute inset-6 grid grid-rows-2 gap-6 sm:inset-10">
        <div className="rounded-lg border-2 border-white/15" />
        <div className="rounded-lg border-2 border-white/15" />
      </div>
      <span
        className={
          'absolute top-1/2 size-5 -translate-y-1/2 bg-brand-200 rounded-full shadow ' + (side === 'left' ? 'right-5' : 'left-5')
        }
      />
    </div>
  );
}

/** Confetti falling once over the screen; nothing under reduced motion. */
export function Confetti() {
  const [still] = useState(prefersLessMotion);
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 14) * 110}ms`,
        fall: `${2400 + ((i * 53) % 1600)}ms`,
        drift: `${((i * 29) % 140) - 70}px`,
        spin: `${360 + ((i * 47) % 540)}deg`,
        colour: COLOURS[i % COLOURS.length]!,
        wide: i % 3 === 0,
      })),
    [],
  );
  if (still) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden data-testid="game-confetti">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="quest-confetti absolute top-0 block rounded-[2px]"
          style={
            {
              left: p.left,
              width: p.wide ? 10 : 7,
              height: p.wide ? 6 : 12,
              background: p.colour,
              animationDelay: p.delay,
              '--fall': p.fall,
              '--drift': p.drift,
              '--spin': p.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** "K.O.!": a stamp that lands once when a knockout ends the game, then fades. */
export function KnockoutBurst() {
  const [still] = useState(prefersLessMotion);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);
  if (still || !shown) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden
      data-testid="game-knockout-burst"
    >
      <span className="quest-ko bg-destructive rounded-2xl px-10 py-6 text-7xl font-black tracking-tight text-white shadow-2xl sm:text-9xl">
        K.O.!
      </span>
    </div>
  );
}
