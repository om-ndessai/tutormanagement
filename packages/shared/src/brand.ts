import type { BuiltinLogo, OrganizationBrand, OrgPalette } from './organizations.js';

/**
 * Who the portal says it is.
 *
 * On the tutoring platform the identity is DATA: each organization's name,
 * palette and logo, from its row, chosen at runtime by the organization a
 * request names. Before any organization is known -- the sign-in page with no
 * remembered choice, the platform console -- the portal wears the neutral
 * platform brand, never an organization's.
 */
export interface Brand {
  /** The organization's slug, or null for the platform itself. */
  slug: string | null;
  /** Full name, for page copy and printed documents. */
  name: string;
  /** Short name for tight spaces, like the sidebar header. */
  short: string;
  tagline: string;
  /** The line under the tagline on the sign-in panel. */
  blurb: string;
  /** Where the organization is, for the sign-in page. A platform is nowhere in particular. */
  place?: string;
  palette: OrgPalette;
  builtin_logo: BuiltinLogo | null;
  logo_mark_url: string | null;
  logo_full_url: string | null;
}

/** The tutoring platform's own identity: neutral, the frame every organization sits in. */
export const PLATFORM_BRAND: Brand = {
  slug: null,
  name: 'Tutor Portal',
  short: 'Tutor Portal',
  tagline: 'Every lesson, in one place',
  blurb:
    'Sessions, schedules, progress and payments for tutoring organizations — each ' +
    'with its own people, its own records and its own look.',
  palette: 'platform',
  builtin_logo: null,
  logo_mark_url: null,
  logo_full_url: null,
};

/** An organization's public row, as the brand every component reads. */
export function brandFromOrganization(org: OrganizationBrand | null | undefined): Brand {
  if (!org) return PLATFORM_BRAND;
  return {
    slug: org.slug,
    name: org.name,
    short: org.short_name,
    tagline: org.tagline ?? '',
    blurb: org.blurb ?? '',
    place: org.place ?? undefined,
    palette: org.palette,
    builtin_logo: org.builtin_logo,
    logo_mark_url: org.logo_mark_url,
    logo_full_url: org.logo_full_url,
  };
}
