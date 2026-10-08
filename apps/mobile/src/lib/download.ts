// Downloads on the phone: the web's plain `<a href download>` links (CSV exports, calendar files).
// A link cannot carry the app's identity, so the file is fetched with the same headers every API
// request carries (the organization, and the developer identity while sign-in is off), written to
// the cache, handed to the share sheet, and deleted once the sheet closes -- nothing is left on
// the device. The only place outside api-client.ts that calls fetch.
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

/**
 * Fetches `/api<path>` for the active organization and offers it through the share sheet.
 * Resolves once the sheet has closed and the file is gone; throws an ApiRequestError with the
 * server's own words when the request fails.
 */
export async function downloadAndShare(path: string, fallbackName: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api${withOrg(path)}`, {
      credentials: 'omit',
      headers: requestHeaders({ Accept: '*/*' }),
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
