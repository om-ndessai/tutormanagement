/**
 * Shared response envelope. Every API route returns one of these two shapes so
 * the client only ever needs one unwrap helper.
 */

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface ApiOk<T> {
  data: T;
}

export interface ApiList<T> {
  data: T[];
  meta: ListMeta;
}

export interface ApiErrorBody {
  error: {
    /** Stable, machine-readable code. See ERROR_CODES. */
    code: ApiErrorCode;
    /** Human-readable message, safe to show in the UI. */
    message: string;
    /** Field-level validation problems, keyed by dotted field path. */
    details?: Record<string, string[]>;
  };
}

export const ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'not_found',
  'conflict',
  'internal_error',

  // Authentication and authorization. The UI renders several of these
  // differently, so they are distinct codes rather than one 'unauthorized'.
  'unauthenticated',
  'forbidden',
  'no_account',
  'account_suspended',
  'organization_required',
  'shared_fields_locked',
  'email_unverified',

  // The deployment is missing required configuration. Distinct from
  // internal_error because the fix is a config change, not a code change.
  'not_configured',

  // Phase 36: the AI layer refused or failed a call. Each says why in its
  // message; none carries what was sent or returned.
  'ai_disabled',
  'ai_consent_required',
  'ai_budget_exhausted',
  'ai_refused',
  'ai_failed',

  // Phase 50: a feature set (Tutoring, Assessment, Quest) that is off in this space.
  'feature_unavailable',

  // Phase 51: too many tries this minute, or a space's daily cap reached.
  'rate_limited',

  // Phase 52: a newcomer under 13 (nothing is stored).
  'too_young',

  // Phase 53: the test portal lets in only the people on its invited list.
  'not_invited',

  // Phase 54: a space paid directly has no organization -- no payer, no
  // payments to tutors; and a lesson keeps the model it was recorded under.
  'paid_directly',
  'model_changed',
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];
