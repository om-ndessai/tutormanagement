// The pure parts of the Let in sheet (let-in-sheet.tsx), ported from apps/web/src/features/users/let-in-sheet.tsx
// @ ab71793 so they are tested without a screen: the roles it offers, the one request that lets someone in, and a
// student's guardians with the new parent added.
// Phase 72 (UI audit JF26; the web's let-in-sheet.tsx and join-requests-panel.tsx @ 98c40ab, working tree): the
// sheet starts on the role the person asked for, where it is one of its choices, and says what they asked.
// Phase 79 (M5, docs/members-plan.md; let-in-sheet.tsx @ 758a19f, working tree): the choices are shared
// (`letInRolesFor`): Member first -- in, with no role, playing Quest -- then Parent, Admin (never for a teen, who the
// request marks `teen`) and Tutor (where Tutoring is on). It starts on the role asked for where it is offered, else
// on Member (`letInStartRole`), so a learner is let in with one tap; Member sends no role (`letInRoles`).
import {
  JOIN_REQUEST_ROLE_LABELS,
  LET_IN_ROLE_HINTS,
  LET_IN_ROLE_LABELS,
  formatRelativeTime,
  letInRoles,
  letInRolesFor,
  letInStartRole,
  type CreateUserRequestPayload,
  type JoinRequest,
  type JoinRequestRole,
  type LetInRole,
  type UserDetail,
} from '@tmi/shared';

import type { GuardianValue } from './person-form-model';

export type { LetInRole };

export interface LetInChoice {
  role: LetInRole;
  title: string;
  hint: string;
}

/** One line under each choice (shared with the web). */
const HINTS: Record<LetInRole, string> = LET_IN_ROLE_HINTS;

/** What the sheet weighs: the person's age band (a teen: no Admin) and whether Tutoring is on here. */
export interface LetInContext {
  teen: boolean;
  tutoring: boolean;
}

/** The context of a request here: `teen` is absent from older Workers (then nothing is hidden for it). */
export function letInContext(request: Pick<JoinRequest, 'teen'>, tutoring: boolean): LetInContext {
  return { teen: request.teen ?? false, tutoring };
}

/**
 * Where the sheet starts: the role asked for when the sheet offers it (Parent, Admin, Tutor), else Member -- a
 * learner, or no role said.
 */
export function initialLetInRole(asked: JoinRequestRole | null | undefined, context: LetInContext): LetInRole {
  return letInStartRole(asked, context);
}

/** "Asked as a parent." (the web's words). Null when nothing was asked. */
export function askedAsLine(asked: JoinRequestRole | null | undefined): string | null {
  if (!asked) return null;
  return `Asked as ${JOIN_REQUEST_ROLE_LABELS[asked].toLowerCase()}.`;
}

/** A request's line on People: "asked 5 minutes ago · as a parent" (no role from an older app). */
export function requestAskedLine(request: Pick<JoinRequest, 'requested_at' | 'role'>): string {
  const role = request.role ? ` · as ${JOIN_REQUEST_ROLE_LABELS[request.role].toLowerCase()}` : '';
  return `asked ${formatRelativeTime(request.requested_at)}${role}`;
}

/** The roles the sheet offers here, in order: Member, Parent, Admin (not for a teen), Tutor (where Tutoring is on). */
export function letInChoices(context: LetInContext): LetInChoice[] {
  return letInRolesFor(context).map((role) => ({ role, title: LET_IN_ROLE_LABELS[role], hint: HINTS[role] }));
}

/** "Jo" of "Jo Joiner" (the whole name when it is one word). */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * The request the web sends (`POST /users`): the person as Google gave them, in the one role chosen -- none for a
 * member -- active at once, tied to their request so the request is answered in the same write.
 */
export function letInRequest(request: JoinRequest, role: LetInRole): CreateUserRequestPayload {
  return {
    full_name: request.full_name,
    email: request.email ?? null,
    phone: null,
    roles: letInRoles(role),
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
