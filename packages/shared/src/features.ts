import { z } from 'zod';

// ---------------------------------------------------------------------------
// Feature sets (Phase 50, docs/open-signup-plan.md)
// ---------------------------------------------------------------------------
// The product is three sets. Platform admins decide which a space (an
// organization in the code) is ALLOWED; Assessment and Quest also keep the
// space admins' own switch, so a set is ON when it is allowed and, for those
// two, switched on. A set that is off is invisible to every reader there, and
// its routes answer 403 `feature_unavailable` (R23). Its data is kept.

export const FEATURE_SETS = ['tutoring', 'assessment', 'quest'] as const;
export type FeatureSet = (typeof FEATURE_SETS)[number];

export const FEATURE_SET_LABELS: Record<FeatureSet, string> = {
  tutoring: 'Tutoring',
  assessment: 'Assessment',
  quest: 'Quest',
};

export const FEATURE_SET_DESCRIPTIONS: Record<FeatureSet, string> = {
  tutoring: 'Pairings, lessons, schedules, locations, progress, comments, billing and 1099s.',
  assessment: 'Assessments answered by hand on a canvas, with a PDF for the tutor and their review.',
  quest: 'Question Quest and Quest Games on the question bank.',
};

/** The columns that say what a space may use, and the two switches its admins keep. */
export interface FeatureState {
  feature_tutoring: boolean;
  feature_assessment: boolean;
  feature_quest: boolean;
  canvas_assessments: boolean;
  gamify_question_quest: boolean;
}

const ALLOWED_COLUMN: Record<FeatureSet, 'feature_tutoring' | 'feature_assessment' | 'feature_quest'> = {
  tutoring: 'feature_tutoring',
  assessment: 'feature_assessment',
  quest: 'feature_quest',
};

/**
 * Whether platform admins allow this set here. No space: nothing is. A space read from a Worker
 * older than Phase 50 carries no `feature_*` at all, and everything was allowed then, so a missing
 * column counts as allowed (only `false` disallows).
 */
export function featureAllowed(org: Partial<FeatureState> | null | undefined, set: FeatureSet): boolean {
  if (!org) return false;
  return org[ALLOWED_COLUMN[set]] !== false;
}

/** Whether the set is on here: allowed, and for Assessment and Quest switched on by the space's admins. */
export function featureOn(org: Partial<FeatureState> | null | undefined, set: FeatureSet): boolean {
  if (!featureAllowed(org, set)) return false;
  if (set === 'assessment') return Boolean(org?.canvas_assessments);
  if (set === 'quest') return Boolean(org?.gamify_question_quest);
  return true;
}

/** The sets a space is allowed, in order. */
export function allowedFeatureSets(org: Partial<FeatureState> | null | undefined): FeatureSet[] {
  return FEATURE_SETS.filter((set) => featureAllowed(org, set));
}

/**
 * The portal destinations each set owns (both clients' menus, the command palette and deep links).
 * Everything not listed belongs to no set and is always there.
 */
export const FEATURE_SET_PATHS: Record<FeatureSet, readonly string[]> = {
  tutoring: ['/assignments', '/sessions', '/progress', '/schedule', '/locations', '/billing', '/comments'],
  assessment: ['/assessments'],
  quest: ['/quest'],
};

/** The set a portal path belongs to, or null for one that is always there. */
export function featureSetOfPath(path: string): FeatureSet | null {
  for (const set of FEATURE_SETS) {
    if (FEATURE_SET_PATHS[set].some((p) => path === p || path.startsWith(`${p}/`))) return set;
  }
  return null;
}

/** The error code every route of a set that is off answers with (403). */
export const FEATURE_UNAVAILABLE = 'feature_unavailable';

/** The console's change: which sets a space is allowed (PUT /api/platform/organizations/:id/features). */
export const organizationFeaturesSchema = z.object({
  feature_tutoring: z.boolean(),
  feature_assessment: z.boolean(),
  feature_quest: z.boolean(),
  /** Phase 51: whether its Quest reviews approve bank questions for everybody. Left alone when absent. */
  quest_trusted: z.boolean().optional(),
});
export type OrganizationFeaturesInput = z.infer<typeof organizationFeaturesSchema>;

/** "Allowed Assessment; disallowed Tutoring and Quest": the audit line's words. */
export function describeFeatureChange(before: Partial<FeatureState>, after: OrganizationFeaturesInput): string {
  const list = (sets: FeatureSet[]) =>
    sets.length <= 1
      ? (sets[0] ? FEATURE_SET_LABELS[sets[0]] : '')
      : `${sets.slice(0, -1).map((s) => FEATURE_SET_LABELS[s]).join(', ')} and ${FEATURE_SET_LABELS[sets[sets.length - 1]!]}`;
  const allowed = FEATURE_SETS.filter((s) => after[ALLOWED_COLUMN[s]] && !before[ALLOWED_COLUMN[s]]);
  const removed = FEATURE_SETS.filter((s) => !after[ALLOWED_COLUMN[s]] && before[ALLOWED_COLUMN[s]]);
  const parts = [allowed.length ? `allowed ${list(allowed)}` : null, removed.length ? `disallowed ${list(removed)}` : null].filter(
    Boolean,
  ) as string[];
  return parts.length ? parts.join('; ') : 'left its feature sets as they were';
}
