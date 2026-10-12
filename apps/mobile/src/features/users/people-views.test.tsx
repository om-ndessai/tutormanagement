import type { UserDetail } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { EmailOrNone } from './user-badges';
import { UserCard, type RowActions } from './user-card';
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
  fireEvent.press(screen.getByTestId('email'));
  expect(open).not.toHaveBeenCalled();
});

it('shows another tutor none of their pay or paperwork', async () => {
  mockAuth.mockReturnValue({ user: { id: 'alex', roles: ['tutor'] } });
  await renderWithProviders(<UserDetailView user={mariaForAlex} />);
  for (const id of PRIVATE_ROWS) expect(screen.queryByTestId(id)).toBeNull();
  expect(screen.queryByText(/\$\d/)).toBeNull();
  expect(screen.getByTestId('person-section-tutor')).toBeTruthy();
  // A child with no email is said so, and their row still opens their record.
  expect(screen.getByTestId('person-dependent-sofia')).toBeTruthy();
});

it('shows a tutor their own pay, address and SSN status, with no control to change it', async () => {
  mockAuth.mockReturnValue({ user: { id: 'maria', roles: ['tutor', 'parent'] } });
  await renderWithProviders(<UserDetailView user={maria} />);
  for (const id of PRIVATE_ROWS) expect(screen.getByTestId(id)).toBeTruthy();
  expect(screen.getByText('$70.00 / hr')).toBeTruthy();
  expect(screen.getByText('Not received')).toBeTruthy();
  expect(screen.queryByText('Mark SSN received')).toBeNull();
  expect(screen.getByTestId('person-call')).toBeTruthy();
  expect(screen.getByTestId('person-email-action')).toBeTruthy();
});

it('offers no call or email for a child with neither', async () => {
  mockAuth.mockReturnValue({ user: { id: 'admin', roles: ['admin'] } });
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

it('gives the office a row menu, and nobody else one', async () => {
  const actions: RowActions = {
    onView: jest.fn(),
    onDeactivate: jest.fn(),
    onRestore: jest.fn(),
    onDelete: jest.fn(),
  };
  const office = await renderWithProviders(<UserCard user={maria} actions={actions} canAct />);
  expect(screen.getByTestId('people-row-menu-maria')).toBeTruthy();
  fireEvent.press(screen.getByLabelText(/^Maria Okafor, .*open their record$/));
  expect(actions.onView).toHaveBeenCalledWith(maria);
  office.unmount();
  await renderWithProviders(
    <UserCard user={{ ...maria, deleted_at: '2026-10-09T05:00:00Z' }} actions={actions} canAct={false} />,
  );
  expect(screen.queryByTestId('people-row-menu-maria')).toBeNull();
  expect(screen.getByLabelText(/Deactivated, open their record$/)).toBeTruthy();
});
