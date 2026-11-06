import { session, upcoming } from '@/test/fixtures';
import {
  CARD_WIDTH,
  GAP,
  NEXT_WIDTH,
  buildCarousel,
  carouselOffsets,
  countdown,
  nearestIndex,
} from './carousel-model';

const base = { pending: false, hasMore: false, fetchingMore: false };

describe('buildCarousel', () => {
  it('lays out the past oldest first, then Now, then what is coming', () => {
    const past = [
      session({ id: 'newest', occurred_on: '2026-10-06' }),
      session({ id: 'oldest', occurred_on: '2026-10-01' }),
    ];
    const { items } = buildCarousel({
      ...base,
      past,
      upcoming: [upcoming(), upcoming({ occurs_on: '2026-10-15' })],
    });
    expect(items.map((item) => item.kind)).toEqual(['past', 'past', 'now', 'next', 'upcoming']);
    expect(items[0]).toMatchObject({ kind: 'past', session: { id: 'oldest' } });
  });

  it('never makes a cancelled date "Next up", but keeps it in its place', () => {
    const cancelled = upcoming({
      occurs_on: '2026-10-08',
      cancellation: { cancelled_as: 'tutor', note: 'Away', cancelled_by_name: 'Alex Chen' } as never,
    });
    const { items, anchorIndex } = buildCarousel({
      ...base,
      past: [],
      upcoming: [cancelled, upcoming({ occurs_on: '2026-10-15' }), upcoming({ occurs_on: '2026-10-22' })],
    });
    expect(items.map((item) => item.kind)).toEqual(['past-empty', 'now', 'cancelled', 'next', 'upcoming']);
    expect(anchorIndex).toBe(3);
    expect(items[3]!.width).toBe(NEXT_WIDTH);
  });

  it('opens on Now when nothing is coming, and says nothing is scheduled', () => {
    const { items, anchorIndex, empty } = buildCarousel({ ...base, past: [session()], upcoming: [] });
    expect(items[anchorIndex]!.kind).toBe('now');
    expect(items.at(-1)!.kind).toBe('none-scheduled');
    expect(empty).toBe(false);
  });

  it('is empty only with nothing taught and nothing scheduled, once loaded', () => {
    expect(buildCarousel({ ...base, past: [], upcoming: [] }).empty).toBe(true);
    expect(buildCarousel({ ...base, pending: true, past: [], upcoming: [] }).empty).toBe(false);
  });

  it('shows skeletons while loading, and a load-more card while there are more', () => {
    expect(
      buildCarousel({ ...base, pending: true, past: [], upcoming: [] }).items.filter(
        (i) => i.kind === 'skeleton',
      ),
    ).toHaveLength(3);
    expect(
      buildCarousel({ ...base, hasMore: true, past: [], upcoming: [upcoming()] }).items.at(-1)!.kind,
    ).toBe('load-more');
    const fetching = buildCarousel({
      ...base,
      hasMore: true,
      fetchingMore: true,
      past: [],
      upcoming: [upcoming()],
    });
    expect(fetching.items.at(-1)!.kind).toBe('skeleton');
  });
});

describe('carouselOffsets', () => {
  it('centres each card in the viewport, clamped to the strip', () => {
    const items = [{ width: CARD_WIDTH }, { width: 36 }, { width: NEXT_WIDTH }, { width: CARD_WIDTH }];
    const viewport = 390;
    const { padding, offsets, contentWidth } = carouselOffsets(items, viewport);
    expect(padding).toBe((viewport - NEXT_WIDTH) / 2);
    // The next card's centre lands in the middle of the viewport.
    const nextLeft = padding + CARD_WIDTH + GAP + 36 + GAP;
    expect(offsets[2]).toBe(Math.round(nextLeft + NEXT_WIDTH / 2 - viewport / 2));
    expect(offsets[0]).toBeGreaterThanOrEqual(0);
    expect(offsets.at(-1)).toBeLessThanOrEqual(contentWidth - viewport);
  });

  it('finds the card the strip settled on', () => {
    expect(nearestIndex([0, 100, 300], 120)).toBe(1);
    expect(nearestIndex([0, 100, 300], 260)).toBe(2);
  });
});

describe('countdown', () => {
  it('counts down on the day and names the day otherwise', () => {
    const today = '2026-10-07';
    expect(countdown({ occurs_on: today, start_time: '16:00' }, today, 15 * 60 + 15)).toBe('in 45 min');
    expect(countdown({ occurs_on: today, start_time: '16:00' }, today, 13 * 60 + 50)).toBe('in 2 hr 10 min');
    expect(countdown({ occurs_on: today, start_time: '16:00' }, today, 16 * 60 + 5)).toBe('Under way');
    expect(countdown({ occurs_on: '2026-10-08', start_time: '16:00' }, today, 600)).toBe(
      'Tomorrow at 4:00 PM',
    );
  });

  it('names a later day through the shared formatter (Phase 78): weekday, and the year only in another one', () => {
    const today = '2026-10-07';
    expect(countdown({ occurs_on: '2026-10-13', start_time: '16:00' }, today, 600)).toBe('Tue, Oct 13 at 4:00 PM');
    expect(countdown({ occurs_on: '2027-01-05', start_time: '09:30' }, today, 600)).toBe('Tue, Jan 5, 2027 at 9:30 AM');
  });
});
