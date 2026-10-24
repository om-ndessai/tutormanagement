// Phase 50 (docs/mobile/build-log.md, entry 62): the Assessment home's rules, kept pure so they are
// tested without a screen. Everything comes from the rows `GET /canvas-assessments` already returns
// (the server's scope and its `can_review` / `can_continue`, R17): nothing here widens what a reader
// sees, it only orders and words it.
import { formatRelativeTime, zonedClockParts, type CanvasAssessment } from '@tmi/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Oct 22": the day an instant falls on, on the organization's clock. */
export function shortDay(iso: string, timeZone: string): string {
  const { day } = zonedClockParts(iso, timeZone);
  const [, month, date] = day.split('-');
  return `${MONTHS[Number(month) - 1] ?? ''} ${Number(date)}`;
}

const live = (row: CanvasAssessment) => row.status !== 'discarded';
const newestFirst = (a: CanvasAssessment, b: CanvasAssessment) => b.started_at.localeCompare(a.started_at);

/** Each student's newest assessment by `started_at`, discarded ones skipped. */
export function latestByStudent(rows: readonly CanvasAssessment[]): Map<string, CanvasAssessment> {
  const latest = new Map<string, CanvasAssessment>();
  for (const row of rows) {
    if (!live(row)) continue;
    const current = latest.get(row.student_user_id);
    if (!current || row.started_at > current.started_at) latest.set(row.student_user_id, row);
  }
  return latest;
}

/** The line under a student's name on the Assessment home. */
export function studentStatusLine(row: CanvasAssessment | undefined, timeZone: string): string {
  if (!row) return 'No assessment yet';
  if (row.reviewed_at) return `Reviewed ${shortDay(row.reviewed_at, timeZone)}`;
  if (row.status === 'in_progress') return `In progress, started ${shortDay(row.started_at, timeZone)}`;
  if (row.review_draft) return 'Review in progress';
  return `Submitted ${shortDay(row.submitted_at ?? row.started_at, timeZone)}, waiting for review`;
}

/** Submitted, not yet reviewed, and the reader reviews it: the oldest submitted first, at most 5. */
export function waitingForReview(rows: readonly CanvasAssessment[], limit = 5): CanvasAssessment[] {
  return rows
    .filter((row) => row.can_review && row.status === 'submitted' && !row.reviewed_at)
    .sort((a, b) => (a.submitted_at ?? a.started_at).localeCompare(b.submitted_at ?? b.started_at))
    .slice(0, limit);
}

/** The newest non-discarded assessments. */
export function recentAssessments(rows: readonly CanvasAssessment[], limit = 5): CanvasAssessment[] {
  return rows.filter(live).sort(newestFirst).slice(0, limit);
}

/** "submitted 2 days ago". */
export function submittedAgo(row: CanvasAssessment, now?: Date): string {
  return `submitted ${formatRelativeTime(row.submitted_at ?? row.started_at, now)}`;
}
