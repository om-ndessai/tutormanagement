import { z } from 'zod';
import { refuseSsn } from './tax.js';
import { USER_ROLES, type UserRole, optionalText } from './users.js';

// ---------------------------------------------------------------------------
// Organizations (docs/multi-organization.md)
// ---------------------------------------------------------------------------
// A tutoring business on the platform. Platform admins create and brand them;
// inside one, the portal works exactly as it did for a single institute.

/**
 * The palettes an organization may wear. Each is a `:root[data-palette]` block
 * in apps/web/src/index.css, light and dark. `plum` is the Mathematics
 * Institute of the Triangle's own and goes with its built-in logo.
 */
export const ORG_PALETTES = [
  'platform',
  'indigo',
  'teal',
  'forest',
  'crimson',
  'amber',
  'plum',
] as const;
export type OrgPalette = (typeof ORG_PALETTES)[number];

export const ORG_PALETTE_LABELS: Record<OrgPalette, string> = {
  platform: 'Slate',
  indigo: 'Indigo',
  teal: 'Teal',
  forest: 'Forest',
  crimson: 'Crimson',
  amber: 'Amber',
  plum: 'Plum',
};

/**
 * Each palette's brand-700 as hex, for the few places that cannot read a CSS
 * variable: the browser's theme-color and the drawn favicon.
 */
export const ORG_PALETTE_HEX: Record<OrgPalette, string> = {
  platform: '#30577D',
  indigo: '#3A3FB0',
  teal: '#0B5F68',
  forest: '#22603A',
  crimson: '#9B2335',
  amber: '#8A4B08',
  plum: '#773C7D',
};

/** Logos shipped with the app rather than uploaded. Platform admins only. */
export const BUILTIN_LOGOS = ['institute'] as const;
export type BuiltinLogo = (typeof BUILTIN_LOGOS)[number];

export const LOGO_KINDS = ['mark', 'full'] as const;
export type LogoKind = (typeof LOGO_KINDS)[number];

/** PNG or WebP only: an SVG served from the portal's address can carry script. */
export const LOGO_CONTENT_TYPES = ['image/png', 'image/webp'] as const;
export type LogoContentType = (typeof LOGO_CONTENT_TYPES)[number];
export const MAX_LOGO_BYTES = 256 * 1024;

/** The request header, and the query parameter on links, naming the organization. */
export const ORG_HEADER = 'X-Organization';
export const ORG_QUERY_PARAM = 'org';
/** Remembers the last organization chosen, for the next visit and the sign-in page. */
export const LAST_ORG_COOKIE = 'tmi_last_org';

/** Fixed until each organization's own clock is offered; see organizations.time_zone. */
export const DEFAULT_ORG_TIME_ZONE = 'America/New_York';

/**
 * The time zones an organization may record its lessons against. A short,
 * deliberate list rather than every IANA name: each one is a promise that the
 * portal's calendar arithmetic has been looked at for it.
 */
export const ORG_TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const;
export type OrgTimeZone = (typeof ORG_TIME_ZONES)[number];

export const ORG_TIME_ZONE_LABELS: Record<OrgTimeZone, string> = {
  'America/New_York': 'Eastern',
  'America/Chicago': 'Central',
  'America/Denver': 'Mountain',
  'America/Phoenix': 'Arizona',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'Pacific/Honolulu': 'Hawaii',
};

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export const orgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'At least 2 characters.')
  .max(40, 'At most 40 characters.')
  .regex(SLUG_PATTERN, 'Lower-case letters, digits and hyphens; no hyphen at either end.');

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

/**
 * What a platform admin sets: identity and look. The organization's own admins
 * set its payer details on the Organization settings page.
 */
export const organizationFieldsSchema = z.object({
  name: text(120, 'Name').min(1, 'Name is required.'),
  short_name: text(40, 'Short name').min(1, 'Short name is required.'),
  slug: orgSlugSchema,
  tagline: optionalText(text(120, 'Tagline')),
  blurb: optionalText(text(400, 'Description')),
  place: optionalText(text(120, 'Place')),
  palette: z.enum(ORG_PALETTES),
  builtin_logo: z.enum(BUILTIN_LOGOS).nullable(),
  time_zone: z.enum(ORG_TIME_ZONES),
});

export const createOrganizationSchema = organizationFieldsSchema.extend({
  palette: z.enum(ORG_PALETTES).default('platform'),
  builtin_logo: z.enum(BUILTIN_LOGOS).nullable().default(null),
  time_zone: z.enum(ORG_TIME_ZONES).default(DEFAULT_ORG_TIME_ZONE),
});
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
export type CreateOrganizationPayload = z.output<typeof createOrganizationSchema>;

/** PATCH: no defaults survive `.partial()`, so an omitted key is left alone. */
export const updateOrganizationSchema = organizationFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>;
export type UpdateOrganizationPayload = z.output<typeof updateOrganizationSchema>;

const state = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use the two-letter state code.');

/**
 * The payer box on every 1099 the organization issues. The TIN is NOT an SSN:
 * it runs through optionalText, so the SSN guard refuses one, which is exactly
 * the case of a sole proprietor that must still be refused.
 */
export const organizationSettingsSchema = z.object({
  tin: optionalText(text(40, 'TIN')),
  payer_address_line1: optionalText(text(120, 'Address')),
  payer_address_line2: optionalText(text(120, 'Address')),
  payer_city: optionalText(text(80, 'City')),
  payer_state: optionalText(state),
  payer_postal_code: optionalText(
    text(10, 'ZIP code').regex(/^\d{5}(-\d{4})?$/, 'Use a 5-digit ZIP code.'),
  ),
});
export const updateOrganizationSettingsSchema = organizationSettingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type UpdateOrganizationSettingsInput = z.input<typeof updateOrganizationSettingsSchema>;
export type UpdateOrganizationSettingsPayload = z.output<typeof updateOrganizationSettingsSchema>;

/** An organization's public face: what anyone shown it may see. */
export interface OrganizationBrand {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  tagline: string | null;
  blurb: string | null;
  place: string | null;
  palette: OrgPalette;
  builtin_logo: BuiltinLogo | null;
  /** Versioned URLs, or null when no logo of that kind was uploaded. */
  logo_mark_url: string | null;
  logo_full_url: string | null;
}

/** The organization a request runs in, as its members see it. */
export interface Organization extends OrganizationBrand {
  time_zone: OrgTimeZone;
  calendar_domain: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The payer details, readable by the organization's admins only. */
export interface OrganizationSettings {
  tin: string | null;
  payer_address_line1: string | null;
  payer_address_line2: string | null;
  payer_city: string | null;
  payer_state: string | null;
  payer_postal_code: string | null;
}

/** One organization the signed-in person belongs to, for the picker and switcher. */
export interface Membership extends OrganizationBrand {
  roles: UserRole[];
  status: 'active' | 'suspended';
  /** The organization the person lands in on signing in. At most one is. */
  is_default: boolean;
}

/**
 * Choosing where to land on signing in, for someone in several organizations.
 * `null` clears it: they land wherever they were last, or choose.
 */
export const defaultOrganizationSchema = z.object({
  slug: orgSlugSchema.nullable(),
});
export type DefaultOrganizationInput = z.input<typeof defaultOrganizationSchema>;

/** An organization that has invited the signed-in person, pending their answer. */
export interface Invitation extends OrganizationBrand {
  roles: UserRole[];
  invited_at: string;
}

/** A row on the platform console's organizations list. */
export interface OrganizationListItem extends Organization {
  admin_count: number;
  member_count: number;
}

/** An organization's admin, as the platform console shows them. */
export interface OrganizationAdmin {
  user_id: string;
  full_name: string;
  email: string | null;
  status: 'active' | 'invited' | 'suspended';
}

export const addOrganizationAdminSchema = z.object({
  email: z.email({ message: 'Enter a valid email address.' }).trim().toLowerCase().max(254),
  full_name: refuseSsn(text(120, 'Name').min(1, 'Name is required.')),
});
export type AddOrganizationAdminInput = z.input<typeof addOrganizationAdminSchema>;
export type AddOrganizationAdminPayload = z.output<typeof addOrganizationAdminSchema>;

export const addPlatformAdminSchema = addOrganizationAdminSchema;
export type AddPlatformAdminInput = AddOrganizationAdminInput;

export interface PlatformAdmin {
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
}

/** A platform admin correcting the shared fields of someone in several organizations. */
export const platformPersonUpdateSchema = z
  .object({
    full_name: text(120, 'Name').min(1, 'Name is required.'),
    email: z.email({ message: 'Enter a valid email address.' }).trim().toLowerCase().max(254),
    phone: optionalText(text(32, 'Phone').regex(/^[0-9+().\-\s]*$/, 'Digits and + ( ) - . only.')),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type PlatformPersonUpdateInput = z.input<typeof platformPersonUpdateSchema>;

export const platformPersonLookupSchema = z.object({
  email: z.email({ message: 'Enter a valid email address.' }).trim().toLowerCase().max(254),
});

/** A person as the platform console sees them: the shared fields and nothing else. */
export interface PlatformPerson {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  google_sub_pinned: boolean;
  organization_count: number;
}

export const ROLES_IN_ORG = USER_ROLES;
