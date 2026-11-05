import { z } from 'zod';

import type { QuestionBankLevelId } from './questions.js';

// ---------------------------------------------------------------------------
// The habit layer (Phase 64, P17-P20 in docs/stickiness-plan.md)
// ---------------------------------------------------------------------------
// A weekly streak (kinder to children than a daily one), badges, the Daily set, and beating your best.
// Everything here is derived from rows the platform already keeps -- the day rollup (`activity_days`),
// finished games, the Daily results -- never stored as a running total.

/** Days played in a week for that week to count toward the streak. */
export const STREAK_DAYS_PER_WEEK = 3;

/** Monday of the week a YYYY-MM-DD falls in, as YYYY-MM-DD (weeks start on Monday). */
export function weekOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function previousWeek(monday: string): string {
  const date = new Date(`${monday}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/**
 * The weekly streak (P17): consecutive weeks with at least STREAK_DAYS_PER_WEEK days played, counted
 * back from this week -- this week counts once it has its days, and an unfinished week does not break
 * the streak. `days` are the YYYY-MM-DD days played, `today` the space's today.
 */
export function weeklyStreak(days: readonly string[], today: string): { weeks: number; days_this_week: number; played_today: boolean } {
  const perWeek = new Map<string, number>();
  for (const day of new Set(days)) perWeek.set(weekOf(day), (perWeek.get(weekOf(day)) ?? 0) + 1);
  const thisWeek = weekOf(today);
  const daysThisWeek = perWeek.get(thisWeek) ?? 0;
  let weeks = daysThisWeek >= STREAK_DAYS_PER_WEEK ? 1 : 0;
  let week = previousWeek(thisWeek);
  while ((perWeek.get(week) ?? 0) >= STREAK_DAYS_PER_WEEK) {
    weeks += 1;
    week = previousWeek(week);
  }
  return { weeks, days_this_week: daysThisWeek, played_today: days.includes(today) };
}

/** The badges (P18), in the order shown. */
export const BADGES = [
  { id: 'first_quest', label: 'First quest', description: 'Finished a quest.' },
  { id: 'quests_10', label: '10 quests', description: 'Finished 10 quests.' },
  { id: 'quests_50', label: '50 quests', description: 'Finished 50 quests.' },
  { id: 'quests_100', label: '100 quests', description: 'Finished 100 quests.' },
  { id: 'first_family_game', label: 'Family game', description: 'Played a game someone invited you to, or invited others.' },
  { id: 'daily_7', label: 'Seven Dailies', description: 'Played the Daily set on 7 days.' },
  { id: 'weeks_4', label: '4 weeks in a row', description: 'Played 3 days a week for 4 weeks running.' },
  { id: 'weeks_12', label: '12 weeks in a row', description: 'Played 3 days a week for 12 weeks running.' },
] as const;
export type BadgeId = (typeof BADGES)[number]['id'];

export interface HabitFacts {
  quests_finished: number;
  family_games: number;
  dailies: number;
  /** The longest weekly streak reached (a badge, once earned, stays). */
  best_weeks: number;
}

/** The badges earned, from counts the platform keeps anyway. */
export function earnedBadges(facts: HabitFacts): BadgeId[] {
  const earned: BadgeId[] = [];
  if (facts.quests_finished >= 1) earned.push('first_quest');
  if (facts.quests_finished >= 10) earned.push('quests_10');
  if (facts.quests_finished >= 50) earned.push('quests_50');
  if (facts.quests_finished >= 100) earned.push('quests_100');
  if (facts.family_games >= 1) earned.push('first_family_game');
  if (facts.dailies >= 7) earned.push('daily_7');
  if (facts.best_weeks >= 4) earned.push('weeks_4');
  if (facts.best_weeks >= 12) earned.push('weeks_12');
  return earned;
}

/** The longest run of qualifying weeks in a history of days played. */
export function bestWeeklyStreak(days: readonly string[]): number {
  const perWeek = new Map<string, number>();
  for (const day of new Set(days)) perWeek.set(weekOf(day), (perWeek.get(weekOf(day)) ?? 0) + 1);
  const qualifying = [...perWeek.entries()].filter(([, n]) => n >= STREAK_DAYS_PER_WEEK).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const week of qualifying) {
    run = last !== null && previousWeek(week) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = week;
  }
  return best;
}

/** "My progress" (P17-P18), the reader's own. */
export interface HabitSummary {
  streak_weeks: number;
  days_this_week: number;
  played_today: boolean;
  badges: { id: BadgeId; label: string; description: string; earned: boolean }[];
  /** Phase 67 (H8): this week, Monday first. Absent from an older Worker. */
  week?: WeekDot[];
  /** Phase 67 (H8): back after a week or more away; say welcome, never what was lost. */
  welcome_back?: boolean;
  /** Phase 67 (H8): the next badge within reach, with how far along. Null once all are earned. */
  next_badge?: NextBadge | null;
  /** Phase 74 (JF6): whether they have played here on any day; a newcomer's band offers doors, never a zero. */
  played_before?: boolean;
}

// --- Phase 67 (H8): the habit, made visible and kind -------------------------

/** One day of the week strip: played, not played (past), today (not yet played) or still to come. */
export type WeekDot = 'played' | 'missed' | 'today' | 'ahead';

/** This week's seven days, Monday first, from the days played. Today shows played once it is. */
export function weekDots(days: readonly string[], today: string): WeekDot[] {
  const played = new Set(days);
  const monday = new Date(`${weekOf(today)}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    const day = date.toISOString().slice(0, 10);
    if (played.has(day)) return 'played';
    if (day === today) return 'today';
    return day < today ? 'missed' : 'ahead';
  });
}

/** How many days away counts as "back" (a full week). */
export const WELCOME_BACK_DAYS = 7;

/**
 * Back after time away (H8): played before, but not in the WELCOME_BACK_DAYS before today, and not yet
 * today. A fresh start, said kindly: the home never says what was lost.
 */
export function welcomeBack(days: readonly string[], today: string): boolean {
  if (days.includes(today)) return false;
  const before = days.filter((day) => day < today).sort();
  const last = before[before.length - 1];
  if (!last) return false;
  const gap = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${last}T12:00:00Z`)) / 86_400_000);
  return gap > WELCOME_BACK_DAYS;
}

export interface NextBadge {
  id: BadgeId;
  label: string;
  description: string;
  /** How far along, out of `need`. */
  have: number;
  need: number;
}

/** What each badge counts, and how many it needs. */
const BADGE_GOALS: Record<BadgeId, { fact: keyof HabitFacts; need: number }> = {
  first_quest: { fact: 'quests_finished', need: 1 },
  quests_10: { fact: 'quests_finished', need: 10 },
  quests_50: { fact: 'quests_finished', need: 50 },
  quests_100: { fact: 'quests_finished', need: 100 },
  first_family_game: { fact: 'family_games', need: 1 },
  daily_7: { fact: 'dailies', need: 7 },
  weeks_4: { fact: 'best_weeks', need: 4 },
  weeks_12: { fact: 'best_weeks', need: 12 },
};

/** The next milestone (H8): of the badges not yet earned, the one closest to done, as a share of its goal. */
export function nextBadge(facts: HabitFacts): NextBadge | null {
  const earned = new Set(earnedBadges(facts));
  let best: NextBadge | null = null;
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue;
    const goal = BADGE_GOALS[badge.id];
    const have = Math.min(facts[goal.fact], goal.need);
    const candidate = { id: badge.id, label: badge.label, description: badge.description, have, need: goal.need };
    if (!best || have / goal.need > best.have / best.need) best = candidate;
  }
  return best;
}

// --- The Daily set (P19) ---------------------------------------------------

/** How many questions a Daily set holds. */
export const DAILY_SET_SIZE = 5;

/** The members' Daily is called this everywhere -- Next up, the board, the Daily's page (owner, 2026-11-05; JF23). */
export const DAILY_NAME = "Today's Daily";

/** The Daily's number: days since the first Daily (2026-11-01 is #1). */
export function dailyNumber(day: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse('2026-10-31T12:00:00Z')) / 86_400_000);
}

/** A small, stable hash of a day and level: the same five questions for everyone that day. */
export function dailySeed(day: string, levelId: string): number {
  let hash = 2166136261;
  for (const ch of `${day}|${levelId}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** One Daily question. Its key and solution come only once the reader has played it (R20). */
export interface DailyQuestion {
  id: string;
  kind: 'choice' | 'numeric';
  stem: string;
  choices: string[];
  answer?: string;
  solution?: string;
  beta: boolean;
}

/** A Daily's answers, sent once at the end, in order; null is a skip. The server marks them. */
export const dailyResultSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A day is YYYY-MM-DD.'),
  answers: z.array(z.string().trim().max(120, 'That answer is too long.').nullable()).min(1).max(DAILY_SET_SIZE),
  seconds: z.number().int().min(0).max(86_400),
});
export type DailyResultInput = z.infer<typeof dailyResultSchema>;

export interface DailySet {
  day: string;
  number: number;
  level_id: QuestionBankLevelId;
  questions: DailyQuestion[];
  /** The reader's result today, if they have played it (one play a day). */
  result: { right: number; of: number; seconds: number; marks: boolean[] } | null;
}

/** The share grid (P19): "Aimtrue G4D #42 ✓✓✗✓✓ 4/5 · 2:13". Names nobody. */
export function dailyShareText(tag: string, number: number, marks: readonly boolean[], seconds: number): string {
  const right = marks.filter(Boolean).length;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return `Aimtrue ${tag}D #${number} ${marks.map((m) => (m ? '✓' : '✗')).join('')} ${right}/${marks.length} · ${time}`;
}
