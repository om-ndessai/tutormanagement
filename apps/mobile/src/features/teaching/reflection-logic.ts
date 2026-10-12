// Ported from apps/web/src/features/teaching/session-reflection.tsx @ 1132322 (likelyReflectorRole,
// mayChangeReflection, firstName) -- pure, so the sheet and the tests share them.
import type { SessionReflectorRole, TutoringSession, User } from '@tmi/shared';

/**
 * The capacity the reader would type a reflection in, mirroring the API's sessionReflectorRole
 * from what the row already says: `money_view` is 'family' exactly when it is the reader's own
 * lesson or their child's.
 */
export function likelyReflectorRole(
  session: Pick<TutoringSession, 'student_user_id' | 'tutor_user_id' | 'money_view'>,
  user: Pick<User, 'id'>,
): SessionReflectorRole | null {
  if (session.student_user_id === user.id) return 'student';
  if (session.tutor_user_id === user.id) return 'tutor';
  if (session.money_view === 'family') return 'parent';
  return null;
}

/**
 * Whether the reader may change the reflection: anybody who may enter one, except that an adult
 * may not overwrite what the student entered. The API holds the same line; this only hides what
 * it would refuse.
 */
export function mayChangeReflection(
  session: Pick<TutoringSession, 'student_user_id' | 'tutor_user_id' | 'money_view' | 'reflection'>,
  user: Pick<User, 'id'> | null,
): boolean {
  if (!user) return false;
  const role = likelyReflectorRole(session, user);
  if (!role) return false;
  return session.reflection?.entered_as !== 'student' || role === 'student';
}

export function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}
