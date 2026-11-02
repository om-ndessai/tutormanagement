// ---------------------------------------------------------------------------
// Anonymous counts (Phase 63, P15 in docs/stickiness-plan.md)
// ---------------------------------------------------------------------------
// What the Play home and guest play count, as Analytics Engine data points: an event's name, the tile,
// the nudge's variant, where it came from, and the client. Never a person, an id, a cookie or an IP;
// no third-party code. The privacy notice says so in its version after 2026-10-31.

export const PLAY_EVENT_NAMES = [
  'home_viewed',
  'tile_started',
  'first_answer',
  'nudge_shown',
  'nudge_accepted',
  'nudge_dismissed',
  'quest_finished',
  'assessment_finished',
  'pool_used_up',
  'locked_tile_tapped',
  'signup_started',
  'signup_finished',
  'ask_grown_up',
  'member_one_tap',
  'family_join',
] as const;
export type PlayEventName = (typeof PLAY_EVENT_NAMES)[number];

export interface PlayEvent {
  name: PlayEventName;
  /** A tile's code ("G4T10"), when the event is about one. */
  tile?: string;
  /** The nudge's variant ("a", "b"), for comparing two wordings or timings. */
  variant?: string;
  /** Where it came from: "tile", "favorite", "continue", "waiting", "nudge", "results", "locked", "home". */
  source?: string;
  client?: 'web' | 'app';
  /** A number when the event carries one (a score, seconds). */
  value?: number;
}

/** The most events one beacon carries. */
export const PLAY_EVENTS_PER_BATCH = 20;
