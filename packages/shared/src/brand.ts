/**
 * Who the portal says it is.
 *
 * The same build serves every deployment, so the brand is chosen at RUNTIME by
 * the Worker that answers -- never at build time. That is deliberate: a
 * build-time flag could put a demo identity in front of real families the next
 * time somebody deployed from the wrong shell, and the institute's own name is
 * the default rather than something that has to be remembered.
 */
export const BRAND_IDS = ['institute', 'chapel_hill'] as const;

export type BrandId = (typeof BRAND_IDS)[number];

export interface Brand {
  id: BrandId;
  /** Full legal-ish name, for page copy and printed documents. */
  name: string;
  /** Short name for tight spaces, like the sidebar header. */
  short: string;
  tagline: string;
  /** Where the institute is, for the sign-in page. */
  place: string;
}

export const BRANDS: Record<BrandId, Brand> = {
  institute: {
    id: 'institute',
    name: 'Mathematics Institute of the Triangle',
    short: 'TMI Portal',
    tagline: 'Exploring the fun of Math',
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
    place: 'Chapel Hill, North Carolina',
  },
};

/** Falls back to the institute, so a missing or unknown value is never a demo. */
export function resolveBrand(id: string | null | undefined): Brand {
  return BRANDS[(id ?? '') as BrandId] ?? BRANDS.institute;
}
