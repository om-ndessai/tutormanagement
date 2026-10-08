// The sessions carousel's windowing, as pure functions (ported from the logic in
// apps/web/src/features/dashboard/sessions-carousel.tsx @ 1132322), so it is tested without a
// device: what the strip holds, in what order, which card is "Next up", where it opens, and
// the offsets each card snaps to.
import {
  formatDuration,
  formatMinutesOfDay,
  parseClockTime,
  type TutoringSession,
  type UpcomingSession,
} from '@tmi/shared';

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** "Today", "Tomorrow", "Yesterday", else "Thu, Sep 25". */
export function relativeDay(iso: string, today: string): string {
  const gap = dayNumber(iso) - dayNumber(today);
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Tomorrow';
  if (gap === -1) return 'Yesterday';

  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "in 45 min", "in 2 hr 10 min", "Under way", or "Tomorrow at 4:00 PM". */
export function countdown(
  next: Pick<UpcomingSession, 'start_time' | 'occurs_on'>,
  today: string,
  nowMinutes: number,
): string {
  const start = parseClockTime(next.start_time) ?? 0;

  if (next.occurs_on === today) {
    const left = start - nowMinutes;
    if (left <= 0) return 'Under way';
    return `in ${formatDuration(left)}`;
  }

  return `${relativeDay(next.occurs_on, today)} at ${formatMinutesOfDay(start)}`;
}

/** Card widths (the web's w-56, w-72, w-44) and the gap between cards (gap-3). */
export const CARD_WIDTH = 224;
export const NEXT_WIDTH = 272;
export const NOTE_WIDTH = 176;
export const NOW_WIDTH = 36;
export const MORE_WIDTH = 120;
export const GAP = 12;

export type CarouselItem =
  | { kind: 'past'; key: string; width: number; session: TutoringSession }
  | { kind: 'past-empty'; key: string; width: number }
  | { kind: 'now'; key: string; width: number }
  | { kind: 'skeleton'; key: string; width: number }
  | { kind: 'next'; key: string; width: number; occurrence: UpcomingSession }
  | { kind: 'upcoming'; key: string; width: number; occurrence: UpcomingSession }
  | { kind: 'cancelled'; key: string; width: number; occurrence: UpcomingSession }
  | { kind: 'none-scheduled'; key: string; width: number }
  | { kind: 'load-more'; key: string; width: number };

export function occurrenceKey(occurrence: Pick<UpcomingSession, 'schedule_id' | 'occurs_on'>): string {
  return `${occurrence.schedule_id}-${occurrence.occurs_on}`;
}

/**
 * The strip, left to right: the last lessons taught (oldest first), "Now", then what the
 * schedules say is coming. The highlighted lesson is the next one actually happening: a
 * cancelled date keeps its place, but is never "Next up". The strip opens on that card, or on
 * "Now" when nothing is coming. A last card pulls in five more while there are more.
 */
export function buildCarousel({
  past,
  upcoming,
  pending,
  hasMore,
  fetchingMore,
}: {
  /** Newest first, as the API returns them. */
  past: TutoringSession[];
  upcoming: UpcomingSession[];
  pending: boolean;
  hasMore: boolean;
  fetchingMore: boolean;
}): { items: CarouselItem[]; anchorIndex: number; empty: boolean } {
  const items: CarouselItem[] = [];

  for (const session of [...past].reverse()) {
    items.push({ kind: 'past', key: `past-${session.id}`, width: CARD_WIDTH, session });
  }
  if (past.length === 0) items.push({ kind: 'past-empty', key: 'past-empty', width: NOTE_WIDTH });

  const nowIndex = items.length;
  items.push({ kind: 'now', key: 'now', width: NOW_WIDTH });

  if (pending) {
    for (let index = 0; index < 3; index += 1) {
      items.push({ kind: 'skeleton', key: `skeleton-${index}`, width: CARD_WIDTH });
    }
  }

  const firstLive = upcoming.findIndex((occurrence) => !occurrence.cancellation);
  let nextIndex = -1;
  upcoming.forEach((occurrence, index) => {
    const key = occurrenceKey(occurrence);
    if (occurrence.cancellation) {
      items.push({ kind: 'cancelled', key: `cancelled-${key}`, width: CARD_WIDTH, occurrence });
    } else if (index === firstLive) {
      nextIndex = items.length;
      items.push({ kind: 'next', key: `next-${key}`, width: NEXT_WIDTH, occurrence });
    } else {
      items.push({ kind: 'upcoming', key: `upcoming-${key}`, width: CARD_WIDTH, occurrence });
    }
  });

  if (!pending && upcoming.length === 0) {
    items.push({ kind: 'none-scheduled', key: 'none-scheduled', width: NOTE_WIDTH });
  }
  if (fetchingMore) items.push({ kind: 'skeleton', key: 'skeleton-more', width: CARD_WIDTH });
  else if (hasMore) items.push({ kind: 'load-more', key: 'load-more', width: MORE_WIDTH });

  return {
    items,
    anchorIndex: nextIndex >= 0 ? nextIndex : nowIndex,
    empty: !pending && past.length === 0 && upcoming.length === 0,
  };
}

/**
 * Where the strip scrolls to centre each card in a viewport of `viewport` points. The padding at
 * each end lets the "Next up" card reach the middle even with little beside it (the web's
 * spacers). Offsets are clamped to what the strip can scroll.
 */
export function carouselOffsets(
  items: Pick<CarouselItem, 'width'>[],
  viewport: number,
): { padding: number; offsets: number[]; contentWidth: number } {
  const padding = Math.max(0, (viewport - NEXT_WIDTH) / 2);
  const widths = items.map((item) => item.width);
  const contentWidth =
    padding * 2 + widths.reduce((sum, width) => sum + width, 0) + GAP * Math.max(0, items.length - 1);
  const maxOffset = Math.max(0, contentWidth - viewport);

  let left = padding;
  const offsets = widths.map((width) => {
    const centre = left + width / 2 - viewport / 2;
    left += width + GAP;
    return Math.round(Math.min(maxOffset, Math.max(0, centre)));
  });

  return { padding, offsets, contentWidth };
}

/** The card nearest an offset: which one the strip has settled on. */
export function nearestIndex(offsets: number[], offset: number): number {
  let best = 0;
  offsets.forEach((candidate, index) => {
    if (Math.abs(candidate - offset) < Math.abs((offsets[best] ?? 0) - offset)) best = index;
  });
  return best;
}
