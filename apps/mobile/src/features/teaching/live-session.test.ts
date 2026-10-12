import { liveTimes, stopToast, bannerBottom, TAB_BAR_ABOVE_INSET, BANNER_GAP } from './live-session';

describe('the live lesson', () => {
  it('says "from" and "ends by" on the organization clock, not UTC or the device', () => {
    // 18:10 UTC is 2:10 PM in New York (EDT) and 11:10 AM in Los Angeles.
    const active = { rounded_start: '12:45', auto_stop_at: '2026-10-08T18:10:00.000Z' };
    expect(liveTimes(active, 'America/New_York')).toEqual({ from: '12:45 PM', endsBy: '2:10 PM' });
    expect(liveTimes(active, 'America/Los_Angeles').endsBy).toBe('11:10 AM');
  });

  it('stops with the times and the length, never the money', () => {
    const recorded = {
      started_at: '16:00',
      ended_at: '16:45',
      duration_minutes: 45,
      tutor_amount_cents: 4875,
      charge_amount_cents: 6750,
    };
    const text = stopToast(recorded);
    expect(text).toBe('Session recorded: 4:00 PM–4:45 PM, 45 min.');
    expect(text).not.toMatch(/\$/);
  });

  it('floats above the tab bar on a tab, and above the home indicator elsewhere', () => {
    expect(bannerBottom('ios', 34, true)).toBe(34 + TAB_BAR_ABOVE_INSET.ios + BANNER_GAP);
    expect(bannerBottom('android', 24, true)).toBe(24 + TAB_BAR_ABOVE_INSET.android + BANNER_GAP);
    expect(bannerBottom('ios', 34, false)).toBe(34 + BANNER_GAP);
  });
});
