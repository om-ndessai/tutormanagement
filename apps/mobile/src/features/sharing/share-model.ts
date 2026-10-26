// Ported from apps/web/src/features/sharing/share-button.tsx @ 3279506 (who may share, and the name choice)
import { shareText, shareUrl, type PlatformAccount, type Share, type User } from '@tmi/shared';

/**
 * Phase 56 (R22): who sees Share. 13 or over: a student a space added (no platform account) is a
 * child, never offered it (the API refuses them anyway).
 */
export function shareAllowed(user: Pick<User, 'roles'> | null, account: PlatformAccount | null): boolean {
  if (!user) return false;
  return !(user.roles.includes('student') && !account);
}

/** An adult may show their own first name; a 13-17-year-old may not. The server decides again. */
export function mayShowName(user: Pick<User, 'roles'> | null, account: PlatformAccount | null): boolean {
  return account ? account.age_band === 'adult' : !user?.roles.includes('student');
}

/** The public link and the copyable text, on the server the app talks to. */
export function shareLinkAndText(
  share: Pick<Share, 'id' | 'card' | 'first_name'>,
  origin: string,
  brand: string,
): { link: string; text: string } {
  const link = shareUrl(origin, share.id);
  return { link, text: shareText(share, link, brand) };
}
