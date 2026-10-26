import { Hono } from 'hono';
import { z } from 'zod';
import {
  checkAnswer,
  challengeAnswerSchema,
  createShareSchema,
  type ApiOk,
  type ChallengeResult,
  type PublicShare,
  type Share,
  type ShareCard,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { clientAddress, rateLimit } from '../lib/rate-limit.js';
import { assertHuman } from '../lib/turnstile.js';
import { zValidator } from '../lib/validate.js';
import { getPlatformAccount } from '../repositories/people.js';
import {
  challengeCard,
  challengeQuestion,
  createShare,
  gameResultCard,
  levelFinishedCard,
  listMyShares,
  readPublicShare,
  withdrawShare,
} from '../repositories/shares.js';

const idSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9]{8,32}$/, 'Not a share.') });

const DESCRIBE: Record<ShareCard['kind'], string> = {
  game_result: 'a Quest game result',
  level_finished: 'a Quest level finished',
  challenge: 'a Quest question to solve',
};

/**
 * Phase 56 (docs/sharing-plan.md, R22): the signed-in half -- making,
 * listing and withdrawing one's own shares. Mounted inside the organization,
 * behind Quest's feature set.
 */
export const sharesRoutes = new Hono<AppEnv>()

  .get('/', async (c) => {
    const body: ApiOk<Share[]> = { data: await listMyShares(c.env.DB, c.get('org').id, c.get('user').id) };
    return c.json(body);
  })

  .post('/', zValidator('json', createShareSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    await rateLimit(c, 'share_create', user.id);
    const input = c.req.valid('json');

    // Who may share: 13 or over. Someone who signed themselves up is (Phase 52 keeps nobody
    // younger); a student a space added is a child unless they did, so their result is not shared.
    const account = await getPlatformAccount(c.env.DB, user.id);
    const adult = account ? account.age_band === 'adult' : !user.roles.includes('student');
    if (!account && user.roles.includes('student')) {
      throw new ApiError(403, 'forbidden', 'Ask a parent if you would like to share this.');
    }

    const card =
      input.kind === 'game_result'
        ? await gameResultCard(c.env.DB, org.id, user.id, input.game_id)
        : input.kind === 'challenge'
          ? await challengeCard(c.env.DB, org.id, user.id, input.game_id, input.question_id)
          : await levelFinishedCard(c.env.DB, org.id, user.id, input.level_id);
    if (!card) throw ApiError.notFound('There is nothing of yours to share there.');

    // An adult may show their first name, chosen now; nobody else is ever named.
    const firstName = adult && input.show_first_name ? (user.full_name.trim().split(/\s+/)[0] ?? null) : null;
    const share = await createShare(c.env.DB, org.id, user.id, card, firstName);

    await recordAudit(c.env.DB, user, org.id, {
      action: 'share.created',
      description: `${user.full_name} shared ${DESCRIBE[card.kind]}`,
      entity_type: 'share',
      entity_id: share.id,
    });
    const body: ApiOk<Share> = { data: share };
    return c.json(body, 201);
  })

  .delete('/:id', zValidator('param', idSchema), async (c) => {
    const user = c.get('user');
    const { id } = c.req.valid('param');
    if (!(await withdrawShare(c.env.DB, c.get('org').id, user.id, id))) {
      throw ApiError.notFound('That share does not exist.');
    }
    await recordAudit(c.env.DB, user, c.get('org').id, {
      action: 'share.withdrawn',
      description: `${user.full_name} withdrew a Quest card`,
      entity_type: 'share',
      entity_id: id,
    });
    return c.body(null, 204);
  });

/**
 * Phase 56: the signed-out half -- the public card, and answering a challenge.
 * Public on purpose (in `publicRoutes`): a share is a link anyone may open.
 * Neither names an organization, a child or another player.
 */
export const publicShareRoutes = new Hono<AppEnv>()

  .get('/shares/:id', zValidator('param', idSchema), async (c) => {
    const share = await readPublicShare(c.env.DB, c.req.valid('param').id);
    if (!share) throw ApiError.notFound('That share does not exist.');
    // Counted in Analytics Engine, never D1 (optional binding).
    c.env.SHARE_VIEWS?.writeDataPoint({ blobs: [share.kind ?? 'gone'], indexes: [share.id] });
    // A minute at the edge: withdrawing reaches every reader within it.
    c.header('Cache-Control', 'public, max-age=60');
    const body: ApiOk<PublicShare> = {
      data: { ...share, turnstile_site_key: share.kind === 'challenge' ? c.env.TURNSTILE_SITE_KEY || null : null },
    };
    return c.json(body);
  })

  .post('/challenge/:id/answer', zValidator('param', idSchema), zValidator('json', challengeAnswerSchema), async (c) => {
    const ip = clientAddress(c);
    await rateLimit(c, 'challenge_answer', ip);
    const input = c.req.valid('json');
    await assertHuman(c.env, input.turnstile_token, ip === 'local' ? null : ip);
    const question = await challengeQuestion(c.env.DB, c.req.valid('param').id);
    if (!question) throw ApiError.notFound('That challenge is no longer available.');
    // Marked by code against the bank's key, as Quest marks it.
    const body: ApiOk<ChallengeResult> = {
      data: { correct: checkAnswer(question, input.answer), answer: question.answer, solution: question.solution },
    };
    return c.json(body);
  });
