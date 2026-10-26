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

/**
 * Whether a verified sign-in is on the list: its provider account's permanent id, or its email.
 * `googleSub` is the Phase 53 shape, kept for the callers that pass it. An Apple relay address is
 * never matched by email (Phase 55): it says nothing about who the person is.
 */
export function invitedMatch(
  entries: readonly InvitedEntry[],
  who: { email: string | null; googleSub?: string | null; provider?: string | null; subject?: string | null },
): boolean {
  const relay = Boolean(who.email && /@privaterelay\.appleid\.com$/i.test(who.email.trim()));
  const email = relay ? null : (who.email?.trim().toLowerCase() ?? null);
  const provider = who.provider ?? (who.googleSub ? 'google' : null);
  const subject = who.subject ?? who.googleSub ?? null;
  return entries.some((entry) => {
    if (entry.provider && entry.subject && provider === entry.provider && subject === entry.subject) return true;
    return Boolean(entry.email && email && patternRegExp(entry.email).test(email));
  });
}

/** What a refused sign-in is told. */
export const NOT_INVITED_MESSAGE = 'This test portal is by invitation. Ask the owner to add you.';
