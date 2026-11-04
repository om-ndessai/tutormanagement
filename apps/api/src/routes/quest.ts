import { Hono } from 'hono';
import {
  bankLevelOffered,
  hasRole,
  levelLabel,
  nextQuestLevel,
  questAnswerSchema,
  questLevelSchema,
  questReviewSchema,
  type ApiOk,
  type Organization,
  type QuestReviewQueue,
  type QuestState,
  type QuestStudent,
  type QuestSummary,
  type User,
  checkedQuestionsOn,
  tileWords,
  type CanvasAssessmentLevelId,
  type MemberTile,
  type MemberTilesResponse,
  CANVAS_ASSESSMENT_LEVEL_IDS,
  featureOn,
} from '@tmi/shared';

import { cachedDrawableCounts } from '../repositories/level-counts.js';
import { getPlay } from '../repositories/platform-settings.js';
import type { AppEnv } from '../types.js';
import type { OrgId } from '../lib/org.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { listOrganizationCurricula } from '../repositories/curricula.js';
import {
  applyQuestReview,
  getQuestAttempt,
  getQuestLevel,
  listQuestStudents,
  managesQuestStudent,
  nextQuestQuestion,
  nextQuestReview,
  questSummary,
  questTotals,
  questionKey,
  recordQuestAnswer,
  setQuestLevel,
} from '../repositories/quest.js';
import { questGameRoutes } from './quest-games.js';
import { habitRoutes } from './habit.js';
import { bestScores } from '../repositories/habit.js';

// Question Quest (Phase 42, docs/gamification-plan.md): signed-in students
// answer the bank's unapproved questions; their tutors approve or flag them;
// points for the attempt and for correctness. Behind the organization's
// `gamify_question_quest`.

function requireStudent(user: User): void {
  if (!hasRole(user, 'student')) throw new ApiError(403, 'forbidden', 'Question Quest is for students.');
}

function reviewerOf(user: User): { id: string; admin: boolean } {
  const admin = isAdmin(user);
  if (!admin && !hasRole(user, 'tutor')) {
    throw new ApiError(403, 'forbidden', 'Only tutors and admins review Question Quest answers.');
  }
  return { id: user.id, admin };
}

/**
 * The student's state now: their level, and the next question of it. When a
 * level has nothing left to serve, they move up to the next of its family by
 * themselves (owner, 2026-10-20), as far as the family goes.
 */
async function questState(db: D1Database, org: Organization, studentId: string): Promise<QuestState> {
  const orgId = org.id as OrgId;
  let level = await getQuestLevel(db, orgId, studentId);
  let question = level ? await nextQuestQuestion(db, orgId, studentId, level) : null;
  let movedUpFrom: string | null = null;
  let finished = false;
  while (level && !question) {
    const next = nextQuestLevel(level);
    if (!next) {
      finished = true;
      break;
    }
    movedUpFrom ??= level;
    level = next;
    await setQuestLevel(db, orgId, studentId, level);
    question = await nextQuestQuestion(db, orgId, studentId, level);
  }
  const totals = await questTotals(db, orgId, studentId);
  return {
    level_id: level,
    question,
    moved_up_from: movedUpFrom,
    finished,
    points: totals.points,
    answered: totals.answered,
  };
}

async function reviewQueue(db: D1Database, org: OrgId, reviewer: { id: string; admin: boolean }): Promise<QuestReviewQueue> {
  const [next, totals] = await Promise.all([nextQuestReview(db, org, reviewer), questTotals(db, org, reviewer.id)]);
  return { item: next.item, waiting: next.waiting, points: totals.points };
}

export const questRoutes = new Hono<AppEnv>()
  /**
   * Phase 62 (P5): the tiles a member here may start in one tap -- those shown to members, in the
   * curricula this space offers, at levels with at least the console's minimum of questions to play
   * (the platform's cached counts, P4). Any member, not students only.
   */
  .get('/tiles', async (c) => {
    const org = c.get('org');
    const { settings, tiles } = await getPlay(c.env.DB);
    const offered = await listOrganizationCurricula(c.env.DB, org.id);
    const live = new Set(offered.filter((cur) => !cur.retired).map((cur) => cur.id));
    const counts = new Map(
      (await cachedDrawableCounts(c.env.DB, checkedQuestionsOn(org), live)).map((level) => [level.level_id, level]),
    );
    // Phase 64 (P20): the reader's best of each single-player shape, for the tile of that shape.
    const bests = new Map(
      (await bestScores(c.env.DB, org.id, c.get('user').id)).map((b) => [
        `${b.level_id}|${b.mode}|${b.question_count ?? ''}|${b.duration_seconds ?? ''}`,
        b.best,
      ]),
    );
    const selfAssess = org.personal && featureOn(org, 'assessment');
    const shown: MemberTile[] = tiles.flatMap((tile) => {
      const count = counts.get(tile.level_id as CanvasAssessmentLevelId);
      // Phase 67 (H7): "Show your work" reaches a personal space, where it is for oneself -- the tiles the
      // guest page shows carry over to the newcomer, whatever the members' flag (which is for quests).
      const selfTile =
        tile.kind === 'assessment' &&
        selfAssess &&
        (tile.members || tile.guest !== 'hidden') &&
        (CANVAS_ASSESSMENT_LEVEL_IDS as readonly string[]).includes(tile.level_id);
      const forMembers = (tile.kind === 'quest' && tile.members) || selfTile;
      if (!forMembers || !count || count.available < settings.min_depth) return [];
      const shape = `${tile.level_id}|${tile.mode}|${tile.mode === 'count' ? tile.value : ''}|${tile.mode === 'timed' ? tile.value * 60 : ''}`;
      return [{ ...tile, words: tileWords(tile), available: count.available, beta: count.unreviewed > 0, best: bests.get(shape) ?? null }];
    });
    const body: ApiOk<MemberTilesResponse> = { data: { play_home: settings.play_home, daily: settings.daily, tiles: shown } };
    return c.json(body);
  })

  // Phase 46: Quest Games, for every member (docs/quest-games-plan.md).
  .route('/games', questGameRoutes)

  // Phase 64: the reader's streak and badges, and the Daily set.
  .route('/', habitRoutes)

  // The student's Quest: their level, the next question, their points.
  .get('/me', async (c) => {
    const user = c.get('user');
    requireStudent(user);
    const body: ApiOk<QuestState> = { data: await questState(c.env.DB, c.get('org'), user.id) };
    return c.json(body);
  })

  // The numbers for the welcome popup, read once when Quest opens (owner, 2026-10-21).
  .get('/me/summary', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    requireStudent(user);
    const levelId = await getQuestLevel(c.env.DB, org.id as OrgId, user.id);
    const body: ApiOk<QuestSummary> = {
      data: await questSummary(c.env.DB, org.id as OrgId, { studentId: user.id, levelId, timeZone: org.time_zone }),
    };
    return c.json(body);
  })

  // One answer, to the question being shown: no going back, no skipping ahead.
  .post('/answers', zValidator('json', questAnswerSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    requireStudent(user);
    const input = c.req.valid('json');
    const state = await questState(c.env.DB, org, user.id);
    if (!state.question || state.question.id !== input.question_id || !state.level_id) {
      throw ApiError.conflict('That question is no longer the one to answer.');
    }
    const key = await questionKey(c.env.DB, input.question_id);
    if (!key || key.status !== 'checked') throw ApiError.conflict('That question is no longer the one to answer.');
    try {
      await recordQuestAnswer(c.env.DB, org.id as OrgId, {
        studentId: user.id,
        question: key,
        levelId: state.level_id,
        answer: input.answer,
        timeZone: org.time_zone,
      });
    } catch {
      // The unique key: a second submit of the same answer.
      throw ApiError.conflict('That question has already been answered.');
    }
    const body: ApiOk<QuestState> = { data: await questState(c.env.DB, org, user.id) };
    return c.json(body);
  })

  // The reviewer's queue: the oldest answer waiting, how many wait, their points.
  .get('/review', async (c) => {
    const reviewer = reviewerOf(c.get('user'));
    const body: ApiOk<QuestReviewQueue> = { data: await reviewQueue(c.env.DB, c.get('org').id as OrgId, reviewer) };
    return c.json(body);
  })

  .post('/review/:attemptId', zValidator('json', questReviewSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const reviewer = reviewerOf(user);
    const input = c.req.valid('json');
    const orgId = org.id as OrgId;

    // An answer outside the reviewer's students is missing, not forbidden.
    const attempt = await getQuestAttempt(c.env.DB, orgId, reviewer, c.req.param('attemptId'));
    if (!attempt) throw ApiError.notFound('That answer was not found.');
    if (attempt.reviewed) throw ApiError.conflict('That answer has already been reviewed.');

    const applied = await applyQuestReview(c.env.DB, orgId, {
      attempt,
      reviewerId: user.id,
      reviewerName: user.full_name,
      decision: input.decision,
      note: input.note?.length ? input.note : null,
      timeZone: org.time_zone,
      trusted: org.quest_trusted,
    });
    if (!applied) throw ApiError.conflict('That answer has already been reviewed.');

    // Names the person and the level, never the reason for a flag or the answer.
    await recordAudit(c.env.DB, user, orgId, {
      action: input.decision === 'approve' ? 'quest.question_approved' : 'quest.question_flagged',
      description: `${input.decision === 'approve' ? (org.quest_trusted ? 'Approved' : 'Suggested approving') : 'Flagged'} a ${levelLabel(attempt.question.level_id)} question ${attempt.student_name} answered in Question Quest`,
      entity_type: 'user',
      entity_id: attempt.student_user_id,
    });

    const body: ApiOk<QuestReviewQueue> = { data: await reviewQueue(c.env.DB, orgId, reviewer) };
    return c.json(body);
  })

  // The students a reviewer manages, with their level, counts and points.
  .get('/students', async (c) => {
    const reviewer = reviewerOf(c.get('user'));
    const body: ApiOk<QuestStudent[]> = {
      data: await listQuestStudents(c.env.DB, c.get('org').id as OrgId, reviewer),
    };
    return c.json(body);
  })

  .put('/students/:studentId/level', zValidator('json', questLevelSchema), async (c) => {
    const user = c.get('user');
    const reviewer = reviewerOf(user);
    const orgId = c.get('org').id as OrgId;
    const studentId = c.req.param('studentId');
    if (!(await managesQuestStudent(c.env.DB, orgId, reviewer, studentId))) {
      throw ApiError.notFound('That student was not found.');
    }
    const { level_id: levelId } = c.req.valid('json');
    // A level is offered only where its curriculum is (Beast Academy's, NC 2017's), as in the
    // Assessment menu and Quest Games.
    if (levelId) {
      const live = (await listOrganizationCurricula(c.env.DB, orgId)).filter((cur) => !cur.retired).map((cur) => cur.id);
      if (!bankLevelOffered(levelId, new Set(live))) {
        throw ApiError.validation('That level is not offered here.', {
          level_id: ['A level needs its curriculum on the space’s curriculum list.'],
        });
      }
    }
    await setQuestLevel(c.env.DB, orgId, studentId, levelId);
    const student = (await listQuestStudents(c.env.DB, orgId, reviewer)).find((s) => s.user_id === studentId);
    await recordAudit(c.env.DB, user, orgId, {
      action: 'quest.level_set',
      description: levelId
        ? `Set ${student?.full_name ?? 'a student'}'s Question Quest level to ${levelLabel(levelId)}`
        : `Cleared ${student?.full_name ?? 'a student'}'s Question Quest level`,
      entity_type: 'user',
      entity_id: studentId,
    });
    const body: ApiOk<QuestStudent | null> = { data: student ?? null };
    return c.json(body);
  });
