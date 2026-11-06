import type { UserDetail } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { EmailOrNone } from './user-badges';
import { UserCard, personRowActions, sharesInvitation, type RowActions } from './user-card';
import { UserDetailView } from './user-detail-view';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/features/audit/api', () => ({
  useAuditEvents: () => ({ data: { data: [], meta: { total: 0 } }, isPending: false }),
}));
jest.mock('./api', () => ({ useSsnReceipt: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
// Phase 76 (JF21): a student's record reads their pairings and weekly lessons.
const mockPairings = jest.fn((_params: unknown) => ({ isPending: false, data: { data: [] as unknown[] } }));
const mockSchedules = jest.fn((_params: unknown) => ({ isPending: false, data: { data: [] as unknown[] } }));
jest.mock('@/features/teaching/api', () => ({ useAssignments: (params: unknown) => mockPairings(params) }));
jest.mock('@/features/schedules/api', () => ({ useSchedules: (params: unknown) => mockSchedules(params) }));
jest.mock('@/features/locations/locations-list', () => ({ LocationsList: () => null }));
jest.mock('@/features/comments/comments-button', () => ({ CommentsRow: () => null }));

/** Maria as the office reads her: everything on file. */
const maria: UserDetail = {
  id: 'maria',
  email: 'maria.okafor@gmail.com',
  full_name: 'Maria Okafor',
  phone: '(919) 555-0155',
  status: 'active',
  roles: ['tutor', 'parent'],
  created_at: '2026-10-09T04:45:55Z',
  updated_at: '2026-10-09T04:45:55Z',
  last_login_at: null,
  deleted_at: null,
  shared_fields_locked: false,
  last_entered_at: null,
  tutor_profile: {
    highest_education: 'BS, Statistics',
    school: 'Duke',
    area: 'Durham',
    address_line1: '1 Main St',
    address_line2: null,
    city: 'Durham',
    state: 'NC',
    postal_code: '27701',
    availability_notes: null,
    virtual_available: false,
    default_rate_in_person_cents: 7000,
    default_rate_virtual_cents: null,
    max_session_minutes: 120,
    topup_amount_cents: 20000,
    ssn_received_on: null,
  },
  student_profile: null,
  payment_handles: [],
  availability: [],
  guardians: [],
  dependents: [
    { user_id: 'sofia', full_name: 'Sofia Okafor', email: null, relationship: 'mother', is_primary: true },
  ],
};

/** The same record as the server sends it to another tutor (R5, R6). */
const mariaForAlex: UserDetail = {
  ...maria,
  tutor_profile: {
    ...maria.tutor_profile!,
    address_line1: null,
    city: null,
    state: null,
    postal_code: null,
    default_rate_in_person_cents: null,
    topup_amount_cents: null,
  },
};

const PRIVATE_ROWS = [
  'person-pay-in-person',
  'person-pay-virtual',
  'person-mailing-address',
  'person-ssn',
  'person-topup',
];

it('never makes an absent email a link', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await renderWithProviders(<EmailOrNone email={null} testID="email" />);
  expect(screen.getByText('No email')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('email'));
  expect(open).not.toHaveBeenCalled();
});

it('shows another tutor none of their pay or paperwork', async () => {
  mockAuth.mockReturnValue({ organization: {}, user: { id: 'alex', roles: ['tutor'] } });
  await renderWithProviders(<UserDetailView user={mariaForAlex} />);
  for (const id of PRIVATE_ROWS) expect(screen.queryByTestId(id)).toBeNull();
  expect(screen.queryByText(/\$\d/)).toBeNull();
  expect(screen.getByTestId('person-section-background')).toBeTruthy();
  // A child with no email is said so, and their row still opens their record.
  expect(screen.getByTestId('person-dependent-sofia')).toBeTruthy();
});

it('shows a tutor their own pay, address and SSN status, with no control to change it', async () => {
  mockAuth.mockReturnValue({ organization: {}, user: { id: 'maria', roles: ['tutor', 'parent'] } });
  await renderWithProviders(<UserDetailView user={maria} />);
  for (const id of PRIVATE_ROWS) expect(screen.getByTestId(id)).toBeTruthy();
  expect(screen.getByText('$70.00 / hr')).toBeTruthy();
  expect(screen.getByText('Not received')).toBeTruthy();
  expect(screen.queryByText('Mark SSN received')).toBeNull();
  expect(screen.getByTestId('person-call')).toBeTruthy();
  expect(screen.getByTestId('person-email-action')).toBeTruthy();
});

it('offers no call or email for a child with neither', async () => {
  mockAuth.mockReturnValue({ organization: {}, user: { id: 'admin', roles: ['admin'] } });
  await renderWithProviders(
    <UserDetailView
      user={{
        ...maria,
        id: 'kid',
        email: null,
        phone: null,
        roles: ['student'],
        tutor_profile: null,
        dependents: [],
      }}
    />,
  );
  expect(screen.queryByTestId('person-call')).toBeNull();
  expect(screen.queryByTestId('person-email-action')).toBeNull();
  expect(screen.getByText('No email')).toBeTruthy();
});

describe('the record in sections (UI upgrades U5)', () => {
  it('gives the office an Edit on each section, opening only that section', async () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    router.push.mockClear();
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'admin', roles: ['admin'] } });
    await renderWithProviders(<UserDetailView user={maria} />);
    for (const key of ['contact', 'background', 'availability', 'teaching', 'pay', 'family']) {
      expect(screen.getByTestId(`person-section-${key}`)).toBeTruthy();
    }
    // A tutor who is also a parent: the payment ids sit with the pay, and the child is read here.
    expect(screen.queryByTestId('person-section-payment')).toBeNull();
    expect(screen.getByTestId('person-edit-family')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('person-edit-pay'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/person-form',
      params: { id: 'maria', section: 'pay' },
    });
  });

  it('gives anyone else no Edit, and another tutor no Pay and tax', async () => {
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'alex', roles: ['tutor'] } });
    await renderWithProviders(<UserDetailView user={mariaForAlex} />);
    expect(screen.getByTestId('person-section-teaching')).toBeTruthy();
    expect(screen.queryByTestId('person-section-pay')).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('shows the person their own pay, and still no Edit', async () => {
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'maria', roles: ['tutor', 'parent'] } });
    await renderWithProviders(<UserDetailView user={maria} />);
    expect(screen.getByTestId('person-section-pay')).toBeTruthy();
    expect(screen.queryByTestId('person-edit-pay')).toBeNull();
  });
});

it('gives the office a row menu, and nobody else one', async () => {
  const actions: RowActions = {
    onView: jest.fn(),
    onDeactivate: jest.fn(),
    onRestore: jest.fn(),
    onDelete: jest.fn(),
  };
  const office = await renderWithProviders(<UserCard user={maria} actions={actions} canAct />);
  expect(screen.getByTestId('people-row-menu-maria')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Maria Okafor, .*open their record$/));
  expect(actions.onView).toHaveBeenCalledWith(maria);
  await office.unmount();
  await renderWithProviders(
    <UserCard user={{ ...maria, deleted_at: '2026-10-09T05:00:00Z' }} actions={actions} canAct={false} />,
  );
  expect(screen.queryByTestId('people-row-menu-maria')).toBeNull();
  expect(screen.getByLabelText(/Deactivated, open their record$/)).toBeTruthy();
});

// RNTL 14's `fireEvent.press` and `unmount` are async: un-awaited, the press's act() overlapped the
// next render's, and every later render in this file came out null (the row-menu test above did).
it('renders normally after the row-menu test', async () => {
  mockAuth.mockReturnValue({ organization: {}, user: { id: 'admin', roles: ['admin'] } });
  await renderWithProviders(<EmailOrNone email="maria.okafor@gmail.com" testID="email" />);
  expect(screen.toJSON()).not.toBeNull();
  expect(screen.getByText('maria.okafor@gmail.com')).toBeTruthy();
});

// --- Phase 76 (JF21, JF37) ------------------------------------------------------------------------------------

const sofia: UserDetail = {
  ...maria,
  id: 'sofia',
  email: null,
  full_name: 'Sofia Okafor',
  phone: null,
  roles: ['student'],
  tutor_profile: null,
  student_profile: {
    school: 'Ephesus',
    current_math_course: null,
    academic_year_goal: null,
    virtual_available: false,
    charge_rate_in_person_cents: null,
    charge_rate_virtual_cents: null,
    max_session_minutes: 60,
  },
  dependents: [],
  guardians: [{ user_id: 'maria', full_name: 'Maria Okafor', email: null, relationship: 'mother', is_primary: true }],
};

const room = {
  id: 'room',
  owner_user_id: 'alex',
  owner_name: 'Alex Chen',
  name: 'Institute, room 2',
  kind: 'physical' as const,
  address: '1 Main St',
  reminder_minutes: 0,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

describe("a student's tutors and weekly lessons (Phase 76)", () => {
  it('names their tutor and their weekly lesson, with its place by name only, and no money', async () => {
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'maria', roles: ['parent'] } });
    mockPairings.mockReturnValue({
      isPending: false,
      data: {
        data: [
          { tutor_user_id: 'alex', tutor_name: 'Alex Chen', is_active: true },
          { tutor_user_id: 'alex', tutor_name: 'Alex Chen', is_active: true },
          { tutor_user_id: 'old', tutor_name: 'Old Tutor', is_active: false },
        ],
      },
    });
    mockSchedules.mockReturnValue({
      isPending: false,
      data: {
        data: [
          {
            id: 's1',
            day_of_week: 1,
            start_time: '16:00',
            duration_minutes: 60,
            tutor_name: 'Alex Chen',
            mode: 'in_person',
            locations: [room],
            is_active: true,
          },
        ],
      },
    });
    await renderWithProviders(<UserDetailView user={sofia} />);
    expect(mockPairings).toHaveBeenCalledWith({ student_user_id: 'sofia' });
    expect(mockSchedules).toHaveBeenCalledWith({ student_user_id: 'sofia' });
    expect(screen.getByTestId('person-section-tutoring')).toBeTruthy();
    expect(screen.getByTestId('person-tutor-alex')).toHaveTextContent(/Alex Chen/);
    // One row per tutor, active pairings only.
    expect(screen.queryByTestId('person-tutor-old')).toBeNull();
    expect(screen.getByTestId('person-lesson-s1')).toHaveTextContent('Mondays, 4:00–5:00 PM with Alex Chen · Institute, room 2');
    expect(screen.queryByText(/1 Main St/)).toBeNull();
  });

  it('says when there is no tutor or lesson yet, and is left out where Tutoring is off', async () => {
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'admin', roles: ['admin'] } });
    mockPairings.mockReturnValue({ isPending: false, data: { data: [] } });
    mockSchedules.mockReturnValue({ isPending: false, data: { data: [] } });
    const shown = await renderWithProviders(<UserDetailView user={sofia} />);
    expect(screen.getByText('No tutor yet.')).toBeTruthy();
    expect(screen.getByText('No weekly lesson yet.')).toBeTruthy();
    await shown.unmount();
    mockAuth.mockReturnValue({ organization: { feature_tutoring: false }, user: { id: 'admin', roles: ['admin'] } });
    await renderWithProviders(<UserDetailView user={sofia} />);
    expect(screen.queryByTestId('person-section-tutoring')).toBeNull();
  });
});

describe('an invited row shares its invitation (Phase 76, JF37)', () => {
  const invited = { ...maria, status: 'invited' as const };
  const actions: RowActions = {
    onView: jest.fn(),
    onDeactivate: jest.fn(),
    onRestore: jest.fn(),
    onDelete: jest.fn(),
    onShareInvitation: jest.fn(),
  };

  it('offers Share invitation on the card and in the menu, to the office', async () => {
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'admin', roles: ['admin'] } });
    await renderWithProviders(<UserCard user={invited} actions={actions} canAct />);
    await fireEvent.press(screen.getByTestId('people-share-maria'));
    expect(actions.onShareInvitation).toHaveBeenCalledWith(invited);
    expect(personRowActions(invited, actions, false).map((action) => action.key)).toEqual(['share', 'deactivate']);
  });

  it('not on an active row, a deactivated one, or for anyone but the office', async () => {
    mockAuth.mockReturnValue({ organization: {}, user: { id: 'admin', roles: ['admin'] } });
    const active = await renderWithProviders(<UserCard user={maria} actions={actions} canAct />);
    expect(screen.queryByTestId('people-share-maria')).toBeNull();
    await active.unmount();
    const reader = await renderWithProviders(<UserCard user={invited} actions={actions} canAct={false} />);
    expect(screen.queryByTestId('people-share-maria')).toBeNull();
    await reader.unmount();
    expect(sharesInvitation({ ...invited, deleted_at: '2026-10-09T05:00:00Z' })).toBe(false);
    expect(sharesInvitation({ ...invited, email: null })).toBe(false);
    expect(sharesInvitation(invited)).toBe(true);
  });
});
