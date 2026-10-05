/**
 * Who the portal says it is.
 *
 * The same build serves every deployment, so the brand is chosen at RUNTIME by
 * the Worker that answers -- never at build time. That is deliberate: a
 * build-time flag could put a demo identity in front of real families the next
 * time somebody deployed from the wrong shell, and the institute's own name is
 * the default rather than something that has to be remembered.
 */
export const BRAND_IDS = ['institute', 'chapel_hill', 'platform'] as const;

export type BrandId = (typeof BRAND_IDS)[number];

export interface Brand {
  id: BrandId;
  /** Full legal-ish name, for page copy and printed documents. */
  name: string;
  /** Short name for tight spaces, like the sidebar header. */
  short: string;
  tagline: string;
  /** The line under the tagline on the sign-in panel. */
  blurb: string;
  /** Where the institute is, for the sign-in page. A platform is nowhere in particular. */
  place?: string;
}

export const BRANDS: Record<BrandId, Brand> = {
  institute: {
    id: 'institute',
    name: 'Mathematics Institute of the Triangle',
    short: 'TMI Portal',
    tagline: 'Exploring the fun of Math',
    blurb:
      'Small classes, advanced-degree instructors, and a curriculum built around problem ' +
      'solving — for grades 1 through 12, in person and online.',
    place: 'Chapel Hill, North Carolina',
  },
  /**
   * Used by the demo deployment only. Its own name, its own mark and its own
   * palette, so nothing of the institute's identity appears in a competition.
   */
  chapel_hill: {
    id: 'chapel_hill',
    name: 'Chapel Hill Math Institute',
    short: 'CHMI Portal',
    tagline: 'Where numbers click',
    blurb:
      'One tutor, one student, one plan at a time — lessons tracked from the first ' +
      'assessment to the goal they were set against.',
    place: 'Chapel Hill, North Carolina',
  },
  /**
   * The tutoring platform's own identity (the `tutoring` deployments): neutral
   * on purpose, because it is the frame every organization will sit inside
   * rather than an organization itself. Each organization's name, logo and
   * palette replace it once that exists (docs/multi-organization.md, Phase 30).
   */
  platform: {
    id: 'platform',
    name: 'Tutor Portal',
    short: 'Tutor Portal',
    tagline: 'Every lesson, in one place',
    blurb:
      'Sessions, schedules, progress and payments for tutoring organizations — each ' +
      'with its own people, its own records and its own look.',
  },
};

/** Falls back to the institute, so a missing or unknown value is never a demo. */
export function resolveBrand(id: string | null | undefined): Brand {
  return BRANDS[(id ?? '') as BrandId] ?? BRANDS.institute;
}
