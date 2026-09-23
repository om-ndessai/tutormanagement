/**
 * Today as YYYY-MM-DD on the reader's own calendar, for a form's default date.
 * Not toISOString(), which is UTC and hands an evening user tomorrow.
 */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
