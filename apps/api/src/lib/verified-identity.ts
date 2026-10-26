import type { AuthProvider } from '@tmi/shared';

/**
 * Phase 55: who a provider says somebody is, after their token was verified by
 * that provider's own file (google.ts, microsoft.ts, apple.ts, facebook.ts).
 * Nothing else turns a token into a person, and nothing downstream believes an
 * email that did not come out of one of them.
 */
export interface VerifiedIdentity {
  provider: AuthProvider;
  /** The provider's permanent id for the account: Google `sub`, Microsoft `tid:oid`, Apple `sub`, Facebook's app-scoped id. */
  subject: string;
  /** Lower-cased; null when the provider shared none (Facebook may not). */
  email: string | null;
  /** Whether the provider vouches for the address (see each verifier for when). */
  emailVerified: boolean;
  name: string | null;
}
