import { z } from 'zod';

import { levelLabel } from './canvas-assessments.js';

// ---------------------------------------------------------------------------
// Sharing Quest (Phase 56, docs/sharing-plan.md, R22)
// ---------------------------------------------------------------------------
// A share is a public link (/s/<id>) to a card the SERVER built from the
// person's own result: a Quest game's result, a level finished, or "Can you
// solve this?" with one approved question they answered right. No child is
// named, no other player is named, no free text, no space name; the maker may
// withdraw it, and it expires after a year. No points and no leaderboard.

export const SHARE_KINDS = ['game_result', 'level_finished', 'challenge'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

/** How long a share lives. */
export const SHARE_TTL_DAYS = 365;

/** The link's id: random, long enough not to be guessed. */
export const SHARE_ID_LENGTH = 16;

const showFirstName = z.boolean().optional();

export const createShareSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('game_result'), game_id: z.uuid(), show_first_name: showFirstName }),
  z.object({ kind: z.literal('level_finished'), level_id: z.string().trim().min(1).max(40), show_first_name: showFirstName }),
  z.object({
    kind: z.literal('challenge'),
    game_id: z.uuid(),
    question_id: z.string().trim().min(1).max(64),
    show_first_name: showFirstName,
  }),
]);
export type CreateShareInput = z.input<typeof createShareSchema>;

export type ShareMark = 'right' | 'wrong' | 'skipped';

/** The numbers a card shows. Built on the server; never a name but the maker's chosen first name. */
export type ShareCard =
  | {
      kind: 'game_result';
      level_id: string;
      level_label: string;
      mode: 'count' | 'timed';
      knockout: boolean;
      single: boolean;
      place: number | null;
      teams: number;
      correct: number;
      wrong: number;
      skipped: number;
      total: number;
      score: number;
      marks: ShareMark[];
    }
  | { kind: 'level_finished'; level_id: string; level_label: string; answered: number; correct: number }
  | { kind: 'challenge'; level_id: string; level_label: string; question_id: string };

/** One of the reader's own shares. */
export interface Share {
  id: string;
  kind: ShareKind;
  card: ShareCard;
  /** The first name the maker chose to show, or null. */
  first_name: string | null;
  created_at: string;
  expires_at: string;
  withdrawn_at: string | null;
}

/** What the public page reads. A withdrawn or expired share carries no card. */
export interface PublicShare {
  id: string;
  available: boolean;
  kind: ShareKind | null;
  card: ShareCard | null;
  first_name: string | null;
  /** A challenge's question, without its key or solution (those come after an answer). */
  question: { stem: string; kind: 'choice' | 'numeric'; choices: string[] } | null;
  /** Cloudflare Turnstile's site key for the answer, or null where none is set (local, the suites). */
  turnstile_site_key: string | null;
}

export const challengeAnswerSchema = z.object({
  answer: z.string().trim().min(1, 'Give an answer.').max(200),
  /** Cloudflare Turnstile's token from the widget. */
  turnstile_token: z.string().max(4096).optional(),
});
export type ChallengeAnswerInput = z.input<typeof challengeAnswerSchema>;

export interface ChallengeResult {
  correct: boolean;
  answer: string;
  solution: string;
}

/** "Grade 5 · Knockout · 2nd of 5 teams · 9/10", the card's line. */
export function shareHeadline(card: ShareCard): string {
  if (card.kind === 'level_finished') return `Finished ${card.level_label} · ${card.answered} questions`;
  if (card.kind === 'challenge') return `${card.level_label} · Can you solve this?`;
  const parts = [card.level_label];
  if (card.knockout) parts.push('Knockout');
  if (!card.single && card.place !== null) parts.push(`${ordinal(card.place)} of ${card.teams} ${card.teams === 1 ? 'team' : 'teams'}`);
  parts.push(`${card.correct}/${card.total}`);
  return parts.join(' · ');
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const MARK: Record<ShareMark, string> = { right: '🟩', wrong: '🟥', skipped: '⬜' };

/**
 * The copyable text, Wordle-style: "Aimtrue Quest · Grade 5 · 9/10 🟩🟩🟥…",
 * then the link. No names but the maker's chosen first name.
 */
export function shareText(share: { card: ShareCard; first_name: string | null }, url: string, brand = 'Aimtrue'): string {
  const who = share.first_name ? `${share.first_name} · ` : '';
  const marks = share.card.kind === 'game_result' && share.card.marks.length > 0 ? ` ${share.card.marks.map((m) => MARK[m]).join('')}` : '';
  return `${brand} Quest · ${who}${shareHeadline(share.card)}${marks}\n${url}`;
}

/** The public link for a share on this site. */
export function shareUrl(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, '')}/s/${id}`;
}

/** The level's label, as the card shows it. */
export function shareLevelLabel(levelId: string): string {
  return levelLabel(levelId);
}

/** The places a share can go when there is no system share sheet. */
export const SHARE_TARGETS = ['x', 'facebook', 'linkedin', 'whatsapp', 'reddit', 'email'] as const;
export type ShareTarget = (typeof SHARE_TARGETS)[number];

export const SHARE_TARGET_LABELS: Record<ShareTarget, string> = {
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  reddit: 'Reddit',
  email: 'Email',
};

/** A direct link to post the share on one of the targets: the text and the link, nothing else. */
export function shareTargetUrl(target: ShareTarget, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (target) {
    case 'x':
      return `https://x.com/intent/post?text=${t}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'whatsapp':
      return `https://wa.me/?text=${t}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${u}&title=${encodeURIComponent(text.split('\n')[0] ?? '')}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(text.split('\n')[0] ?? 'Aimtrue Quest')}&body=${t}`;
  }
}
