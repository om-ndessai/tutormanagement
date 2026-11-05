// The pure parts of the Let in sheet (let-in-sheet.tsx), ported from apps/web/src/features/users/let-in-sheet.tsx
// @ ab71793 so they are tested without a screen: the roles it offers (a parent first; a tutor only where
// Tutoring is on), the one request that lets someone in, and a student's guardians with the new parent added.
import type { CreateUserRequestPayload, JoinRequest, UserDetail } from '@tmi/shared';

import type { GuardianValue } from './person-form-model';

export type LetInRole = 'parent' | 'admin' | 'tutor';

export interface LetInChoice {
  role: LetInRole;
  title: string;
  hint: string;
}

const CHOICES: readonly LetInChoice[] = [
  { role: 'parent', title: 'Parent', hint: 'Their child is, or will be, in this space.' },
  { role: 'admin', title: 'Admin', hint: 'Helps run the space: adds people, starts assessments.' },
  { role: 'tutor', title: 'Tutor', hint: 'Teaches students here.' },
];

/** A parent by default -- the way a code most often arrives. */
export const DEFAULT_LET_IN_ROLE: LetInRole = 'parent';

/** The roles the sheet offers here: Parent and Admin, and Tutor only where Tutoring is on. */
export function letInChoices(tutoring: boolean): LetInChoice[] {
  return CHOICES.filter((choice) => tutoring || choice.role !== 'tutor');
}

/** "Jo" of "Jo Joiner" (the whole name when it is one word). */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * The request the web sends (`POST /users`): the person as Google gave them, in the one role chosen,
 * active at once, tied to their request so the request is answered in the same write.
 */
export function letInRequest(request: JoinRequest, role: LetInRole): CreateUserRequestPayload {
  return {
    full_name: request.full_name,
    email: request.email ?? null,
    phone: null,
    roles: [role],
    status: 'active',
    join_request_user_id: request.user_id,
  } as CreateUserRequestPayload;
}

/**
 * A student's guardians are saved as a whole: the ones they have, and the parent just let in -- primary
 * only when the student had nobody.
 */
export function guardiansWith(student: Pick<UserDetail, 'guardians'>, parentId: string): GuardianValue[] {
  const kept = student.guardians
    .filter((g) => g.user_id !== parentId)
    .map((g) => ({ guardian_user_id: g.user_id, relationship: g.relationship, is_primary: g.is_primary }));
  return [
    ...kept,
    { guardian_user_id: parentId, relationship: 'guardian', is_primary: student.guardians.length === 0 },
  ];
}
