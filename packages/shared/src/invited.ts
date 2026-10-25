// ---------------------------------------------------------------------------
// The test portal's invited list (Phase 53, docs/test-environment-plan.md)
// ---------------------------------------------------------------------------
// Only `tutoring-test` reads it (SIGNIN_ALLOWLIST "true"); production has no such table. An entry is
// an email, a pattern of one (`*` any run, `?` one character), or a Google account's permanent id.

export interface InvitedEntry {
  email: string | null;
  provider: string | null;
  subject: string | null;
}

/** A pattern's regular expression: `*` any run, `?` one character, everything else literal, case ignored. */
function patternRegExp(pattern: string): RegExp {
  const body = pattern
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`);
}

/** Whether a verified sign-in (its email, and its Google `sub`) is on the list. */
export function invitedMatch(entries: readonly InvitedEntry[], who: { email: string | null; googleSub: string | null }): boolean {
  const email = who.email?.trim().toLowerCase() ?? null;
  return entries.some((entry) => {
    if (entry.provider === 'google' && entry.subject && who.googleSub && entry.subject === who.googleSub) return true;
    return Boolean(entry.email && email && patternRegExp(entry.email).test(email));
  });
}

/** What a refused sign-in is told. */
export const NOT_INVITED_MESSAGE = 'This test portal is by invitation. Ask the owner to add you.';
