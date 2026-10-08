// Ported from apps/web/src/features/teaching/session-notes.tsx (AssessButton) and
// session-reflection.tsx (ReflectButton) @ 1132322: a lesson's two "what did you think" actions,
// on its card and its detail. Neither carries money: both are read on the Tutoring tab.
import type { TutoringSession, User } from '@tmi/shared';
import { router } from 'expo-router';
import { Button } from 'react-native-paper';

import { useAuth } from '@/providers/auth-provider';
import { firstName, likelyReflectorRole, mayChangeReflection } from './reflection-logic';

type Lesson = Pick<
  TutoringSession,
  'id' | 'student_user_id' | 'tutor_user_id' | 'money_view' | 'reflection' | 'student_name' | 'assessments'
>;

/**
 * "Assess", or "Your assessment" once given; null for the lesson's own student, who reflects on it
 * instead (Phase 25) -- the API refuses a student's new assessment.
 */
export function assessLabel(session: Lesson, user: Pick<User, 'id'> | null) {
  if (!user || session.student_user_id === user.id) return null;
  const mine = session.assessments.some((row) => row.author_user_id === user.id);
  return mine
    ? { label: 'Your assessment', a11y: 'Edit your assessment' }
    : { label: 'Assess', a11y: 'Assess this session' };
}

/**
 * The reflection's way in: "Reflect" for the student, "Add/Edit reflection" for an adult entering
 * it with them; null for anybody who may not change it -- including an adult once the student
 * has entered it themselves (the server holds the same line).
 */
export function reflectLabel(session: Lesson, user: Pick<User, 'id'> | null) {
  if (!user || !mayChangeReflection(session, user)) return null;
  const forStudent = likelyReflectorRole(session, user) === 'student';
  const name = firstName(session.student_name);
  if (forStudent) {
    return session.reflection
      ? { label: 'Your reflection', a11y: 'Edit your reflection' }
      : { label: 'Reflect', a11y: 'Reflect on this session' };
  }
  return session.reflection
    ? { label: 'Edit reflection', a11y: `Edit ${name}’s reflection` }
    : { label: `Add ${name}’s reflection`, a11y: `Add ${name}’s reflection` };
}

export function AssessButton({
  session,
  testID,
  compact = false,
}: {
  session: Lesson;
  testID: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const action = assessLabel(session, user);
  if (!action) return null;
  return (
    <Button
      testID={testID}
      mode={compact ? 'text' : 'outlined'}
      compact={compact}
      icon="message-text-outline"
      accessibilityLabel={action.a11y}
      onPress={() => router.push({ pathname: '/assess-session', params: { session: session.id } })}
      contentStyle={{ minHeight: 44 }}
    >
      {action.label}
    </Button>
  );
}

export function ReflectButton({
  session,
  testID,
  compact = false,
}: {
  session: Lesson;
  testID: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const action = reflectLabel(session, user);
  if (!action) return null;
  return (
    <Button
      testID={testID}
      mode={compact ? 'text' : 'outlined'}
      compact={compact}
      icon="emoticon-happy-outline"
      accessibilityLabel={action.a11y}
      onPress={() => router.push({ pathname: '/reflection', params: { session: session.id } })}
      contentStyle={{ minHeight: 44 }}
    >
      {action.label}
    </Button>
  );
}
