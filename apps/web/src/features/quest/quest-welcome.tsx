import { useEffect, useMemo, useState } from 'react';
import { FlameIcon, TrophyIcon, XIcon } from 'lucide-react';
import { QUEST_LEFT_CAP, QUEST_WELCOME_MS, questLevelLabel, questWelcome, type QuestSummary } from '@tmi/shared';

import { Button } from '@/components/ui/button';

// The welcome when a student opens Quest (owner, 2026-10-21): a personal
// popup with confetti, a few numbers and one line to bring them back. It
// closes itself after five seconds, or on a tap. Under reduced motion there is
// no confetti (the countdown bar is stilled by the global guard).

const COLOURS = ['#f2b632', '#3f48b0', '#e2556b', '#3a9a72', '#8a5cd8'];

function prefersLessMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function QuestWelcome({ summary, onClose }: { summary: QuestSummary; onClose: () => void }) {
  const level = questLevelLabel(summary.level_id);
  const { title, line } = questWelcome(summary, level);
  const [still] = useState(prefersLessMotion);

  useEffect(() => {
    const timer = window.setTimeout(onClose, QUEST_WELCOME_MS);
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 90}ms`,
        fall: `${2200 + ((i * 53) % 1400)}ms`,
        drift: `${((i * 29) % 120) - 60}px`,
        spin: `${360 + ((i * 47) % 540)}deg`,
        colour: COLOURS[i % COLOURS.length]!,
        wide: i % 3 === 0,
      })),
    [],
  );

  const stats: { label: string; value: string }[] = [
    { label: 'Points', value: String(summary.points) },
    { label: 'Answered', value: String(summary.answered) },
    { label: 'Approved', value: String(summary.confirmed) },
    { label: `Left in ${level}`, value: summary.left_in_level >= QUEST_LEFT_CAP ? `${QUEST_LEFT_CAP}+` : String(summary.left_in_level) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quest-welcome-title"
      data-testid="quest-welcome"
      onClick={onClose}
    >
      {!still && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
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
      )}
      <div
        className="bg-card text-card-foreground relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          aria-label="Close"
          onClick={onClose}
          data-testid="quest-welcome-close"
        >
          <XIcon />
        </Button>
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <h2 id="quest-welcome-title" className="mt-2 text-xl font-semibold" data-testid="quest-welcome-title">
          {title}
        </h2>
        {summary.streak_days > 0 && (
          <p className="text-primary mt-1 flex items-center gap-1 text-sm font-medium" data-testid="quest-welcome-streak">
            <FlameIcon className="size-4" /> {summary.streak_days}-day streak
            {summary.answered_today > 0 ? ` · ${summary.answered_today} today` : ''}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-muted rounded-lg px-1 py-2">
              <dt className="text-muted-foreground text-[11px] leading-tight">{stat.label}</dt>
              <dd className="mt-0.5 flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
                {stat.label === 'Points' && <TrophyIcon className="size-4" />}
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm" data-testid="quest-welcome-line">
          {line}
        </p>
        <div className="bg-muted mt-5 h-1 overflow-hidden rounded-full" aria-hidden>
          <div
            className="quest-countdown bg-primary h-full origin-left"
            style={{ '--duration': `${QUEST_WELCOME_MS}ms` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
