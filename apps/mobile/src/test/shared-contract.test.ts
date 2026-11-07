// The shared package (packages/shared, the API contract) loads and behaves under the app's
// toolchain: its './x.js' imports resolve, its zod is this app's, its formatting is stable.
import {
  EMAIL_REQUIRED_MESSAGE,
  MEMBER_LABEL,
  SPACE_INVITE_ROLES,
  SPACE_INVITE_ROLE_LABELS,
  containsSsn,
  createUserRequestSchema,
  formatCents,
  inviteRolesFor,
  inviteRowRequest,
  letInRoles,
  letInRolesFor,
  letInStartRole,
  listUsersQuerySchema,
  PLATFORM_BRAND,
  requiresEmail,
  rolesInWords,
  rolesLabel,
  seesTeachingPages,
  spaceInviteRowSchema,
  tourOffered,
  updateUserRequestSchema,
  zonedClockParts,
} from '@tmi/shared';

describe('@tmi/shared in the mobile toolchain', () => {
  it('loads the platform brand', () => {
    expect(PLATFORM_BRAND.name).toBe('Aimtrue');
  });

  it('formats cents', () => {
    expect(formatCents(1234567)).toBe('$12,345.67');
  });

  it('reads a clock time on an organization clock, not UTC', () => {
    // 16:30 UTC in July is 12:30 in New York (EDT).
    expect(zonedClockParts('2026-07-01T16:30:00Z', 'America/New_York')).toEqual({
      day: '2026-07-01',
      minutesOfDay: 12 * 60 + 30,
    });
  });

  it('refuses SSN-shaped text', () => {
    expect(containsSsn('123-45-6789')).toBe(true);
    expect(containsSsn('call 919-555-0100')).toBe(false);
  });

  it('takes an invite row’s address with spaces around it, trimmed and lowercased (S12)', () => {
    const parsed = spaceInviteRowSchema.safeParse({ email: ' Cora@Example.com ', role: 'parent' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.email).toBe('cora@example.com');
    expect(spaceInviteRowSchema.safeParse({ email: ' not-an-email ', role: 'parent' }).success).toBe(false);
  });
});

// Phase 79 (docs/members-plan.md, M1-M6): a member is a person in a space with no role. The contract the app builds on.
describe('members (Phase 79)', () => {
  it('takes an empty set of roles, which needs an email (a member signs in)', () => {
    const member = createUserRequestSchema.safeParse({
      full_name: 'Mo Member',
      email: 'mo@example.com',
      phone: null,
      roles: [],
    });
    expect(member.success).toBe(true);
    expect(member.data?.roles).toEqual([]);
    const noEmail = createUserRequestSchema.safeParse({ full_name: 'Mo Member', email: null, phone: null, roles: [] });
    expect(noEmail.success).toBe(false);
    expect(noEmail.error?.issues[0]).toMatchObject({ path: ['email'], message: EMAIL_REQUIRED_MESSAGE });
    // An edit that empties the roles is a valid PATCH.
    expect(updateUserRequestSchema.safeParse({ roles: [] }).success).toBe(true);
  });

  it('asks an email of a member as of everyone but a student-only', () => {
    expect(requiresEmail([])).toBe(true);
    expect(requiresEmail(['student'])).toBe(false);
    expect(requiresEmail(['student', 'parent'])).toBe(true);
  });

  it('names no role "Member" on screen and "a member" in a log line; a set reads as before', () => {
    expect(MEMBER_LABEL).toBe('Member');
    expect(rolesLabel([])).toBe('Member');
    expect(rolesLabel(['admin', 'tutor'])).toBe('Admin · Tutor');
    expect(rolesLabel(['admin', 'tutor'], ', ')).toBe('Admin, Tutor');
    expect(rolesInWords([])).toBe('a member');
    expect(rolesInWords(['admin', 'tutor'])).toBe('admin and tutor');
  });

  it('filters People by members (`role=member`)', () => {
    expect(listUsersQuerySchema.safeParse({ role: 'member' }).success).toBe(true);
    expect(listUsersQuerySchema.safeParse({ role: 'nobody' }).success).toBe(false);
  });

  it('leaves the teaching pages and the tour to someone with a role', () => {
    expect(seesTeachingPages([])).toBe(false);
    expect(seesTeachingPages(['parent'])).toBe(true);
    const tutoring = { feature_tutoring: true };
    expect(tourOffered(tutoring, [])).toBe(false);
    expect(tourOffered(tutoring, ['tutor'])).toBe(true);
    // Older callers pass no roles.
    expect(tourOffered(tutoring)).toBe(true);
  });

  it('invites a member first and by default, with no role in the request', () => {
    expect(SPACE_INVITE_ROLES[0]).toBe('member');
    expect(SPACE_INVITE_ROLE_LABELS.member).toBe('Member');
    expect(inviteRolesFor({ feature_tutoring: false })).toEqual(['member', 'admin', 'parent']);
    expect(inviteRolesFor({ feature_tutoring: true })).toEqual(['member', 'admin', 'parent', 'tutor']);
    expect(spaceInviteRowSchema.safeParse({ email: 'mo@example.com', role: 'member' }).success).toBe(true);
    expect(inviteRowRequest({ email: 'mo.member@example.com', role: 'member' })).toEqual({
      email: 'mo.member@example.com',
      full_name: 'Mo Member',
      roles: [],
      status: 'invited',
    });
    expect(inviteRowRequest({ email: 'pat@example.com', full_name: ' Pat ', role: 'parent' }).roles).toEqual(['parent']);
  });

  it('lets someone in as a member: first, the start for a learner or no role, no Admin for a teen', () => {
    expect(letInRolesFor({ teen: false, tutoring: true })).toEqual(['member', 'parent', 'admin', 'tutor']);
    expect(letInRolesFor({ teen: true, tutoring: false })).toEqual(['member', 'parent']);
    expect(letInStartRole('student', { teen: false, tutoring: true })).toBe('member');
    expect(letInStartRole(null, { teen: false, tutoring: true })).toBe('member');
    expect(letInStartRole('parent', { teen: false, tutoring: false })).toBe('parent');
    expect(letInStartRole('admin', { teen: true, tutoring: false })).toBe('member');
    expect(letInRoles('member')).toEqual([]);
    expect(letInRoles('tutor')).toEqual(['tutor']);
  });
});
