import type { Organization, OrgTimeZone } from '@tmi/shared';

/**
 * An organization id that came from the request's own organization -- never
 * from a request body or a URL. Every repository function that touches an
 * organization's data takes one, so forgetting the organization is a type
 * error rather than a query that quietly reads every organization at once.
 *
 * Only `requireOrg` (and the cron, which reads it off each row) mint one.
 */
export type OrgId = string & { readonly __brand: 'OrgId' };

/** For the few places that legitimately read an organization id off a row. */
export function orgIdFromRow(id: string): OrgId {
  return id as OrgId;
}

/** The organization a request runs in, as `requireOrg` resolved it. */
export interface OrgContext extends Omit<Organization, 'id' | 'time_zone'> {
  id: OrgId;
  time_zone: OrgTimeZone;
}
