import { zonedClockParts } from '@tmi/shared';

/**
 * Characters that make a spreadsheet treat a cell as a formula. A field
 * beginning with one of these is prefixed with an apostrophe, which Excel and
 * Sheets both read as "this is text".
 *
 * Without it, a session note typed as "=2+2" becomes a live formula in
 * whoever's spreadsheet, and "=HYPERLINK(...)" becomes something worse. The
 * portal's notes and names are free text, so this is a real path.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = String(value);

  if (FORMULA_LEAD.test(text)) text = `'${text}`;

  // Quote when the value contains a delimiter, a quote or a newline; doubling
  // embedded quotes is how CSV escapes them.
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/** Cents as a bare decimal, so the spreadsheet reads it as a number. */
export function csvMoney(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}

/**
 * Builds a CSV document.
 *
 * Leads with a UTF-8 byte order mark: without it Excel on Windows decodes the
 * file as the local code page and mangles any non-ASCII name. CRLF endings for
 * the same reason.
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeField).join(','), ...rows.map((row) => row.map(escapeField).join(','))];

  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Serves a CSV as a download rather than something the browser renders. */
export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // A point-in-time export; caching would hand back stale figures.
      'Cache-Control': 'no-store',
    },
  });
}

/** "tmi-sessions-2026-09-20.csv", dated on the institute's clock rather than the Worker's. */
export function datedFilename(prefix: string): string {
  return `${prefix}-${zonedClockParts(new Date().toISOString()).day}.csv`;
}
