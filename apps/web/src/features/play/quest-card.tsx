import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LockIcon, PencilLineIcon, PlayIcon, TargetIcon, TimerIcon } from 'lucide-react';
import type { TileGrade, TileIcon } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Phase 67 (H6, docs/member-home-plan.md): the guest Quest board's pieces, shared by the guest home and
 * the member home -- a quest card, the five-ring Today card and the grade row. Since Phase 78 (owner,
 * 2026-11-05) both boards wear one hue per grade (`--grade-N`, H5), the mode shown by its icon; amber is
 * for action only, so the Daily's button and the hit rings take the space's primary. A card always says
 * its level in words, so colour is never the only signal, and no card shows a tile's code.
 */

/** Each grade's hue as Tailwind classes (written out, so the build keeps them). */
export const GRADE_TONE: Record<TileGrade, string> = {
  1: 'bg-grade-1 text-grade-1-foreground',
  2: 'bg-grade-2 text-grade-2-foreground',
  3: 'bg-grade-3 text-grade-3-foreground',
  4: 'bg-grade-4 text-grade-4-foreground',
  5: 'bg-grade-5 text-grade-5-foreground',
  6: 'bg-grade-6 text-grade-6-foreground',
  7: 'bg-grade-7 text-grade-7-foreground',
  8: 'bg-grade-8 text-grade-8-foreground',
};

/** A card's band: its grade's hue (the brand's for a level off the row), or locked. */
export type CardTone = { grade: TileGrade | null } | 'locked';

function toneClasses(tone: CardTone): string {
  if (tone === 'locked') return 'bg-primary/15 text-primary';
  return tone.grade ? GRADE_TONE[tone.grade] : 'bg-primary text-primary-foreground';
}

const ICONS = { target: TargetIcon, timer: TimerIcon, pencil: PencilLineIcon } as const;

export function QuestCard({
  title,
  detail,
  icon,
  tone,
  onOpen,
  label,
  testId,
  advanced = false,
  locked = false,
  footer,
  aside,
  disabled = false,
}: {
  title: string;
  detail: ReactNode;
  icon: TileIcon;
  tone: CardTone;
  onOpen: () => void;
  /** What a screen reader hears for the card's button. */
  label: string;
  testId: string;
  /** An "Adv" mark on the band: a harder track than the grade's standards. */
  advanced?: boolean;
  locked?: boolean;
  /** Lines under the detail: a best score, "Free account". */
  footer?: ReactNode;
  /** Beside the card's button, e.g. the favorite star. */
  aside?: ReactNode;
  disabled?: boolean;
}) {
  const Icon = locked ? LockIcon : ICONS[icon];
  return (
    <div
      className="bg-card border-foreground/15 relative grid overflow-hidden rounded-2xl border shadow-[var(--elevation-1)] transition-shadow hover:shadow-[var(--elevation-2)]"
      data-testid={testId}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={label}
        className="focus-visible:ring-ring grid grid-rows-[auto_1fr] text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-60"
      >
        <span className={cn('relative grid h-14 place-items-center', toneClasses(tone))}>
          <Icon className={locked ? 'size-9' : 'size-7'} aria-hidden />
          {/* White on a dark pill over any grade's hue, at 12px (JF29). */}
          {advanced && (
            <span className="absolute top-1.5 left-2 rounded-full bg-black/55 px-2 text-xs leading-5 font-bold text-white">Adv</span>
          )}
        </span>
        <span className="grid content-start gap-0.5 px-3 pt-2.5 pb-3">
          <span className="font-display text-base leading-tight font-extrabold">{title}</span>
          <span className="text-muted-foreground text-xs">{detail}</span>
          {footer}
        </span>
      </button>
      {aside && <span className="absolute top-14 right-0">{aside}</span>}
    </div>
  );
}

export type RingState = 'open' | 'hit' | 'miss';

/** Five targets: hit, missed or still to play. */
export function TargetRings({ states, label }: { states: RingState[]; label: string }) {
  return (
    <div className="flex gap-2" role="img" aria-label={label}>
      {states.map((state, index) => (
        <span
          key={index}
          className={cn(
            'grid size-7 place-items-center rounded-full border-[3px]',
            state === 'hit' ? 'border-primary bg-primary/20' : state === 'miss' ? 'border-muted-foreground/30' : 'border-border',
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full',
              state === 'hit' ? 'bg-primary' : state === 'miss' ? 'bg-muted-foreground/30' : 'bg-border',
            )}
          />
        </span>
      ))}
    </div>
  );
}

/** Today's five: the day's set as five rings, the same for everyone that day. */
export function TodayCard({
  eyebrow,
  title,
  states,
  played,
  onPlay,
  playLabel,
  testId,
  playTestId,
  note,
  quiet = false,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  states: RingState[];
  played: boolean;
  onPlay?: () => void;
  playLabel: string;
  testId: string;
  playTestId: string;
  note?: ReactNode;
  /**
   * Phase 74 (JF23): Next up above already offers it, so the twin here is a quiet line -- a normal-weight outline
   * button, never the heavier filled one that would win the eye from Next up.
   */
  quiet?: boolean;
}) {
  const hits = states.filter((state) => state === 'hit').length;
  if (quiet) {
    return (
      <div className="bg-card text-card-foreground flex flex-wrap items-center gap-3 rounded-2xl border p-4" data-testid={testId} data-quiet="true">
        {/* No min-w-0: the rings keep their width, and the button wraps below them on a phone. */}
        <span className="grid flex-1 gap-1">
          <span className="text-muted-foreground text-[13px] font-semibold">{eyebrow}</span>
          <TargetRings states={states} label={played ? `${hits} of ${states.length} hit` : `${states.length} targets`} />
        </span>
        {onPlay && (
          <Button size="sm" variant="outline" onClick={onPlay} data-testid={playTestId}>
            {playLabel}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="bg-card text-card-foreground grid gap-3 rounded-3xl border p-5 shadow-[var(--elevation-2)]" data-testid={testId}>
      <span className="text-muted-foreground text-[13px] font-semibold">{eyebrow}</span>
      <h2 className="font-display text-2xl font-black">{title}</h2>
      <TargetRings states={states} label={played ? `${hits} of ${states.length} hit` : `${states.length} targets`} />
      {note && <p className="text-muted-foreground text-sm">{note}</p>}
      {/* Phase 78 (JF34): the space's primary, never amber -- amber does one job, and it sat on Grade 3's cards. */}
      {onPlay && (
        <Button
          size="lg"
          onClick={onPlay}
          variant={played ? 'outline' : 'default'}
          className="w-full sm:w-fit"
          data-testid={playTestId}
        >
          {playLabel} <PlayIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}

/** How far the row's edge fades, where it can scroll that way. */
const FADE_PX = 24;

/** The fade at each edge the row can scroll towards: a mask, so it works over any background. */
function edgeMask(start: boolean, end: boolean): string | undefined {
  if (!start && !end) return undefined;
  const left = start ? `transparent, black ${FADE_PX}px` : 'black, black';
  const right = end ? `black calc(100% - ${FADE_PX}px), transparent` : 'black, black';
  return `linear-gradient(to right, ${left}, ${right})`;
}

/**
 * The grade row: one chip per grade, the chosen one filled in its hue and ringed (JF29: a fill alone was 1.30:1 for
 * Grade 4). Phase 78 (JF28): on a phone the row scrolls sideways, so its edges fade where there is more, and the
 * chosen grade is scrolled into view -- the row's own scroll only, never the page's.
 */
export function GradeRow({
  grades,
  value,
  onChange,
  labelId,
  testIdPrefix,
  hued = false,
}: {
  grades: readonly number[];
  value: number;
  onChange: (grade: number) => void;
  labelId: string;
  testIdPrefix: string;
  /** The chosen chip wears its grade's hue (both boards since Phase 78); else the brand's. */
  hued?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const placed = useRef(false);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () =>
      setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [grades.length]);

  useEffect(() => {
    const el = row.current;
    const chip = el?.querySelector<HTMLElement>(`[data-grade="${value}"]`);
    if (!el || !chip) return;
    const box = el.getBoundingClientRect();
    const at = chip.getBoundingClientRect();
    // Clear of the fade, with room for the ring.
    const room = FADE_PX + 8;
    const by = at.left < box.left + room ? at.left - box.left - room : at.right > box.right - room ? at.right - box.right + room : 0;
    if (by !== 0) {
      const still = !placed.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollBy({ left: by, behavior: still ? 'auto' : 'smooth' });
    }
    placed.current = true;
  }, [value, grades.length]);

  const mask = edgeMask(edges.start, edges.end);
  return (
    <div
      ref={row}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-1 sm:px-1"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      role="radiogroup"
      aria-labelledby={labelId}
      data-testid={`${testIdPrefix}row`}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      {grades.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={g === value}
          aria-label={`Grade ${g}`}
          onClick={() => onChange(g)}
          data-testid={`${testIdPrefix}${g}`}
          data-grade={g}
          className={cn(
            'font-display min-h-11 min-w-11 flex-none rounded-full border px-3 text-base font-bold transition-colors',
            g === value
              ? cn(
                  'ring-foreground ring-offset-background ring-2 ring-offset-2',
                  hued && g >= 1 && g <= 8 ? cn('border-transparent', GRADE_TONE[g as TileGrade]) : 'border-primary bg-primary text-primary-foreground',
                )
              : 'bg-card hover:bg-muted',
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}
