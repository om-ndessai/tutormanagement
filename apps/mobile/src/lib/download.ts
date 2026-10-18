// Downloads on the phone: the web's plain `<a href download>` links (CSV exports, calendar files).
// A link cannot carry the app's identity, so the file is fetched with the same headers every API
// request carries (the organization, and the developer identity while sign-in is off), written to
// the cache, handed to the share sheet, and deleted once the sheet closes -- nothing is left on
// the device. The only place outside api-client.ts that calls fetch. `fetchBytes` fetches the same
// way for a file the app shows itself (an assessment's PDF), and keeps it in memory only.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiOrigin, ApiRequestError, requestHeaders } from './api-client';
import { withOrg } from './organization';

/** `attachment; filename="sessions.csv"` → "sessions.csv", or the fallback. */
export function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = match?.[1] ? decodeURIComponent(match[1]) : fallback;
  // Only a plain file name: never a path.
  return name.replace(/[/\\]/g, '_');
}

const MIME_TYPES: Record<string, { mimeType: string; UTI: string }> = {
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  ics: { mimeType: 'text/calendar', UTI: 'public.calendar-event' },
};

/** The request every download makes: the active organization, the identity, the session cookie. */
async function request(path: string, accept: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api${withOrg(path)}`, {
      // The session cookie goes along, as it does with a link on the web.
      credentials: 'include',
      headers: requestHeaders({ Accept: accept }),
    });
  } catch {
    throw new ApiRequestError(0, 'internal_error', 'Could not reach the server. Are you online?');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiRequestError(
      response.status,
      'internal_error',
      body?.error?.message ?? 'The download failed.',
    );
  }
  return response;
}

/**
 * Fetches `/api<path>` for the active organization and returns its bytes, in memory only: for a
 * file the app shows itself (an assessment's PDF, Phase 38), which is never written to the device
 * or offered to the share sheet.
 */
export async function fetchBytes(path: string, accept = '*/*'): Promise<Uint8Array> {
  const response = await request(path, accept);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Fetches `/api<path>` for the active organization and offers it through the share sheet.
 * Resolves once the sheet has closed and the file is gone; throws an ApiRequestError with the
 * server's own words when the request fails.
 */
export async function downloadAndShare(path: string, fallbackName: string): Promise<void> {
  const response = await request(path, '*/*');
  const text = await response.text();
  const name = filenameFrom(response.headers.get('Content-Disposition'), fallbackName);
  const file = new File(Paths.cache, name);
  try {
    file.create({ overwrite: true });
    file.write(text);
    const extension = name.split('.').pop()?.toLowerCase() ?? '';
    await Sharing.shareAsync(file.uri, { ...MIME_TYPES[extension], dialogTitle: name });
  } finally {
    if (file.exists) file.delete();
  }
}
