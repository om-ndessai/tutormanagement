// Ported from apps/web/src/lib/api-client.ts @ 1132322
import { ORG_HEADER, type ApiErrorBody, type ApiErrorCode } from '@tmi/shared';

import { emit } from './events';
import { getActiveOrg } from './organization';
import { androidFallbackOrigin, devUser, serverOrigin } from './server';

/** Honoured by the API only while its sign-in is switched off (local dev, the demo). */
export const DEV_USER_HEADER = 'X-Dev-User';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, string[]> | undefined;

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, string[]>) {
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

/** Once the Android emulator has had to fall back to the host alias, keep using it. */
let useAndroidFallback = false;

export function apiOrigin(): string {
  const fallback = androidFallbackOrigin();
  return useAndroidFallback && fallback ? fallback : serverOrigin();
}

/**
 * The headers every request carries: the organization (the API re-checks membership each
 * time) and, while the server has sign-in off, who to act as. Downloads use these too.
 */
export function requestHeaders(extra?: Record<string, string>): Record<string, string> {
  const org = getActiveOrg();
  const user = devUser();
  return {
    Accept: 'application/json',
    ...(org ? { [ORG_HEADER]: org } : {}),
    ...(user ? { [DEV_USER_HEADER]: user } : {}),
    ...extra,
  };
}

async function send(origin: string, path: string, init: RequestInit): Promise<Response> {
  return fetch(`${origin}/api${path}`, {
    ...init,
    // No cookies: the app never relies on the platform's cookie jar. Identity is the dev
    // header now and a Bearer token from Phase 4.
    credentials: 'omit',
    headers: requestHeaders({
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(apiOrigin(), path, init);
  } catch {
    const fallback = androidFallbackOrigin();
    if (!fallback || useAndroidFallback) {
      throw new ApiRequestError(0, 'internal_error', 'Could not reach the server. Are you online?');
    }
    try {
      response = await send(fallback, path, init);
      useAndroidFallback = true;
    } catch {
      throw new ApiRequestError(0, 'internal_error', 'Could not reach the server. Are you online?');
    }
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) emit('unauthenticated');
    if (isApiErrorBody(payload) && payload.error.code === 'organization_required') {
      emit('organization-required');
    }
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
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  /** Sends raw bytes as the request body -- a logo upload. */
  putBytes: <T>(path: string, bytes: ArrayBuffer, contentType: string) =>
    request<T>(path, {
      method: 'PUT',
      body: bytes as unknown as BodyInit,
      headers: { 'Content-Type': contentType },
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { toQueryString } from './query-string';
