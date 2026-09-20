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
  'email_unverified',
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];
