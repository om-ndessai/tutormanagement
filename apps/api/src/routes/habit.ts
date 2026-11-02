import { Hono } from 'hono';
import {
  BADGES,
  QUESTION_BANK_LEVEL_IDS,
  bankLevelOffered,
  bestWeeklyStreak,
  checkAnswer,
  checkedQuestionsOn,
  dailyNumber,
  dailyResultSchema,
  earnedBadges,
  weeklyStreak,
  zonedClockParts,
  type ApiOk,
  type DailySet,
  type HabitSummary,
  type QuestionBankLevelId,
} from '@tmi/shared';

import { ApiError } from '../lib/errors.js';
import type { OrgId } from '../lib/org.js';
import { zValidator } from '../lib/validate.js';
import { listOrganizationCurricula } from '../repositories/curricula.js';
import { getPlay } from '../repositories/platform-settings.js';
import { dailyQuestions, dailyResult, habitDays, habitFacts, saveDailyResult } from '../repositories/habit.js';
import type { AppEnv } from '../types.js';

/**
 * Phase 64 (P17-P19, docs/stickiness-plan.md): the reader's own streak and badges, and the Daily set.
 * Mounted under Quest's routes, so Quest's switch governs it. Every read is the reader's own: no route
 * here takes a person.
 */

function todayIn(timeZone: string): string {
  return zonedClockParts(new Date().toISOString(), timeZone).day;
}

/** A Daily's level: one of the bank's, offered by this space; else 404, as for a row elsewhere. The Daily
 *  set is the console's switch (Settings > Play): off, it answers 403 `feature_unavailable`. */
async function dailyLevel(db: D1Database, org: OrgId, raw: string): Promise<QuestionBankLevelId> {
  if (!(await getPlay(db)).settings.daily) throw new ApiError(403, 'feature_unavailable', 'The Daily set is not available just now.');
  if (!(QUESTION_BANK_LEVEL_IDS as readonly string[]).includes(raw)) throw new ApiError(404, 'not_found', 'There is no Daily for that level.');
  const offered = await listOrganizationCurricula(db, org);
  const live = new Set(offered.filter((cur) => !cur.retired).map((cur) => cur.id));
  if (!bankLevelOffered(raw, live)) throw new ApiError(404, 'not_found', 'There is no Daily for that level.');
  return raw as QuestionBankLevelId;
}

export const habitRoutes = new Hono<AppEnv>()
  .get('/me/habit', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const today = todayIn(org.time_zone);
    const [days, facts] = await Promise.all([habitDays(c.env.DB, org.id, user.id, today), habitFacts(c.env.DB, org.id, user.id)]);
    const streak = weeklyStreak(days, today);
    const earned = new Set(earnedBadges({ ...facts, best_weeks: Math.max(bestWeeklyStreak(days), streak.weeks) }));
    const body: ApiOk<HabitSummary> = {
      data: {
        streak_weeks: streak.weeks,
        days_this_week: streak.days_this_week,
        played_today: streak.played_today,
        badges: BADGES.map((badge) => ({ ...badge, earned: earned.has(badge.id) })),
      },
    };
    return c.json(body);
  })

  // Today's Daily of a level: its questions without keys, or -- once played -- with them and the result.
  .get('/daily/:level', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const level = await dailyLevel(c.env.DB, org.id, c.req.param('level'));
    const day = todayIn(org.time_zone);
    const questions = await dailyQuestions(c.env.DB, day, level, checkedQuestionsOn(org));
    const result = await dailyResult(c.env.DB, org.id, user.id, day, level);
    const body: ApiOk<DailySet> = { data: dailySet(day, level, questions, result) };
    return c.json(body);
  })

  // The answers, once, at the end: marked here by code, kept as marks (never the answers), keys returned.
  .post('/daily/:level/result', zValidator('json', dailyResultSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const level = await dailyLevel(c.env.DB, org.id, c.req.param('level'));
    const input = c.req.valid('json');
    const day = todayIn(org.time_zone);
    if (input.day !== day) throw new ApiError(409, 'conflict', 'That Daily is over: a new one is ready.');
    const questions = await dailyQuestions(c.env.DB, day, level, checkedQuestionsOn(org));
    if (input.answers.length !== questions.length) {
      throw new ApiError(400, 'validation_failed', 'Answer or skip every question of the Daily.');
    }
    const marks = questions.map((q, i) => {
      const given = input.answers[i];
      return given !== null && given !== undefined && checkAnswer({ kind: q.kind, answer: q.answer }, given);
    });
    const saved = await saveDailyResult(c.env.DB, org.id, { userId: user.id, day, levelId: level, marks, seconds: input.seconds });
    if (!saved) throw new ApiError(409, 'conflict', 'You have played today’s Daily. A new one tomorrow.');
    const body: ApiOk<DailySet> = {
      data: dailySet(day, level, questions, { right: marks.filter(Boolean).length, of: marks.length, seconds: input.seconds, marks }),
    };
    return c.json(body);
  });

function dailySet(
  day: string,
  level: QuestionBankLevelId,
  questions: Awaited<ReturnType<typeof dailyQuestions>>,
  result: DailySet['result'],
): DailySet {
  return {
    day,
    number: dailyNumber(day),
    level_id: level,
    // R20: keys and solutions only after the reader has played it.
    questions: questions.map(({ answer, solution, ...rest }) => (result ? { ...rest, answer, solution } : rest)),
    result,
  };
}
