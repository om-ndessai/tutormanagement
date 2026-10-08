/**
 * Builds a query string, skipping empty/undefined values. Hand-written rather than
 * URLSearchParams, whose React Native implementation is incomplete.
 * Same contract as `toQueryString` in apps/web/src/lib/api-client.ts.
 */
export function toQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
