// Phase 58: the progress report (docs/progress-report-plan.md) -- one student's
// goal, figures, timeline, recommendation, plan topics, lessons with their
// write-ups and, when asked, the original assessment, in the organization's
// colour with its logo. US Letter, laid out top-down; lessons run on across pages.
//
// No money, anywhere: nothing this file is given carries a price, and it
// formats no amount.
import {
  HOMEWORK_STATUS_LABELS,
  PROGRESS_STATUS_LABELS,
  SESSION_WRITE_UP_PARTS,
  TOPIC_RATING_LABELS,
  formatCadence,
  formatDuration,
  formatHoursMinutes,
  formatTimeRange,
  parseClockTime,
  type Assessment,
  type ProgressStatus,
  type Rating,
  type StudentProgress,
} from '@tmi/shared';

import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PdfDocument,
  textWidth,
  wrapText,
  type PdfFont,
  type PdfImage,
  type PdfPage,
  type Rgb,
} from './pdf.js';
import type { CatalogLabel, ReportSession } from '../repositories/progress-report.js';

const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** The lowest a line of the body may sit; the footer lives below it. */
const BOTTOM = 58;
/** Where the body starts on a page after the first, under the running header. */
const RUNNING_TOP = PAGE_HEIGHT - 66;

const WHITE: Rgb = [1, 1, 1];
const INK: Rgb = [0.11, 0.12, 0.16];
const MUTED: Rgb = [0.43, 0.45, 0.5];
const RULE: Rgb = [0.86, 0.87, 0.9];
const CARD_BORDER: Rgb = [0.84, 0.85, 0.89];
const SOFT: Rgb = [0.965, 0.968, 0.976];
const PACE: Rgb = [0.6, 0.62, 0.67];
const UNSCORED: Rgb = [0.83, 0.84, 0.87];

const STATUS_COLORS: Record<ProgressStatus, { fill: Rgb; ink: Rgb }> = {
  ahead: { fill: [0.86, 0.95, 0.89], ink: [0.08, 0.42, 0.22] },
  on_track: { fill: [0.86, 0.95, 0.89], ink: [0.08, 0.42, 0.22] },
  achieved: { fill: [0.86, 0.95, 0.89], ink: [0.08, 0.42, 0.22] },
  behind: { fill: [0.99, 0.93, 0.82], ink: [0.6, 0.33, 0.02] },
  not_started: { fill: [0.93, 0.94, 0.96], ink: [0.35, 0.37, 0.42] },
  no_plan: { fill: [0.93, 0.94, 0.96], ink: [0.35, 0.37, 0.42] },
  closed: { fill: [0.93, 0.94, 0.96], ink: [0.35, 0.37, 0.42] },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

export interface ProgressReportInput {
  organizationName: string;
  /** The organization's palette colour, as #RRGGBB. */
  paletteHex: string;
  logo: PdfImage | null;
  progress: StudentProgress;
  from: string;
  to: string;
  /** Today on the organization's clock. */
  generatedOn: string;
  sessions: ReportSession[];
  /** Every lesson in the range the reader may list (may exceed `sessions.length`). */
  sessionCount: number;
  totalMinutes: number;
  /** Names for the levels and topics the report mentions. */
  labels: Map<string, CatalogLabel>;
  /** undefined: not asked for; null: asked for, but the student has none. */
  original?: Assessment | null;
  /** The calendar's marks, by date (YYYY-MM-DD), within the range. */
  calendar: Map<string, CalendarMark>;
}

/**
 * What the calendar shows on a day: a lesson held there; a scheduled date cancelled (and not then held);
 * or a scheduled date with nothing recorded (yet).
 */
export type CalendarMark = 'held' | 'cancelled' | 'scheduled';

/**
 * The calendar's marks from the schedules' dates, the cancellations and the lessons held, within the
 * range. A recorded lesson outranks a cancellation, as everywhere.
 */
export function calendarMarks(
  scheduled: readonly string[],
  cancelled: readonly string[],
  held: readonly string[],
  from: string,
  to: string,
): Map<string, CalendarMark> {
  const marks = new Map<string, CalendarMark>();
  const inRange = (day: string) => day >= from && day <= to;
  for (const day of scheduled) if (inRange(day)) marks.set(day, 'scheduled');
  for (const day of cancelled) if (inRange(day)) marks.set(day, 'cancelled');
  for (const day of held) if (inRange(day)) marks.set(day, 'held');
  return marks;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return [0.19, 0.34, 0.49];
  return [parseInt(match[1]!, 16) / 255, parseInt(match[2]!, 16) / 255, parseInt(match[3]!, 16) / 255];
}

/** The colour mixed with white: 0 is white, 1 the colour itself. */
function tint(color: Rgb, amount: number): Rgb {
  return [1 - (1 - color[0]) * amount, 1 - (1 - color[1]) * amount, 1 - (1 - color[2]) * amount];
}

/** The colour darkened towards black by `amount`. */
function shade(color: Rgb, amount: number): Rgb {
  return [color[0] * (1 - amount), color[1] * (1 - amount), color[2] * (1 - amount)];
}

/** The 1-5 scale in the organization's ramp, as the portal's rating tokens are. */
function ratingFill(brand: Rgb, rating: Rating): Rgb {
  return [tint(brand, 0.14), tint(brand, 0.3), tint(brand, 0.58), brand, shade(brand, 0.35)][rating - 1]!;
}

function ratingInk(rating: Rating): Rgb {
  return rating >= 4 ? WHITE : INK;
}

function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** "October 27, 2026" */
function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${day}, ${year}`;
}

/** "Oct 27, 2026" */
function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[(month ?? 1) - 1]!.slice(0, 3)} ${day}, ${year}`;
}

/** "Jun 15" */
function monthDay(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${MONTHS[(month ?? 1) - 1]!.slice(0, 3)} ${day}`;
}

/** "Tue, Oct 27, 2026" */
function lessonDate(iso: string): string {
  return `${WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${shortDate(iso)}`;
}

function timeRange(start: string, end: string): string {
  const from = parseClockTime(start);
  const to = parseClockTime(end);
  return from === null || to === null ? `${start}-${end}` : formatTimeRange(from, to);
}

/** Cuts text to fit a width, with an ellipsis. */
function fit(text: string, size: number, width: number, font: PdfFont = 'regular'): string {
  if (textWidth(text, size, font) <= width) return text;
  let cut = text.length;
  while (cut > 1 && textWidth(`${text.slice(0, cut)}…`, size, font) > width) cut -= 1;
  return `${text.slice(0, cut).trimEnd()}…`;
}

/** Initials for the logo's stand-in: "Chapel Hill Math Institute" -> "CH". */
function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^[A-Za-z0-9]/.test(word));
  return (words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

// ---------------------------------------------------------------------------
// The flow: a page and a baseline, with a new page when the next thing will not fit
// ---------------------------------------------------------------------------

class Flow {
  page: PdfPage;
  y: number;

  constructor(
    readonly doc: PdfDocument,
    readonly running: string,
    first: PdfPage,
    y: number,
  ) {
    this.page = first;
    this.y = y;
  }

  newPage(): void {
    this.page = this.doc.addPage();
    // The running header: who the report is about, on every page after the first.
    this.page.text(MARGIN, PAGE_HEIGHT - 34, this.running, 8, 'regular', MUTED);
    this.page.line(MARGIN, PAGE_HEIGHT - 42, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, RULE, 0.5);
    this.y = RUNNING_TOP;
  }

  /** Makes room for `height` points below the cursor, turning the page if needed. */
  ensure(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  /** A section's heading, kept with at least `keep` points of what follows. */
  heading(title: string, brand: Rgb, keep = 60, subtitle?: string): void {
    this.y -= 8;
    this.ensure(26 + keep);
    this.page.rect(MARGIN, this.y - 2, 3, 14, { fill: brand });
    this.page.text(MARGIN + 10, this.y, title, 13, 'bold', INK);
    if (subtitle) this.page.textRight(PAGE_WIDTH - MARGIN, this.y, subtitle, 8.5, 'regular', MUTED);
    this.y -= 22;
  }

  /** Wrapped lines at x, flowing across pages one line at a time. */
  lines(lines: readonly string[], x: number, size: number, leading: number, font: PdfFont = 'regular', color: Rgb = INK): void {
    for (const line of lines) {
      this.ensure(leading);
      this.page.text(x, this.y, line, size, font, color);
      this.y -= leading;
    }
  }
}

// ---------------------------------------------------------------------------
// Page 1
// ---------------------------------------------------------------------------

function drawHeader(page: PdfPage, doc: PdfDocument, input: ProgressReportInput, brand: Rgb): number {
  const bandHeight = 92;
  const top = PAGE_HEIGHT;
  page.rect(0, top - bandHeight, PAGE_WIDTH, bandHeight, { fill: brand });
  // A darker strip along the band's foot, for depth without a gradient.
  page.rect(0, top - bandHeight, PAGE_WIDTH, 4, { fill: shade(brand, 0.25) });

  // The logo on a white tile, so any mark reads on any palette; without a PNG,
  // the organization's initials in its colour.
  const tile = 56;
  const tileX = MARGIN;
  const tileY = top - bandHeight / 2 - tile / 2 + 2;
  page.roundedRect(tileX, tileY, tile, tile, 10, { fill: WHITE });
  if (input.logo) {
    const name = doc.addImage(input.logo);
    const inner = tile - 10;
    const ratio = input.logo.width / input.logo.height;
    const w = ratio >= 1 ? inner : inner * ratio;
    const h = ratio >= 1 ? inner / ratio : inner;
    page.image(name, tileX + (tile - w) / 2, tileY + (tile - h) / 2, w, h);
  } else {
    const letters = initials(input.organizationName);
    page.textCentered(tileX + tile / 2, tileY + tile / 2 - 7, letters, 20, 'bold', brand);
  }

  const textX = tileX + tile + 16;
  const nameWidth = PAGE_WIDTH - MARGIN - textX - 150;
  page.text(textX, top - 42, fit(input.organizationName, 17, nameWidth, 'bold'), 17, 'bold', WHITE);
  page.text(textX, top - 60, 'Progress report', 11, 'regular', tint(WHITE, 1));

  page.textRight(PAGE_WIDTH - MARGIN, top - 42, 'Generated', 8, 'regular', tint(brand, 0.25));
  page.textRight(PAGE_WIDTH - MARGIN, top - 56, longDate(input.generatedOn), 10, 'bold', WHITE);

  // The student and the range.
  let y = top - bandHeight - 34;
  const student = input.progress.student;
  page.text(MARGIN, y, fit(student.full_name, 22, CONTENT_WIDTH, 'bold'), 22, 'bold', INK);
  y -= 17;
  const course = student.current_math_course ? `  ·  Currently: ${student.current_math_course}` : '';
  page.text(
    MARGIN,
    y,
    fit(`Lessons from ${longDate(input.from)} to ${longDate(input.to)}${course}`, 10, CONTENT_WIDTH),
    10,
    'regular',
    MUTED,
  );
  return y - 22;
}

function statusBadge(page: PdfPage, rightX: number, y: number, status: ProgressStatus): void {
  const label = PROGRESS_STATUS_LABELS[status];
  const width = textWidth(label, 9, 'bold') + 16;
  const colors = STATUS_COLORS[status];
  page.roundedRect(rightX - width, y - 5, width, 17, 8.5, { fill: colors.fill });
  page.text(rightX - width + 8, y + 0.5, label, 9, 'bold', colors.ink);
}

function drawGoalCard(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const { plan, summary } = input.progress;
  const page = flow.page;
  const innerWidth = CONTENT_WIDTH - 36;
  const badgeRoom = 110;

  const goalLines = plan
    ? wrapText(plan.goal, 14, innerWidth - badgeRoom, 'bold').slice(0, 4)
    : ['No learning plan yet'];
  const target = plan?.target_level_id ? input.labels.get(plan.target_level_id) : undefined;
  const detail = plan
    ? `${longDate(plan.starts_on)} – ${longDate(plan.target_on)}   ·   ${formatCadence(plan.sessions_per_week, plan.session_minutes)}` +
      (plan.target_level_id ? `   ·   towards ${target ? `${target.code} ${target.name}` : plan.target_level_id}` : '')
    : 'The office has not set a plan, so there is no goal, timeline or plan topics to report. The lessons below are the record.';
  const detailLines = wrapText(detail, 9.5, innerWidth, 'regular');

  const height = 30 + goalLines.length * 18 + detailLines.length * 13 + 8;
  const bottom = flow.y - height;
  page.roundedRect(MARGIN, bottom, CONTENT_WIDTH, height, 10, { fill: tint(brand, 0.08), stroke: tint(brand, 0.3), lineWidth: 0.75 });
  page.rect(MARGIN, bottom + 10, 4, height - 20, { fill: brand });

  let y = flow.y - 20;
  page.text(MARGIN + 18, y, 'GOAL', 8, 'bold', brand);
  if (plan) statusBadge(page, PAGE_WIDTH - MARGIN - 16, y - 2, summary.status);
  y -= 19;
  for (const line of goalLines) {
    page.text(MARGIN + 18, y, line, 14, 'bold', INK);
    y -= 18;
  }
  y += 3;
  for (const line of detailLines) {
    page.text(MARGIN + 18, y, line, 9.5, 'regular', MUTED);
    y -= 13;
  }
  flow.y = bottom - 14;
}

function drawStatCards(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const { plan, summary } = input.progress;
  const cards: { label: string; value: string; hint: string }[] = [];
  if (plan) {
    cards.push(
      {
        label: 'Topics mastered',
        value: String(summary.mastered_count),
        hint: `of ${summary.topic_count} in the plan · ${summary.percent}%`,
      },
      {
        label: 'Expected by today',
        value: `${summary.expected_percent}%`,
        hint: `Straight line to ${monthDay(plan.target_on)}`,
      },
    );
  }
  cards.push(
    { label: 'Sessions held', value: String(input.sessionCount), hint: 'in this range' },
    { label: 'Total hours', value: formatHoursMinutes(input.totalMinutes), hint: 'in this range' },
  );

  const gap = 10;
  const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const height = 66;
  const top = flow.y;
  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap);
    flow.page.roundedRect(x, top - height, width, height, 8, { fill: WHITE, stroke: CARD_BORDER, lineWidth: 0.75 });
    flow.page.text(x + 12, top - 17, card.label.toUpperCase(), 7.5, 'bold', MUTED);
    let size = 21;
    while (size > 12 && textWidth(card.value, size, 'bold') > width - 24) size -= 1;
    flow.page.text(x + 12, top - 42, card.value, size, 'bold', brand);
    flow.page.text(x + 12, top - 57, fit(card.hint, 8, width - 24), 8, 'regular', MUTED);
  });
  flow.y = top - height - 14;
}

/** The timeline, as ProgressChart draws it: pace line, the real line stepping at each lesson, today, cancellations. */
function drawChart(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const { plan, summary, timeline, cancellations, today } = input.progress;
  if (!plan) return;

  const panelHeight = 262;
  flow.ensure(panelHeight + 10);
  const page = flow.page;
  const top = flow.y;
  page.roundedRect(MARGIN, top - panelHeight, CONTENT_WIDTH, panelHeight, 10, { fill: WHITE, stroke: CARD_BORDER, lineWidth: 0.75 });
  page.text(MARGIN + 16, top - 22, 'Timeline towards the goal', 12, 'bold', INK);
  page.textRight(PAGE_WIDTH - MARGIN - 16, top - 22, `${summary.percent}% mastered · ${summary.expected_percent}% expected by today`, 8.5, 'regular', MUTED);

  const left = MARGIN + 44;
  const right = PAGE_WIDTH - MARGIN - 40;
  const plotTop = top - 56;
  const plotBottom = top - panelHeight + 56;

  const start = toDay(plan.starts_on);
  const goal = toDay(plan.target_on);
  const now = toDay(today);
  const first = timeline[0] ? toDay(timeline[0].occurred_on) : start;
  const min = Math.min(start, first);
  const max = Math.max(goal, now);
  const x = (day: number) => left + ((day - min) / Math.max(1, max - min)) * (right - left);
  const y = (percent: number) => plotBottom + (percent / 100) * (plotTop - plotBottom);

  // The report's range, shaded where it overlaps the timeline.
  const rangeFrom = Math.max(min, toDay(input.from));
  const rangeTo = Math.min(max, toDay(input.to));
  if (rangeTo >= rangeFrom) {
    page.rect(x(rangeFrom), y(0), Math.max(1.5, x(rangeTo) - x(rangeFrom)), y(100) - y(0), { fill: tint(brand, 0.07) });
  }

  // Gridlines at the quarters, labelled.
  for (const percent of [0, 25, 50, 75, 100]) {
    page.line(left, y(percent), right, y(percent), RULE, 0.5);
    page.textRight(left - 7, y(percent) - 3, `${percent}%`, 7.5, 'regular', MUTED);
  }

  // Month ticks, thinned so labels never collide.
  const ticks: number[] = [];
  const cursor = new Date(min * DAY_MS);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() / DAY_MS <= max) {
    ticks.push(Math.floor(cursor.getTime() / DAY_MS));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const every = Math.max(1, Math.ceil(ticks.length / Math.floor((right - left) / 44)));
  ticks
    .filter((_, index) => index % every === 0)
    .forEach((day) => {
      page.line(x(day), y(0), x(day), y(0) - 3, MUTED, 0.5);
      const date = new Date(day * DAY_MS);
      const label = MONTHS[date.getUTCMonth()]!.slice(0, 3) + (date.getUTCMonth() === 0 ? ` ${date.getUTCFullYear()}` : '');
      page.textCentered(x(day), y(0) - 13, label, 7.5, 'regular', MUTED);
    });

  // Start and goal, named at the top of the plot.
  for (const [day, label, iso] of [[start, 'Start', plan.starts_on], [goal, 'Goal', plan.target_on]] as const) {
    page.line(x(day), y(100) + 6, x(day), y(0), tint(MUTED, 0.5), 0.75);
    const text = `${label} · ${shortDate(iso)}`;
    if (label === 'Start') page.text(x(day), y(100) + 10, text, 7.5, 'bold', MUTED);
    else page.textRight(x(day), y(100) + 10, text, 7.5, 'bold', MUTED);
  }

  // Planned pace: nothing at the start to everything at the goal.
  page.polyline([[x(start), y(0)], [x(goal), y(100)]], PACE, 1.25, { dash: [4, 3] });

  // The real line: flat at the starting share, stepping at each lesson, carried to today.
  const points: [number, number][] = [[x(start), y(summary.start_percent)]];
  for (const point of timeline) {
    const px = x(toDay(point.occurred_on));
    points.push([px, points.at(-1)![1]], [px, y(point.percent)]);
  }
  const end = Math.min(now, max);
  if (end > (timeline.at(-1) ? toDay(timeline.at(-1)!.occurred_on) : start)) points.push([x(end), points.at(-1)![1]]);
  page.polyline([[points[0]![0], y(0)], ...points, [points.at(-1)![0], y(0)]], brand, 0, { closeFill: tint(brand, 0.14) });
  page.polyline(points, brand, 2);

  // Today, when it falls inside the timeline.
  if (now >= start && now <= goal) {
    page.dashedLine(x(now), y(0), x(now), y(100), INK, 0.6, [2, 2]);
    page.text(x(now) + 4, y(100) - 9, 'Today', 7.5, 'bold', INK);
  }

  // Each lesson a dot, shaded by its step towards the goal.
  for (const point of timeline) {
    page.circle(x(toDay(point.occurred_on)), y(point.percent), 3.4, {
      fill: point.goal_rating ? ratingFill(brand, point.goal_rating) : UNSCORED,
      stroke: WHITE,
      lineWidth: 1.2,
    });
  }

  // Cancelled lessons: a small cross on the baseline, fainter while ahead.
  for (const row of cancellations) {
    const cx = x(toDay(row.occurs_on));
    const cy = y(0) + 5;
    const color = row.occurs_on >= today ? tint(MUTED, 0.5) : MUTED;
    page.line(cx - 3, cy - 3, cx + 3, cy + 3, color, 1.1);
    page.line(cx - 3, cy + 3, cx + 3, cy - 3, color, 1.1);
  }

  // The one direct label: where the student is now.
  const [ex, ey] = points.at(-1)!;
  page.text(Math.min(ex + 6, right + 6), ey - 3, `${summary.percent}%`, 9, 'bold', INK);

  // Legend.
  let lx = MARGIN + 16;
  const ly = top - panelHeight + 18;
  const legend = (draw: (x: number) => number, label: string) => {
    const after = draw(lx);
    page.text(after + 5, ly - 3, label, 7.5, 'regular', MUTED);
    lx = after + 5 + textWidth(label, 7.5) + 16;
  };
  legend((at) => {
    page.line(at, ly, at + 16, ly, brand, 2);
    return at + 16;
  }, 'Topics mastered');
  legend((at) => {
    page.dashedLine(at, ly, at + 16, ly, PACE, 1.25, [4, 3]);
    return at + 16;
  }, 'Planned pace');
  legend((at) => {
    ([1, 3, 5] as const).forEach((rating, index) =>
      page.circle(at + 4 + index * 6, ly, 3, { fill: ratingFill(brand, rating), stroke: WHITE, lineWidth: 0.8 }),
    );
    return at + 20;
  }, 'Lesson, darker = bigger step');
  legend((at) => {
    page.rect(at, ly - 4, 14, 8, { fill: tint(brand, 0.1), stroke: tint(brand, 0.3), lineWidth: 0.5 });
    return at + 14;
  }, 'This report’s range');
  if (cancellations.length > 0) {
    legend((at) => {
      page.line(at, ly - 3, at + 6, ly + 3, MUTED, 1.1);
      page.line(at, ly + 3, at + 6, ly - 3, MUTED, 1.1);
      return at + 6;
    }, 'Cancelled lesson');
  }

  flow.y = top - panelHeight - 14;
}

// ---------------------------------------------------------------------------
// The following pages
// ---------------------------------------------------------------------------

function drawRecommendation(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const plan = input.progress.plan;
  if (!plan) return;
  flow.heading('Recommendation', brand);
  const text = plan.recommendation ?? 'No notes on the course of tutoring.';
  const lines = wrapText(text, 10, CONTENT_WIDTH - 32);
  const font = plan.recommendation ? 'regular' : 'italic';
  const color = plan.recommendation ? INK : MUTED;
  const setBy = `Set by ${plan.created_by_name ?? 'the office'}`;

  if (lines.length <= 40) {
    // A soft card around the text and its byline, measured before it is drawn.
    const height = 16 + lines.length * 14 + 18 + 4;
    flow.ensure(height);
    const top = flow.y + 4;
    flow.page.roundedRect(MARGIN, top - height, CONTENT_WIDTH, height, 8, { fill: SOFT });
    flow.y = top - 20;
    flow.lines(lines, MARGIN + 16, 10, 14, font, color);
    flow.page.text(MARGIN + 16, flow.y - 2, setBy, 8.5, 'italic', MUTED);
    flow.y = top - height - 10;
  } else {
    // Too long for one card: it flows like the lessons do.
    flow.lines(lines, MARGIN, 10, 14, font, color);
    flow.lines([setBy], MARGIN, 8.5, 12, 'italic', MUTED);
    flow.y -= 6;
  }
}

/** A small arrow from one rating to the next: WinAnsi has no arrow glyph. */
function arrow(page: PdfPage, x: number, y: number): void {
  page.line(x, y, x + 9, y, MUTED, 0.8);
  page.polyline([[x + 6, y + 2.5], [x + 9, y], [x + 6, y - 2.5]], MUTED, 0.8);
}

function ratingChip(page: PdfPage, x: number, y: number, rating: Rating | null, brand: Rgb): void {
  if (rating === null) {
    page.roundedRect(x, y - 4, 16, 14, 3, { stroke: CARD_BORDER, lineWidth: 0.6 });
    page.textCentered(x + 8, y, '–', 8, 'bold', MUTED);
    return;
  }
  page.roundedRect(x, y - 4, 16, 14, 3, { fill: ratingFill(brand, rating) });
  page.textCentered(x + 8, y, String(rating), 8, 'bold', ratingInk(rating));
}

function topicLabel(input: ProgressReportInput, topicId: string): { code: string; name: string } {
  const label = input.labels.get(topicId);
  return { code: label?.code ?? topicId, name: label?.name ?? '' };
}

function drawPlanTopics(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const { plan, topics } = input.progress;
  if (!plan) return;
  flow.heading('Plan topics', brand, 60, `${input.progress.summary.mastered_count} of ${topics.length} mastered`);
  if (topics.length === 0) {
    flow.lines(['This plan names no topics; lessons are scored against the goal alone.'], MARGIN, 10, 14, 'italic', MUTED);
    return;
  }

  const colBaseline = PAGE_WIDTH - MARGIN - 190;
  const colNow = colBaseline + 56;
  const colStatus = PAGE_WIDTH - MARGIN;
  const nameX = MARGIN + 8;
  const nameWidth = colBaseline - nameX - 16;

  const header = () => {
    flow.page.rect(MARGIN, flow.y - 6, CONTENT_WIDTH, 18, { fill: SOFT });
    flow.page.text(nameX, flow.y, 'TOPIC', 7.5, 'bold', MUTED);
    flow.page.text(colBaseline - 4, flow.y, 'BASELINE', 7.5, 'bold', MUTED);
    flow.page.text(colNow + 2, flow.y, 'NOW', 7.5, 'bold', MUTED);
    flow.page.textRight(colStatus - 8, flow.y, 'STATUS', 7.5, 'bold', MUTED);
    flow.y -= 22;
  };
  header();

  for (const row of topics) {
    const { code, name } = topicLabel(input, row.topic_id);
    const codeWidth = textWidth(code, 9, 'bold') + 6;
    const nameLines = wrapText(name, 9, nameWidth - codeWidth).slice(0, 3);
    const height = Math.max(1, nameLines.length) * 12 + 8;
    if (flow.y - height < BOTTOM) {
      flow.newPage();
      header();
    }
    const page = flow.page;
    page.text(nameX, flow.y, code, 9, 'bold', INK);
    nameLines.forEach((line, index) => page.text(nameX + codeWidth, flow.y - index * 12, line, 9, 'regular', INK));
    ratingChip(page, colBaseline + 6, flow.y, row.baseline, brand);
    arrow(page, colBaseline + 28, flow.y + 3);
    ratingChip(page, colNow + 4, flow.y, row.current, brand);
    const status = row.mastered ? 'Mastered' : row.last_rated_on ? `Rated ${shortDate(row.last_rated_on)}` : 'Not yet';
    page.textRight(colStatus - 8, flow.y, status, 8.5, row.mastered ? 'bold' : 'regular', row.mastered ? STATUS_COLORS.ahead.ink : MUTED);
    flow.y -= height;
    page.line(MARGIN, flow.y + 9, PAGE_WIDTH - MARGIN, flow.y + 9, RULE, 0.4);
  }

  // The scale, once.
  flow.y -= 4;
  flow.ensure(16);
  let x = MARGIN + 8;
  for (const rating of [1, 2, 3, 4, 5] as const) {
    ratingChip(flow.page, x, flow.y, rating, brand);
    flow.page.text(x + 20, flow.y, TOPIC_RATING_LABELS[rating], 7.5, 'regular', MUTED);
    x += 24 + textWidth(TOPIC_RATING_LABELS[rating], 7.5) + 12;
  }
  flow.y -= 20;
}

// ---------------------------------------------------------------------------
// The calendar: every month of the range, its days marked from the schedules
// ---------------------------------------------------------------------------

const CANCELLED_INK: Rgb = [0.75, 0.2, 0.18];
const CANCELLED_FILL: Rgb = [0.99, 0.91, 0.9];
const CAL_COLUMNS = 3;
const CAL_GAP = 18;
const CAL_CELL_HEIGHT = 17;
const CAL_MONTH_HEIGHT = 16 + 13 + 6 * CAL_CELL_HEIGHT;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function drawCalendarDay(page: PdfPage, cx: number, cy: number, day: number, mark: CalendarMark | undefined, inRange: boolean, brand: Rgb): void {
  const label = String(day);
  const baseline = cy - 2.6;
  if (mark === 'held') {
    page.circle(cx, cy, 7.4, { fill: brand });
    page.textCentered(cx, baseline, label, 7.5, 'bold', WHITE);
  } else if (mark === 'cancelled') {
    page.circle(cx, cy, 7.4, { fill: CANCELLED_FILL, stroke: CANCELLED_INK, lineWidth: 0.8 });
    page.textCentered(cx, baseline, label, 7.5, 'bold', CANCELLED_INK);
    page.line(cx - 5.2, cy - 5.2, cx + 5.2, cy + 5.2, CANCELLED_INK, 0.9);
  } else if (mark === 'scheduled') {
    page.circle(cx, cy, 7.4, { fill: WHITE, stroke: brand, lineWidth: 1 });
    page.textCentered(cx, baseline, label, 7.5, 'bold', INK);
  } else {
    page.textCentered(cx, baseline, label, 7.5, 'regular', inRange ? INK : UNSCORED);
  }
}

function drawCalendar(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const marks = [...input.calendar.values()];
  const count = (kind: CalendarMark) => marks.filter((mark) => mark === kind).length;
  const today = input.generatedOn;
  const held = count('held');
  const cancelled = count('cancelled');
  const scheduled = count('scheduled');
  flow.heading('Calendar', brand, CAL_MONTH_HEIGHT + 30, `${held} held  ·  ${cancelled} cancelled  ·  ${scheduled} scheduled, not recorded`);

  // The legend, under the heading.
  let lx = MARGIN;
  const ly = flow.y + 2;
  const legend = (mark: CalendarMark, label: string) => {
    drawCalendarDay(flow.page, lx + 7.4, ly, 8, mark, true, brand);
    flow.page.text(lx + 19, ly - 2.6, label, 7.5, 'regular', MUTED);
    lx += 19 + textWidth(label, 7.5) + 18;
  };
  legend('held', 'Lesson held');
  legend('cancelled', 'Cancelled');
  legend('scheduled', today < input.to ? 'Scheduled, not recorded or still to come' : 'Scheduled, not recorded');
  flow.y -= 20;

  const [fromYear, fromMonth] = input.from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = input.to.split('-').map(Number) as [number, number];
  const months: { year: number; month: number }[] = [];
  for (let year = fromYear, month = fromMonth; year < toYear || (year === toYear && month <= toMonth); ) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const monthWidth = (CONTENT_WIDTH - CAL_GAP * (CAL_COLUMNS - 1)) / CAL_COLUMNS;
  const cellWidth = monthWidth / 7;
  for (let row = 0; row < months.length; row += CAL_COLUMNS) {
    flow.ensure(CAL_MONTH_HEIGHT + 8);
    const top = flow.y;
    months.slice(row, row + CAL_COLUMNS).forEach(({ year, month }, column) => {
      const left = MARGIN + column * (monthWidth + CAL_GAP);
      const page = flow.page;
      page.text(left + 3, top, `${MONTHS[month - 1]} ${year}`, 9, 'bold', INK);
      WEEKDAYS.forEach((name, index) =>
        page.textCentered(left + cellWidth * (index + 0.5), top - 15, name.slice(0, 2), 6.5, 'regular', MUTED),
      );
      page.line(left, top - 19, left + monthWidth, top - 19, RULE, 0.5);
      const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        const slot = firstWeekday + day - 1;
        const cx = left + cellWidth * ((slot % 7) + 0.5);
        const cy = top - 29 - Math.floor(slot / 7) * CAL_CELL_HEIGHT;
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        drawCalendarDay(page, cx, cy, day, input.calendar.get(iso), iso >= input.from && iso <= input.to, brand);
      }
    });
    flow.y = top - CAL_MONTH_HEIGHT - 8;
  }
}

const PART_LABEL_WIDTH = 118;

function drawSessions(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  const shown = input.sessions.length;
  const subtitle =
    `${input.sessionCount} in this range, newest first` +
    (shown < input.sessionCount ? ` · the latest ${shown} listed` : '');
  flow.heading('Sessions', brand, 60, subtitle);

  if (shown === 0) {
    flow.lines(['No lessons were recorded in this range.'], MARGIN, 10, 14, 'italic', MUTED);
    return;
  }

  const textX = MARGIN + PART_LABEL_WIDTH;
  const textWidthMax = PAGE_WIDTH - MARGIN - textX;

  for (const session of input.sessions) {
    const parts: { label: string; text: string; status?: string | null }[] = [];
    if (session.notes) parts.push({ label: 'Covered', text: session.notes });
    for (const part of SESSION_WRITE_UP_PARTS) {
      if (part.key === 'homework_review') {
        const status = session.homework_status ? HOMEWORK_STATUS_LABELS[session.homework_status] : null;
        if (session.homework_review || status) {
          parts.push({ label: part.label, text: session.homework_review ?? '', status });
        }
        continue;
      }
      const text = session[part.key];
      if (text) parts.push({ label: part.label, text });
    }

    // Keep the lesson's heading with its first lines.
    flow.ensure(54);
    const page = flow.page;
    page.rect(MARGIN, flow.y - 7, CONTENT_WIDTH, 20, { fill: tint(brand, 0.07) });
    page.text(MARGIN + 8, flow.y, lessonDate(session.occurred_on), 10, 'bold', INK);
    const place = session.mode === 'in_person' ? 'In person' : 'Online';
    const meta =
      `${timeRange(session.started_at, session.ended_at)}  ·  ${formatDuration(session.duration_minutes)}  ·  ` +
      `${session.tutor_name}  ·  ${place}${session.location_name ? `, ${session.location_name}` : ''}`;
    page.textRight(PAGE_WIDTH - MARGIN - 8, flow.y, fit(meta, 8.5, CONTENT_WIDTH - 130), 8.5, 'regular', MUTED);
    flow.y -= 24;

    if (parts.length === 0) {
      flow.lines(['No notes were written for this lesson.'], textX, 9, 12, 'italic', MUTED);
    }
    for (const part of parts) {
      const lines = part.text ? wrapText(part.text, 9.5, textWidthMax) : [];
      const labelLines = wrapText(part.label.toUpperCase(), 7, PART_LABEL_WIDTH - 14, 'bold');
      flow.ensure(Math.max(13, labelLines.length * 9));
      const labelTop = flow.y;
      const labelPage = flow.page;
      labelLines.forEach((line, index) => flow.page.text(MARGIN + 8, labelTop - index * 9 + 1, line, 7, 'bold', brand));
      // The homework's status leads its review, as the portal shows it.
      if (part.status) flow.lines([`Status: ${part.status}`], textX, 9.5, 13, 'bold', INK);
      if (lines.length > 0) flow.lines(lines, textX, 9.5, 13, 'regular', INK);
      else if (!part.status) flow.y -= 13;
      // A label wrapped to two lines beside a one-line part still needs its room.
      // (Only while still on the label's page: a part that ran on has room enough.)
      if (flow.page === labelPage) flow.y = Math.min(flow.y, labelTop - labelLines.length * 9 - 2);
      flow.y -= 4;
    }
    flow.y -= 8;
  }
}

function drawOriginal(flow: Flow, input: ProgressReportInput, brand: Rgb): void {
  if (input.original === undefined) return;
  flow.heading('Original assessment', brand, 80);
  const assessment = input.original;
  if (!assessment) {
    flow.lines(['No assessment has been recorded for this student.'], MARGIN, 10, 14, 'italic', MUTED);
    return;
  }

  const level = assessment.recommended_level_id ? input.labels.get(assessment.recommended_level_id) : undefined;
  const facts: [string, string][] = [
    ['Assessed on', longDate(assessment.assessed_on)],
    ['Assessed by', assessment.assessor_name ?? 'The office'],
    ['Recommended level', assessment.recommended_level_id ? (level ? `${level.code} ${level.name}` : assessment.recommended_level_id) : 'None given'],
    ['School course', assessment.school_course ?? 'Not recorded'],
  ];
  const half = CONTENT_WIDTH / 2;
  flow.ensure(64);
  facts.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * half;
    const y = flow.y - Math.floor(index / 2) * 30;
    flow.page.text(x, y, label.toUpperCase(), 7, 'bold', MUTED);
    flow.page.text(x, y - 13, fit(value, 10, half - 16), 10, 'regular', INK);
  });
  flow.y -= 64;

  if (assessment.summary) {
    flow.ensure(30);
    flow.page.text(MARGIN, flow.y, 'SUMMARY', 7, 'bold', MUTED);
    flow.y -= 14;
    flow.lines(wrapText(assessment.summary, 10, CONTENT_WIDTH), MARGIN, 10, 14);
    flow.y -= 8;
  }

  if (assessment.ratings.length > 0) {
    flow.ensure(40);
    flow.page.text(MARGIN, flow.y, 'TOPIC RATINGS', 7, 'bold', MUTED);
    flow.y -= 16;
    for (const rating of assessment.ratings) {
      const { code, name } = topicLabel(input, rating.topic_id);
      flow.ensure(18);
      const page = flow.page;
      ratingChip(page, MARGIN, flow.y, rating.rating, brand);
      page.text(MARGIN + 24, flow.y, code, 9, 'bold', INK);
      const codeWidth = textWidth(code, 9, 'bold') + 6;
      page.text(MARGIN + 24 + codeWidth, flow.y, fit(name, 9, CONTENT_WIDTH - 150 - codeWidth), 9, 'regular', INK);
      page.textRight(PAGE_WIDTH - MARGIN, flow.y, TOPIC_RATING_LABELS[rating.rating], 8.5, 'regular', MUTED);
      flow.y -= 18;
    }
  }
}

/** The footer, once every page exists: organization · Progress report · Page n of m. */
function drawFooters(doc: PdfDocument, input: ProgressReportInput): void {
  const pages = doc.allPages;
  pages.forEach((page, index) => {
    page.line(MARGIN, 40, PAGE_WIDTH - MARGIN, 40, RULE, 0.5);
    page.text(MARGIN, 27, fit(`${input.organizationName}  ·  Progress report  ·  ${input.progress.student.full_name}`, 8, CONTENT_WIDTH - 90), 8, 'regular', MUTED);
    page.textRight(PAGE_WIDTH - MARGIN, 27, `Page ${index + 1} of ${pages.length}`, 8, 'regular', MUTED);
  });
}

/** Builds the report. */
export async function buildProgressReportPdf(input: ProgressReportInput): Promise<Uint8Array> {
  const brand = hexToRgb(input.paletteHex);
  const student = input.progress.student.full_name;
  const doc = new PdfDocument(`Progress report: ${student}`);
  const first = doc.addPage();
  const y = drawHeader(first, doc, input, brand);
  const flow = new Flow(doc, `${student}  ·  Progress report  ·  ${shortDate(input.from)} - ${shortDate(input.to)}`, first, y);

  drawGoalCard(flow, input, brand);
  drawStatCards(flow, input, brand);
  drawChart(flow, input, brand);

  // With a plan, the rest starts on its own page: page 1 is the picture, the
  // rest the record. Without one there is no picture, and the lessons follow on.
  if (input.progress.plan) flow.newPage();
  drawRecommendation(flow, input, brand);
  drawPlanTopics(flow, input, brand);
  drawCalendar(flow, input, brand);
  drawSessions(flow, input, brand);
  drawOriginal(flow, input, brand);
  drawFooters(doc, input);

  return doc.save();
}
