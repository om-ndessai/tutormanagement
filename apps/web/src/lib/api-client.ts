import type { ApiErrorBody, ApiErrorCode } from '@tmi/shared';

/**
 * Relative on purpose. In production the Worker serves both the API and this
 * SPA from one origin; in development Vite proxies /api to `wrangler dev`.
 */
const API_BASE = '/api';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, string[]> | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level messages for a form, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [field, messages] of Object.entries(this.details ?? {})) {
      if (messages[0]) result[field] = messages[0];
    }
    return result;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.message === 'string'
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError(0, 'internal_error', 'Could not reach the server. Are you online?');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiRequestError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    }
    throw new ApiRequestError(response.status, 'internal_error', 'The request failed.');
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Builds a query string, skipping empty/undefined values. */
export function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
