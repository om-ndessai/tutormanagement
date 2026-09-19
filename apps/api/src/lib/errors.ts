import type { ApiErrorBody, ApiErrorCode } from '@tmi/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Anything thrown as an ApiError is rendered verbatim to the client, so the
 * message must always be safe to display.
 */
export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: ApiErrorCode;
  readonly details: Record<string, string[]> | undefined;

  constructor(
    status: ContentfulStatusCode,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, 'bad_request', message);
  }

  static validation(message: string, details: Record<string, string[]>): ApiError {
    return new ApiError(422, 'validation_failed', message, details);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'conflict', message);
  }
}

/** True when a D1 write failed a UNIQUE index rather than erroring generically. */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}
