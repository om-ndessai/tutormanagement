import { z } from 'zod';

import { addDays } from './schedules.js';
import { weekOf } from './habit.js';
import { PRIVACY_VERSION } from './legal.js';

// ---------------------------------------------------------------------------
// Stickiness, measured (Phase 69, docs/member-home-plan.md H12, R30)
// ---------------------------------------------------------------------------
// `visit_days` holds one row per person, space and day they opened it: the day on the space's clock and the
// first client that day, nothing else. A daily rollup turns it -- with `activity_days`, the days played,
// kept anyway -- into totals for the console's Stickiness page; nobody reads a person's rows. Groups under
// STICKINESS_MIN_GROUP people are suppressed. Recording is the console's switch, and the server refuses to
// switch it on until the published privacy notice says visits are kept (VISITS_PRIVACY_VERSION).

/** The first privacy version that tells people their visit days are kept. */
export const VISITS_PRIVACY_VERSION = '2026-11-04';

/** Whether the published privacy notice covers recording visits. */
export function visitsMayRecord(privacyVersion: string = PRIVACY_VERSION): boolean {
  return privacyVersion >= VISITS_PRIVACY_VERSION;
}

/** How long a visit row is kept: long enough for week-8 retention of a 4-week cohort window. */
export const VISIT_KEEP_DAYS = 120;
/** A group smaller than this is not shown. */
export const STICKINESS_MIN_GROUP = 5;
/** The days a week someone must come for the weekly rhythm (the streak's 3). */
export const RHYTHM_DAYS = 3;
/** How many completed weeks the rollup reads. */
export const STICKINESS_WEEKS = 13;
/** The retention weeks shown. */
export const RETENTION_WEEKS = [1, 4, 8] as const;

export const VISIT_CLIENTS = ['web', 'app'] as const;
export type VisitClient = (typeof VISIT_CLIENTS)[number];

/** The console's switch (platform_settings 'visits'). No row: off. */
export const visitSettingsSchema = z.object({ record: z.boolean() });
export type VisitSettings = z.infer<typeof visitSettingsSchema>;
export const DEFAULT_VISIT_SETTINGS: VisitSettings = { record: false };

/** What the console reads about the switch. */
export interface VisitSettingsResponse {
  settings: VisitSettings;
  /** False while the published privacy notice does not yet cover visits: switching on is refused. */
  may_record: boolean;
  privacy_version: string;
  needs_privacy_version: string;
}

/** The kinds of space, for grouping. */
export const SPACE_KINDS = ['tutoring', 'practice', 'personal'] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];

/** The hat a person mainly wears in a space, for grouping. */
export const STICKY_HATS = ['tutor', 'office', 'parent', 'learner'] as const;
export type StickyHat = (typeof STICKY_HATS)[number];

/** How someone came: a platform account's arrival, 'invited' (a space added them), or 'unknown'. */
export const STICKY_ARRIVALS = ['guest_quest', 'guest_assessment', 'direct', 'invited', 'unknown'] as const;
export type StickyArrival = (typeof STICKY_ARRIVALS)[number];

export const STICKY_HAT_LABELS: Record<StickyHat, string> = {
  tutor: 'Tutors',
  office: 'Admins',
  parent: 'Parents',
  learner: 'Learners',
};
export const SPACE_KIND_LABELS: Record<SpaceKind, string> = {
  tutoring: 'Tutoring spaces',
  practice: 'Practice spaces',
  personal: 'Personal spaces',
};
export const STICKY_ARRIVAL_LABELS: Record<StickyArrival, string> = {
  guest_quest: 'From a guest quest',
  guest_assessment: 'From the guest assessment',
  direct: 'Signed up directly',
  invited: 'Added by a space',
  unknown: 'Signed up (before Phase 68)',
};

/** One person in one space, with the days they came (a visit or a day played). The rollup's unit. */
export interface StickyUnit {
  user_id: string;
  hat: StickyHat;
  space_kind: SpaceKind;
  arrival: StickyArrival;
  days: string[];
  /** Days with a Daily played. */
  daily_days: string[];
}

/** A share: how many of how many, or null when the base is under STICKINESS_MIN_GROUP. */
export interface StickyShare {
  base: number;
  count: number;
  /** count / base, or null while suppressed. */
  share: number | null;
}

export interface RetentionRow {
  hat: StickyHat | 'all';
  space_kind: SpaceKind | 'all';
  arrival: StickyArrival | 'all';
  /** People whose first day falls in the cohort window. */
  cohort: number;
  /** Week 1, 4 and 8: of those old enough, how many came that week. Null when suppressed. */
  weeks: Record<'1' | '4' | '8', StickyShare>;
}

/** The console's Stickiness page: totals only. */
export interface StickinessReport {
  computed_at: string;
  /** The day the figures run to (UTC). */
  day: string;
  /** Whether visits were being recorded; while off, only days played count. */
  recording: boolean;
  /** People active (any space) in the last 7 and 28 days, and the ratio. */
  weekly_active: number;
  monthly_active: number;
  wau_over_mau: number | null;
  /** Last completed week: people by days active, index 1-7 (0 unused). Null when under the minimum. */
  days_per_week: number[] | null;
  /** Of those with RHYTHM_DAYS+ days two weeks ago, how many again last week. */
  rhythm_kept: StickyShare;
  /** Of units who missed a whole week after an active one, how many came back the week after. */
  return_after_miss: StickyShare;
  /** Learner days with the Daily played, last 7 days. */
  daily_completion: StickyShare;
  /** Weekly active people, oldest first, the last STICKINESS_WEEKS weeks; -1 for a week under the minimum. */
  weekly: { week: string; active: number }[];
  /** All, then by hat, by space kind, by arrival, then each combination of the three. */
  retention: RetentionRow[];
}

function share(count: number, base: number): StickyShare {
  return { base, count, share: base >= STICKINESS_MIN_GROUP ? count / base : null };
}

function weekAdd(monday: string, weeks: number): string {
  return addDays(monday, weeks * 7);
}

/**
 * The figures, from the units the rollup read. Pure: the Worker reads, this counts. `today` is the
 * day the figures run to; the last completed week is the one before today's.
 */
export function computeStickiness(units: readonly StickyUnit[], today: string, recording: boolean, now = new Date().toISOString()): StickinessReport {
  const thisWeek = weekOf(today);
  const lastWeek = weekAdd(thisWeek, -1);
  const twoWeeksAgo = weekAdd(thisWeek, -2);

  // People across spaces: their days together.
  const byPerson = new Map<string, Set<string>>();
  for (const unit of units) {
    const days = byPerson.get(unit.user_id) ?? new Set<string>();
    for (const day of unit.days) days.add(day);
    byPerson.set(unit.user_id, days);
  }
  const activeSince = (since: string) => [...byPerson.values()].filter((days) => [...days].some((d) => d > since && d <= today)).length;
  const weeklyActive = activeSince(addDays(today, -7));
  const monthlyActive = activeSince(addDays(today, -28));

  const daysIn = (days: Iterable<string>, monday: string) => {
    const end = weekAdd(monday, 1);
    let n = 0;
    for (const d of days) if (d >= monday && d < end) n += 1;
    return n;
  };

  const histogram = Array.from({ length: 8 }, () => 0);
  let lastWeekPeople = 0;
  let rhythmBase = 0;
  let rhythmKept = 0;
  for (const days of byPerson.values()) {
    const last = daysIn(days, lastWeek);
    if (last > 0) {
      histogram[Math.min(last, 7)]! += 1;
      lastWeekPeople += 1;
    }
    if (daysIn(days, twoWeeksAgo) >= RHYTHM_DAYS) {
      rhythmBase += 1;
      if (last >= RHYTHM_DAYS) rhythmKept += 1;
    }
  }

  // Back after a missed week: an active week, then a week with nothing, then (the week after) back.
  let missed = 0;
  let returned = 0;
  for (const unit of units) {
    for (let k = STICKINESS_WEEKS; k >= 3; k -= 1) {
      const active = weekAdd(thisWeek, -k);
      if (daysIn(unit.days, active) > 0 && daysIn(unit.days, weekAdd(active, 1)) === 0) {
        missed += 1;
        if (daysIn(unit.days, weekAdd(active, 2)) > 0) returned += 1;
      }
    }
  }

  // The Daily: learner days in the last 7 with the Daily played.
  let learnerDays = 0;
  let dailyDays = 0;
  const since7 = addDays(today, -7);
  for (const unit of units) {
    if (unit.hat !== 'learner') continue;
    const recent = unit.days.filter((d) => d > since7 && d <= today);
    learnerDays += recent.length;
    dailyDays += unit.daily_days.filter((d) => d > since7 && d <= today).length;
  }

  const weekly = Array.from({ length: STICKINESS_WEEKS }, (_, i) => {
    const week = weekAdd(thisWeek, i - STICKINESS_WEEKS);
    return { week, active: [...byPerson.values()].filter((days) => daysIn(days, week) > 0).length };
  });

  // Retention: a unit's cohort is the week of its first day; week k is "came in week first + k", counted
  // only for cohorts whose week k has ended.
  const retentionFor = (members: readonly StickyUnit[]): Omit<RetentionRow, 'hat' | 'space_kind' | 'arrival'> => {
    const counts = { '1': { base: 0, count: 0 }, '4': { base: 0, count: 0 }, '8': { base: 0, count: 0 } };
    let cohort = 0;
    for (const unit of members) {
      const first = [...unit.days].sort()[0];
      if (!first) continue;
      const start = weekOf(first);
      if (start < weekAdd(thisWeek, -STICKINESS_WEEKS)) continue;
      cohort += 1;
      for (const k of RETENTION_WEEKS) {
        const week = weekAdd(start, k);
        if (week >= thisWeek) continue;
        const key = String(k) as '1' | '4' | '8';
        counts[key].base += 1;
        if (daysIn(unit.days, week) > 0) counts[key].count += 1;
      }
    }
    return {
      cohort,
      weeks: {
        '1': share(counts['1'].count, counts['1'].base),
        '4': share(counts['4'].count, counts['4'].base),
        '8': share(counts['8'].count, counts['8'].base),
      },
    };
  };
  const retention: RetentionRow[] = [{ hat: 'all', space_kind: 'all', arrival: 'all', ...retentionFor(units) }];
  for (const hat of STICKY_HATS) retention.push({ hat, space_kind: 'all', arrival: 'all', ...retentionFor(units.filter((u) => u.hat === hat)) });
  for (const kind of SPACE_KINDS) retention.push({ hat: 'all', space_kind: kind, arrival: 'all', ...retentionFor(units.filter((u) => u.space_kind === kind)) });
  for (const arrival of STICKY_ARRIVALS) retention.push({ hat: 'all', space_kind: 'all', arrival, ...retentionFor(units.filter((u) => u.arrival === arrival)) });
  for (const hat of STICKY_HATS) {
    for (const kind of SPACE_KINDS) {
      for (const arrival of STICKY_ARRIVALS) {
        const members = units.filter((u) => u.hat === hat && u.space_kind === kind && u.arrival === arrival);
        if (members.length >= STICKINESS_MIN_GROUP) retention.push({ hat, space_kind: kind, arrival, ...retentionFor(members) });
      }
    }
  }
  // A row's cohort under the minimum says only that it is small.
  for (const row of retention) if (row.cohort < STICKINESS_MIN_GROUP) row.cohort = 0;

  return {
    computed_at: now,
    day: today,
    recording,
    weekly_active: weeklyActive,
    monthly_active: monthlyActive,
    wau_over_mau: monthlyActive >= STICKINESS_MIN_GROUP ? weeklyActive / monthlyActive : null,
    days_per_week: lastWeekPeople >= STICKINESS_MIN_GROUP ? histogram : null,
    rhythm_kept: share(rhythmKept, rhythmBase),
    return_after_miss: share(returned, missed),
    daily_completion: share(dailyDays, learnerDays),
    weekly: weekly.map((w) => ({ week: w.week, active: w.active >= STICKINESS_MIN_GROUP || w.active === 0 ? w.active : -1 })),
    retention,
  };
}
