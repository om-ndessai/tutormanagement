// Ported from apps/web/src/features/question-bank/{question-bank-page,standard-page,review-page}.tsx
// @ b0d216e: the figures those pages derive inline (totals, a level's line, a standard's status
// line, the filter counts, the review queue's next question and "N left"). Mobile adds the cache
// updates (#54, "no refetch per action"): an action's answer is written into the cached lists and
// the coverage, instead of refetching the 200-question queue and the coverage after every tap.
// Pure: no React, no query client.
import {
  QUESTIONS_PER_DIFFICULTY_TARGET,
  QUESTION_STATUSES,
  topicCovered,
  type Question,
  type QuestionCoverageLevel,
  type QuestionCoverageTopic,
  type QuestionStatus,
} from '@tmi/shared';

/** What a list in the cache was asked for (the web's `bankKeys.list` filter). */
export interface QuestionFilter {
  topic_id?: string;
  status?: QuestionStatus;
}

export const approvedOf = (topic: QuestionCoverageTopic) => topic.approved.reduce((a, b) => a + b, 0);

/** The bank's figures. "At target" counts only standards that can be asked in text. */
export function bankTotals(levels: readonly QuestionCoverageLevel[]) {
  const topics = levels.flatMap((level) => level.topics);
  const askable = topics.filter((topic) => !topic.needs_figure);
  return {
    approved: topics.reduce((sum, topic) => sum + approvedOf(topic), 0),
    atTarget: askable.filter(topicCovered).length,
    askable: askable.length,
    toReview: topics.reduce((sum, topic) => sum + topic.checked, 0),
    flagged: topics.reduce((sum, topic) => sum + topic.flagged, 0),
  };
}

/** Questions waiting for review, across the bank (the review queue's whole length). */
export function waitingCount(levels: readonly QuestionCoverageLevel[] | undefined): number | undefined {
  return levels?.reduce((sum, level) => sum + level.topics.reduce((n, topic) => n + topic.checked, 0), 0);
}

/** A level's header line: "0 of 11 standards at target · 99 to review". */
export function levelSummary(level: QuestionCoverageLevel): string {
  const covered = level.topics.filter(topicCovered).length;
  const toReview = level.topics.reduce((sum, topic) => sum + topic.checked, 0);
  const line = `${covered} of ${level.topics.length} standards at target`;
  return toReview > 0 ? `${line} · ${toReview} to review` : line;
}

/** The web's status line: "8 to review · 1 flagged · 2 not checked", otherwise "At target". */
export function standardStatusLine(topic: QuestionCoverageTopic): string {
  return (
    [
      topic.checked && `${topic.checked} to review`,
      topic.flagged && `${topic.flagged} flagged`,
      topic.draft && `${topic.draft} not checked`,
    ]
      .filter(Boolean)
      .join(' · ') || (topicCovered(topic) ? 'At target' : '')
  );
}

/** An approved-count pill: at its target, started, or empty. */
export type ApprovedTone = 'target' | 'some' | 'none';

export function approvedTone(count: number): ApprovedTone {
  return count >= QUESTIONS_PER_DIFFICULTY_TARGET ? 'target' : count > 0 ? 'some' : 'none';
}

export type FilterId = QuestionStatus | 'all';
export const FILTERS: readonly FilterId[] = ['all', ...QUESTION_STATUSES];

/** Each filter's count. All leaves the retired out, as the web does. */
export function filterCounts(questions: readonly Question[]): Record<FilterId, number> {
  const counts: Record<FilterId, number> = {
    all: 0,
    draft: 0,
    checked: 0,
    flagged: 0,
    approved: 0,
    retired: 0,
  };
  for (const question of questions) {
    counts[question.status] += 1;
    if (question.status !== 'retired') counts.all += 1;
  }
  return counts;
}

export function applyFilter(questions: readonly Question[], filter: FilterId): Question[] {
  return questions.filter((q) => (filter === 'all' ? q.status !== 'retired' : q.status === filter));
}

/**
 * The question to show next: the first in the queue neither skipped nor acted on this session.
 * `done` holds what the server accepted, so a refetch that still lists one never brings it back.
 */
export function nextInQueue(
  items: readonly Question[],
  skipped: ReadonlySet<string>,
  done: ReadonlySet<string>,
): Question | null {
  return items.find((q) => !skipped.has(q.id) && !done.has(q.id)) ?? null;
}

/** The web's "N left": waiting for review across the bank, less what was skipped. Never below 0. */
export function leftCount(waiting: number, skipped: number): number {
  return Math.max(0, waiting - skipped);
}

/** The queue's un-acted questions still in the loaded page. */
export function unactedCount(
  items: readonly Question[],
  skipped: ReadonlySet<string>,
  done: ReadonlySet<string>,
): number {
  return items.filter((q) => !skipped.has(q.id) && !done.has(q.id)).length;
}

/** Below this many un-acted questions in the loaded page, the queue reads its next page. */
export const QUEUE_LOW_WATER = 10;

/**
 * Whether the queue should read again: few un-acted questions left in the page, and more waiting
 * than the page holds (the bank's count, less those skipped, is more than what is left here).
 */
export function queueRunsLow(unacted: number, waiting: number | undefined, skipped: number): boolean {
  return unacted < QUEUE_LOW_WATER && waiting !== undefined && waiting - skipped > unacted;
}

/**
 * A cached list after the server answered an action: the question leaves a list filtered to a
 * status it no longer has, and is replaced in place everywhere else it appears.
 */
export function applyActionToList(list: Question[], filter: QuestionFilter, updated: Question): Question[] {
  if (filter.topic_id && filter.topic_id !== updated.topic_id) return list;
  if (!list.some((q) => q.id === updated.id)) return list;
  if (filter.status && filter.status !== updated.status) return list.filter((q) => q.id !== updated.id);
  return list.map((q) => (q.id === updated.id ? updated : q));
}

/** Moves one question's count from its old status to its new one (approved counts by difficulty). */
export function applyActionToCoverage(
  coverage: QuestionCoverageLevel[],
  before: Pick<Question, 'topic_id' | 'status' | 'difficulty'>,
  after: Pick<Question, 'topic_id' | 'status' | 'difficulty'>,
): QuestionCoverageLevel[] {
  if (before.status === after.status && before.difficulty === after.difficulty) return coverage;
  const move = (topic: QuestionCoverageTopic, of: typeof before, by: 1 | -1): QuestionCoverageTopic => {
    switch (of.status) {
      case 'approved': {
        const approved = [...topic.approved] as [number, number, number];
        approved[of.difficulty - 1] = Math.max(0, approved[of.difficulty - 1]! + by);
        return { ...topic, approved };
      }
      case 'checked':
        return { ...topic, checked: Math.max(0, topic.checked + by) };
      case 'flagged':
        return { ...topic, flagged: Math.max(0, topic.flagged + by) };
      case 'draft':
        return { ...topic, draft: Math.max(0, topic.draft + by) };
      default:
        return topic; // retired: not counted
    }
  };
  return coverage.map((level) =>
    level.topics.some((t) => t.topic_id === before.topic_id || t.topic_id === after.topic_id)
      ? {
          ...level,
          topics: level.topics.map((topic) => {
            let next = topic;
            if (topic.topic_id === before.topic_id) next = move(next, before, -1);
            if (topic.topic_id === after.topic_id) next = move(next, after, 1);
            return next;
          }),
        }
      : level,
  );
}

/** What a card offers: Approve only when checked, Retire unless retired, Restore only when retired. */
export function actionsFor(status: QuestionStatus) {
  return {
    approve: status === 'checked',
    retire: status !== 'retired',
    restore: status === 'retired',
  };
}

/** A standard of the coverage, with its level's name (the web's lookup on the standard page). */
export function findStandard(
  levels: readonly QuestionCoverageLevel[] | undefined,
  topicId: string,
): (QuestionCoverageTopic & { level: string }) | undefined {
  for (const level of levels ?? []) {
    const topic = level.topics.find((t) => t.topic_id === topicId);
    if (topic) return { ...topic, level: level.name };
  }
  return undefined;
}
