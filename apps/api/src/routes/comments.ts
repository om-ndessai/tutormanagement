import { Hono } from 'hono';
import { z } from 'zod';
import {
  COMMENT_TARGET_LABELS,
  commentCountsQuerySchema,
  commentInputSchema,
  commentTargetSchema,
  listCommentFeedQuerySchema,
  type ApiList,
  type ApiOk,
  type Comment,
  type CommentFeedEntry,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import {
  canAccessTarget,
  countCommentsByTarget,
  listCommentFeed,
  createComment,
  getComment,
  listComments,
  loadCommentTarget,
  softDeleteComment,
} from '../repositories/comments.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid comment id.' }) });

/**
 * Comments on a person, a lesson, a pairing or a recurring slot.
 *
 * Every route here resolves the TARGET first and refuses if the viewer has no
 * business with it, so a comment can never be read, written or counted through
 * an id the viewer would not otherwise be allowed to see. A target they cannot
 * see is reported as missing rather than forbidden: that it exists is itself
 * something they are not entitled to know.
 */
export const commentsRoutes = new Hono<AppEnv>()

  /** One thread, newest first. */
  .get('/', zValidator('query', commentTargetSchema), async (c) => {
    const viewer = c.get('user');
    const target = c.req.valid('query');

    const row = await loadCommentTarget(c.env.DB, target);
    if (!row || !(await canAccessTarget(c.env.DB, viewer, target, row))) {
      throw ApiError.notFound(`That ${COMMENT_TARGET_LABELS[target.target_type]} does not exist.`);
    }

    const body: ApiOk<{ comments: Comment[]; target_name: string | null }> = {
      data: {
        comments: await listComments(c.env.DB, viewer, target),
        // Lets the composer name the audience without a second request.
        target_name: row.name,
      },
    };
    return c.json(body);
  })

  /**
   * Everything the viewer may read, newest first, whatever it hangs off.
   *
   * Deliberately the same visibility fragments as a single thread: this page
   * is a different view of the same comments, never a wider one. A tutor's
   * feed therefore holds their own remarks about a student and every comment
   * on the lessons they taught, but not another tutor's note about that same
   * child.
   */
  .get('/feed', zValidator('query', listCommentFeedQuerySchema), async (c) => {
    const viewer = c.get('user');
    const params = c.req.valid('query');

    const { entries, total } = await listCommentFeed(c.env.DB, viewer, params);

    const body: ApiList<CommentFeedEntry> = {
      data: entries,
      meta: { total, limit: params.limit, offset: params.offset },
    };
    return c.json(body);
  })

  /**
   * How many comments hang off each target of one kind, for the list badges.
   * Scoped exactly like the threads themselves.
   */
  .get('/counts', zValidator('query', commentCountsQuerySchema), async (c) => {
    const viewer = c.get('user');
    const { target_type } = c.req.valid('query');

    const body: ApiOk<Record<string, number>> = {
      data: await countCommentsByTarget(c.env.DB, viewer, target_type),
    };
    return c.json(body);
  })

  .post('/', zValidator('json', commentInputSchema), async (c) => {
    const viewer = c.get('user');
    const input = c.req.valid('json');

    const row = await loadCommentTarget(c.env.DB, input);
    if (!row || !(await canAccessTarget(c.env.DB, viewer, input, row))) {
      throw ApiError.notFound(`That ${COMMENT_TARGET_LABELS[input.target_type]} does not exist.`);
    }

    const id = await createComment(c.env.DB, viewer.id, input);

    // The comment itself is deliberately NOT in the description: the audit log
    // is read by admins, and a comment is not theirs to read by default.
    await recordAudit(c.env.DB, viewer, {
      action: 'comment.added',
      description: `Commented on ${row.label}`,
      subject:
        input.target_type === 'user' ? { id: input.target_id, full_name: row.label } : undefined,
      entity_type: 'comment',
      entity_id: id,
    });

    const comments = await listComments(c.env.DB, viewer, input);
    const created = comments.find((comment) => comment.id === id);
    if (!created) throw new Error('The comment was written but could not be read back.');

    const body: ApiOk<Comment> = { data: created };
    return c.json(body, 201);
  })

  /**
   * Withdraws a comment.
   *
   * "They can only be deleted by the user who entered it" -- so this refuses
   * an admin as firmly as a stranger, and says nothing about whether the id
   * exists.
   */
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const viewer = c.get('user');
    const { id } = c.req.valid('param');

    const comment = await getComment(c.env.DB, id);
    if (!comment || comment.deleted_at) throw ApiError.notFound('That comment does not exist.');

    const target = comment.target_user_id
      ? ({ target_type: 'user', target_id: comment.target_user_id } as const)
      : comment.target_session_id
        ? ({ target_type: 'session', target_id: comment.target_session_id } as const)
        : comment.target_assignment_id
          ? ({ target_type: 'assignment', target_id: comment.target_assignment_id } as const)
          : ({
              target_type: 'scheduled_session',
              target_id: comment.target_scheduled_session_id!,
            } as const);

    if (comment.author_user_id !== viewer.id) {
      // Somebody who can read the comment is told it is not theirs to delete.
      // Somebody who cannot is told it does not exist -- the same thread query
      // decides, so this can never disagree with what they are shown -- as a
      // 403 would confirm the id is real.
      const row = await loadCommentTarget(c.env.DB, target);
      const readable =
        isAdmin(viewer) ||
        (row !== null &&
          (await canAccessTarget(c.env.DB, viewer, target, row)) &&
          (await listComments(c.env.DB, viewer, target)).some((visible) => visible.id === id));

      if (!readable) throw ApiError.notFound('That comment does not exist.');
      throw new ApiError(403, 'forbidden', 'Only the person who wrote a comment can delete it.');
    }

    await softDeleteComment(c.env.DB, id);

    const row = await loadCommentTarget(c.env.DB, target);

    await recordAudit(c.env.DB, viewer, {
      action: 'comment.deleted',
      description: `Deleted their comment on ${row?.label ?? 'a record since removed'}`,
      subject:
        target.target_type === 'user' && row
          ? { id: target.target_id, full_name: row.label }
          : undefined,
      entity_type: 'comment',
      entity_id: id,
    });

    return c.body(null, 204);
  });
