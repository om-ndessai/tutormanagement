// The welcome and the point's flight in a student's Question Quest (owner, 2026-10-21), at parity with
// apps/web/src/features/quest/quest-welcome.tsx (working tree): whether the welcome opens, its title,
// line and numbers, and where the "+1" flies from and to. Pure: no React, no api client.
import {
  QUEST_LEFT_CAP,
  QUEST_POINTS,
  questLevelLabel,
  questWelcome,
  type QuestState,
  type QuestSummary,
} from '@tmi/shared';

/** The welcome's numbers, in the order they are shown. */
export interface WelcomeStat {
  key: 'points' | 'answered' | 'approved' | 'today' | 'left';
  label: string;
  value: string;
}

export interface WelcomeContent {
  title: string;
  line: string;
  /** "🔥 3 days", only while there is a streak. */
  streak: string | null;
  stats: WelcomeStat[];
}

/** "200+" at the cap, the count below it. */
export function leftLabel(left: number): string {
  return left >= QUEST_LEFT_CAP ? `${QUEST_LEFT_CAP}+` : String(left);
}

export function streakLabel(days: number): string | null {
  if (days <= 0) return null;
  return `🔥 ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function welcomeContent(summary: QuestSummary): WelcomeContent {
  const level = questLevelLabel(summary.level_id);
  const { title, line } = questWelcome(summary, level);
  return {
    title,
    line,
    streak: streakLabel(summary.streak_days),
    stats: [
      { key: 'points', label: 'Points', value: String(summary.points) },
      { key: 'answered', label: 'Answered', value: String(summary.answered) },
      { key: 'approved', label: 'Approved', value: String(summary.confirmed) },
      { key: 'today', label: 'Today', value: String(summary.answered_today) },
      { key: 'left', label: `Left in ${level}`, value: leftLabel(summary.left_in_level) },
    ],
  };
}

/**
 * Whether the welcome opens, once both reads have settled: not when the summary failed, not without a
 * level, not when Quest has nothing left to ask (the finished message says that itself).
 * `undefined` while either read is still out.
 */
export function welcomeDecision({
  summary,
  summaryFailed,
  state,
}: {
  summary: QuestSummary | undefined;
  summaryFailed: boolean;
  state: QuestState | undefined;
}): boolean | undefined {
  if (summaryFailed) return false;
  if (!summary || !state) return undefined;
  if (!summary.level_id || !state.level_id) return false;
  if (state.finished || !state.question) return false;
  return true;
}

/** What one answer earns, as the burst says it: "+1". */
export function burstText(points: number = QUEST_POINTS.student_attempt): string {
  return `+${points}`;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The flight of the "+1", in the frame's own coordinates: from above the middle of Submit to the
 * middle of the header's points. Boxes are window coordinates (measureInWindow); `frame` is the
 * frame's own box, which the burst layer fills.
 */
export function burstPath(
  from: Box,
  to: Box,
  frame: Box,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  return {
    start: { x: from.x + from.width / 2 - frame.x, y: from.y - frame.y },
    end: { x: to.x + to.width / 2 - frame.x, y: to.y + to.height / 2 - frame.y },
  };
}

/** How long the "+1" takes to reach the header; the points tick up as it lands. */
export const BURST_FLIGHT_MS = 700;
