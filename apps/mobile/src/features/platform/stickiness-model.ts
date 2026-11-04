// Ported from apps/web/src/features/platform/stickiness-page.tsx @ 755021b (working tree, Phase 69): the
// page's words and figures as pure helpers -- percent, a share's hint, the bars and their spoken values, a
// retention row's name and which rows are shown. Totals only (R30): nothing here names a person.
import {
  SPACE_KIND_LABELS,
  STICKINESS_MIN_GROUP,
  STICKY_ARRIVAL_LABELS,
  STICKY_HAT_LABELS,
  type RetentionRow,
  type StickinessReport,
  type StickyShare,
  type VisitSettingsResponse,
} from '@tmi/shared';

export interface Bar {
  label: string;
  value: number;
  /** What a press shows and a screen reader says. */
  tip: string;
}

/** "42%", or "—" while suppressed. */
export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/** A share tile's second line: its base, or that the group is too small. */
export function shareHint(hint: string, value: StickyShare): string {
  return value.share === null ? `${hint} · fewer than ${STICKINESS_MIN_GROUP}` : `${hint} · ${value.count} of ${value.base}`;
}

/** Last completed week, people by days active (1-7). */
export function dayBars(report: Pick<StickinessReport, 'days_per_week'>): Bar[] {
  return (report.days_per_week ?? []).slice(1).map((n, i) => ({
    label: String(i + 1),
    value: n,
    tip: `${i + 1} ${i ? 'days' : 'day'}: ${n} people`,
  }));
}

/** Active people each week, oldest first; a suppressed week (-1) is drawn empty and says so. */
export function weeklyBars(report: Pick<StickinessReport, 'weekly'>): Bar[] {
  return report.weekly.map((w) => ({
    label: w.week.slice(5),
    value: Math.max(w.active, 0),
    tip: w.active < 0 ? `Week of ${w.week}: fewer than ${STICKINESS_MIN_GROUP}` : `Week of ${w.week}: ${w.active} people`,
  }));
}

/** Whether the weekly chart has nothing to show. */
export function weeklyEmpty(report: Pick<StickinessReport, 'weekly'>): boolean {
  return report.weekly.every((w) => w.active <= 0);
}

const isEveryone = (row: RetentionRow) => row.hat === 'all' && row.space_kind === 'all' && row.arrival === 'all';

/** "Tutors · Tutoring spaces · Added by a space", or "Everyone". */
export function rowName(row: RetentionRow): string {
  const parts = [
    row.hat !== 'all' ? STICKY_HAT_LABELS[row.hat] : null,
    row.space_kind !== 'all' ? SPACE_KIND_LABELS[row.space_kind] : null,
    row.arrival !== 'all' ? STICKY_ARRIVAL_LABELS[row.arrival] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Everyone';
}

/** Everyone always; any other row only when its group is not suppressed. */
export function shownRows(rows: readonly RetentionRow[]): RetentionRow[] {
  return rows.filter((row) => row.cohort > 0 || isEveryone(row));
}

/** The People figure: the cohort, or "<5" when suppressed. */
export function cohortLabel(row: RetentionRow): string {
  return row.cohort ? String(row.cohort) : `<${STICKINESS_MIN_GROUP}`;
}

/** The row's testID suffix, as the web's. */
export function rowKey(row: RetentionRow): string {
  return `${row.hat}-${row.space_kind}-${row.arrival}`;
}

/** The visit switch's second line. */
export function visitsLine(data: VisitSettingsResponse): string {
  return data.may_record
    ? 'One line per person, space and day they open it -- nothing about what they did. Kept 120 days.'
    : `Waiting for the privacy notice of ${data.needs_privacy_version} (published: ${data.privacy_version}). Until then only days played are counted.`;
}

/** Whether the switch may be pressed: switching off always; on only once the notice covers it. */
export function visitsToggleEnabled(data: VisitSettingsResponse): boolean {
  return data.settings.record || data.may_record;
}
