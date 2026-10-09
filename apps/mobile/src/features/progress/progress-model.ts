// Ported from apps/web/src/features/progress/{progress-page.tsx, progress-list.tsx,
// student-progress-page.tsx, plan-dialog.tsx, topic-pickers.tsx} @ 1132322 -- the parts that are
// rules rather than layout, pure so they are tested.
import type {
  Assessment,
  CurriculumLevel,
  ProgressCancellation,
  ProgressOverview,
  ProgressPoint,
  ProgressStatus,
} from '@tmi/shared';

/** The order a busy office wants to read them in: trouble first. */
export const STATUS_ORDER: ProgressStatus[] = [
  'behind',
  'not_started',
  'no_plan',
  'on_track',
  'ahead',
  'achieved',
  'closed',
];

export interface OverviewFilters {
  search: string;
  status: ProgressStatus | 'all';
  /** A student id, or 'all'. */
  student: string;
  /** The students of the chosen tutor; null when no tutor is chosen. */
  tutorStudents: Set<string> | null;
}

/**
 * The rows the filters leave, trouble first, then by name. Every filter narrows the rows the API
 * already scoped to this reader, so a filter can never show more than the list.
 */
export function filterOverview(rows: ProgressOverview[], filters: OverviewFilters): ProgressOverview[] {
  const needle = filters.search.trim().toLowerCase();
  return rows
    .filter((row) => filters.student === 'all' || row.student_user_id === filters.student)
    .filter((row) => filters.tutorStudents === null || filters.tutorStudents.has(row.student_user_id))
    .filter((row) => filters.status === 'all' || row.summary.status === filters.status)
    .filter((row) => !needle || row.student_name.toLowerCase().includes(needle))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.summary.status) - STATUS_ORDER.indexOf(b.summary.status) ||
        a.student_name.localeCompare(b.student_name),
    );
}

/** How many students stand at each status, for the chips. */
export function statusCounts(rows: ProgressOverview[]): Map<ProgressStatus, number> {
  const map = new Map<ProgressStatus, number>();
  for (const row of rows) map.set(row.summary.status, (map.get(row.summary.status) ?? 0) + 1);
  return map;
}

export interface TutorOption {
  id: string;
  name: string;
  students: Set<string>;
}

/** Who teaches whom, from the pairings this reader can see, by name. */
export function tutorsFromPairings(
  pairings: { tutor_user_id: string; tutor_name: string; student_user_id: string }[],
): TutorOption[] {
  const byTutor = new Map<string, TutorOption>();
  for (const pairing of pairings) {
    const entry = byTutor.get(pairing.tutor_user_id) ?? {
      id: pairing.tutor_user_id,
      name: pairing.tutor_name,
      students: new Set<string>(),
    };
    entry.students.add(pairing.student_user_id);
    byTutor.set(pairing.tutor_user_id, entry);
  }
  return [...byTutor.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

/** The line under a student's name in the list. */
export function overviewLine(row: ProgressOverview): string {
  if (row.goal) return `${row.goal}${row.target_on ? ` · by ${shortDate(row.target_on)}` : ''}`;
  if (row.last_assessed_on) return `Assessed ${shortDate(row.last_assessed_on)} · no plan yet`;
  return 'Not assessed yet';
}

export type LessonRow =
  | { kind: 'lesson'; day: string; item: ProgressPoint }
  | { kind: 'cancelled'; day: string; item: ProgressCancellation };

/**
 * The plan's lessons and its cancelled ones, newest first, as one list: a cancelled week sits
 * where it happened, so the list explains its own gaps. Upcoming cancellations lead.
 */
export function lessonRows(timeline: ProgressPoint[], cancellations: ProgressCancellation[]): LessonRow[] {
  return [
    ...timeline.map((item) => ({ kind: 'lesson' as const, day: item.occurred_on, item })),
    ...cancellations.map((item) => ({ kind: 'cancelled' as const, day: item.occurs_on, item })),
  ].sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * The topics a new plan starts with: every one the assessment scored 3 or below, weakest first,
 * then in catalog order -- those are what the plan is for. The assessor then trims and reorders.
 */
export function weakestTopics(
  assessment: Pick<Assessment, 'ratings'> | null,
  levels: CurriculumLevel[],
): string[] {
  const order = new Map<string, number>();
  levels.forEach((level) =>
    level.topics.forEach((topic) => order.set(topic.id, level.stage * 100 + topic.number)),
  );
  return (assessment?.ratings ?? [])
    .filter((row) => row.rating <= 3)
    .sort((a, b) => a.rating - b.rating || (order.get(a.topic_id) ?? 0) - (order.get(b.topic_id) ?? 0))
    .map((row) => row.topic_id);
}

/** A year from a date, as the default goal date. */
export function aYearOn(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/** One topic a place earlier (-1) or later (+1) in the teaching order. */
export function moveTopic(list: string[], index: number, by: -1 | 1): string[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Chosen topics are taught in the order they were added; choosing again takes one out. */
export function toggleTopic(list: string[], topicId: string): string[] {
  return list.includes(topicId) ? list.filter((id) => id !== topicId) : [...list, topicId];
}

/** The level a topic id belongs to: "BA3.10" -> "BA3". */
export function levelOf(topicId: string): string {
  return topicId.split('.')[0]!;
}
