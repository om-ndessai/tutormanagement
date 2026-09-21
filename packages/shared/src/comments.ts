import { z } from 'zod';

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
// Phase 12. A remark against a person, a lesson, a pairing or a recurring
// slot, readable by the people that thing concerns.

export const COMMENT_TARGET_TYPES = ['user', 'session', 'assignment', 'scheduled_session'] as const;

export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];

export const COMMENT_TARGET_LABELS: Record<CommentTargetType, string> = {
  user: 'person',
  session: 'session',
  assignment: 'assignment',
  scheduled_session: 'scheduled session',
};

/** Long enough for a paragraph of context, short enough to stay a comment. */
export const MAX_COMMENT_LENGTH = 2000;

export const commentTargetSchema = z.object({
  target_type: z.enum(COMMENT_TARGET_TYPES),
  target_id: z.uuid({ message: 'Not a valid id.' }),
});

export type CommentTarget = z.output<typeof commentTargetSchema>;

export const commentInputSchema = commentTargetSchema.extend({
  body: z
    .string()
    .trim()
    .min(1, 'Write something before posting.')
    .max(MAX_COMMENT_LENGTH, `Keep a comment to ${MAX_COMMENT_LENGTH} characters or fewer.`),
});

export type CommentInput = z.input<typeof commentInputSchema>;
export type CommentPayload = z.output<typeof commentInputSchema>;

/** Counts for every target of one kind the viewer can see, keyed by target id. */
export const commentCountsQuerySchema = z.object({
  target_type: z.enum(COMMENT_TARGET_TYPES),
});

/** The global feed: everything the viewer may read, newest first. */
export const listCommentFeedQuerySchema = z.object({
  /** Narrows to one kind of target; absent means all four. */
  target_type: z.enum(COMMENT_TARGET_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListCommentFeedParams = z.output<typeof listCommentFeedQuerySchema>;

export interface Comment {
  id: string;
  author_user_id: string;
  /** Read live rather than snapshotted, so a rename carries into old threads. */
  author_name: string;
  target_type: CommentTargetType;
  target_id: string;
  body: string;
  created_at: string;
  /**
   * Whether THIS viewer may withdraw it. The plan gives that right to the
   * author alone -- not to an admin -- so the answer depends on who is asking
   * and the UI must not work it out for itself.
   */
  can_delete: boolean;
}

/**
 * A comment in the global feed, which has to name the thing it hangs off --
 * a thread never does, because the reader is already looking at it.
 */
export interface CommentFeedEntry extends Comment {
  /** "the 2026-09-15 session with Sofia Okafor", "Ben Whitfield". */
  target_label: string;
}

/**
 * Who will be able to read a comment, in a sentence, for the composer.
 *
 * Shown because a comment about a person is not a private note: writing one
 * without knowing who sees it is how somebody ends up saying something they
 * would not have said to the reader's face.
 */
export function commentAudienceHint(
  targetType: CommentTargetType,
  targetName?: string | null,
): string {
  if (targetType === 'user') {
    const who = targetName ?? 'that person';
    return `Visible to admins, ${who}, and their parents.`;
  }

  return 'Visible to admins, the tutor, the student, and the student’s parents.';
}
