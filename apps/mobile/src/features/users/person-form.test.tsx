import type { UserDetail } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { AvailabilityPicker, toggleSlot } from './availability-picker';
import { PersonForm } from './person-form';

// Phase 50: a space reads `feature_tutoring`; an organization without the column allows everything.
let mockOrganization: Record<string, unknown> = {};
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({ organization: mockOrganization }),
}));
beforeEach(() => {
  mockOrganization = {};
});
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/features/progress/api', () => ({ useStudentProgress: () => ({ data: undefined }) }));
const mockCreate = jest.fn();
jest.mock('./api', () => ({
  useCreateUser: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUsers: () => ({ data: undefined, isFetching: false }),
  useUserDetail: () => ({ data: undefined }),
}));

const alex: UserDetail = {
  id: 'alex',
  email: 'alex.chen.math@gmail.com',
  full_name: 'Alex Chen',
  phone: null,
  status: 'active',
  roles: ['tutor'],
  created_at: '',
  updated_at: '',
  last_login_at: null,
  deleted_at: null,
  shared_fields_locked: true,
  last_entered_at: null,
  tutor_profile: null,
  student_profile: null,
  payment_handles: [],
  availability: [],
  guardians: [],
  dependents: [],
};

const noop = () => undefined;

it('shows only the blocks it is scoped to', async () => {
  await renderWithProviders(
    <PersonForm
      preset={{ roles: ['tutor'] }}
      sections={['tutor-financials']}
      onSaved={noop}
      onCancel={noop}
    />,
  );
  expect(screen.getByTestId('person-tutor-address1')).toBeTruthy();
  expect(screen.getByTestId('person-tutor-rate-in-person')).toBeTruthy();
  expect(screen.queryByTestId('person-form-name')).toBeNull();
  expect(screen.queryByTestId('person-role-tutor')).toBeNull();
  expect(screen.queryByTestId('person-tutor-education')).toBeNull();
  expect(screen.queryByTestId('availability-count')).toBeNull();
});

it('keeps the mailing address to the financials block', async () => {
  await renderWithProviders(
    <PersonForm
      preset={{ roles: ['tutor'] }}
      sections={['tutor-background', 'tutor-availability']}
      onSaved={noop}
      onCancel={noop}
    />,
  );
  expect(screen.queryByTestId('person-tutor-address1')).toBeNull();
  expect(screen.getByTestId('person-tutor-education')).toBeTruthy();
});

it('holds a shared person’s name, email and phone still, and says why', async () => {
  await renderWithProviders(<PersonForm detail={alex} onSaved={noop} onCancel={noop} />);
  expect(screen.getByTestId('person-form-locked')).toBeTruthy();
  expect(screen.getByTestId('person-form-name').props.editable).toBe(false);
});

it('makes the email optional only while the roles are student-only', async () => {
  await renderWithProviders(<PersonForm onSaved={noop} onCancel={noop} />);
  await fireEvent.press(screen.getByTestId('person-role-student'));
  expect(screen.getByTestId('person-role-student').props.accessibilityState.checked).toBe(true);
  expect(screen.getByText('Leave blank if this child has no address of their own.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('person-role-tutor'));
  expect(screen.getByTestId('person-role-tutor').props.accessibilityState).toEqual({ checked: true });
  expect(screen.getByText('They sign in with this Google address.')).toBeTruthy();
});

it('toggles hours and counts them per day', async () => {
  expect(toggleSlot(toggleSlot([], 2, 16), 2, 16)).toEqual([]);
  const onChange = jest.fn();
  await renderWithProviders(
    <AvailabilityPicker value={[{ day_of_week: 2, hour: 16 }]} onChange={onChange} />,
  );
  expect(screen.getByText('1 hour selected')).toBeTruthy();
  expect(screen.getByLabelText('Tuesday, 1 hour')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('availability-hour-2-17'));
  expect(onChange).toHaveBeenCalledWith([
    { day_of_week: 2, hour: 16 },
    { day_of_week: 2, hour: 17 },
  ]);
});

it("scoped to the tax setup, shows the 1099's address and the SSN tick, and nothing about pay", async () => {
  await renderWithProviders(
    <PersonForm detail={{ ...alex, shared_fields_locked: false }} sections={['tutor-tax']} onSaved={noop} onCancel={noop} />,
  );
  expect(screen.getByTestId('person-tutor-address1')).toBeTruthy();
  expect(screen.getByTestId('person-tutor-zip')).toBeTruthy();
  expect(screen.getByTestId('person-tutor-ssn')).toBeTruthy();
  expect(screen.queryByTestId('person-tutor-rate-in-person')).toBeNull();
  expect(screen.queryByTestId('person-tutor-topup')).toBeNull();
  expect(screen.queryByTestId('person-form-name')).toBeNull();
  expect(screen.queryByTestId('availability-count')).toBeNull();
});

it('without Tutoring, offers no tutor role and no student lessons, price or availability (Phase 50)', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, canvas_assessments: true };
  await renderWithProviders(<PersonForm preset={{ roles: ['student'] }} onSaved={noop} onCancel={noop} />);
  expect(screen.queryByTestId('person-role-tutor')).toBeNull();
  expect(screen.getByTestId('person-role-student')).toBeTruthy();
  expect(screen.getByTestId('person-student-school')).toBeTruthy();
  expect(screen.queryByTestId('person-student-limit')).toBeNull();
  expect(screen.queryByTestId('person-student-virtual')).toBeNull();
  expect(screen.queryByTestId('availability-count')).toBeNull();
});

it('without Tutoring, still shows a tutor role someone already holds, but none of its blocks', async () => {
  mockOrganization = { feature_tutoring: false };
  await renderWithProviders(<PersonForm detail={alex} onSaved={noop} onCancel={noop} />);
  expect(screen.getByTestId('person-role-tutor')).toBeTruthy();
  expect(screen.queryByTestId('person-tutor-education')).toBeNull();
});

// Phase 52 ------------------------------------------------------------------------------------

it('lets in a request: the name and email filled, the email held, and the request sent with it', async () => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ data: { ...alex, id: 'jo', full_name: 'Jo Joiner', roles: ['parent'] } });
  const onSaved = jest.fn();
  await renderWithProviders(
    <PersonForm
      preset={{ roles: [], full_name: 'Jo Joiner', email: 'jo@example.com' }}
      joinRequestUserId="11111111-1111-4111-8111-111111111111"
      title="Let Jo Joiner in"
      onSaved={onSaved}
      onCancel={noop}
    />,
  );
  expect(screen.getByTestId('person-form-title')).toHaveTextContent('Let Jo Joiner in');
  expect(screen.getByTestId('person-form-name').props.value).toBe('Jo Joiner');
  expect(screen.getByTestId('person-form-email').props.value).toBe('jo@example.com');
  expect(screen.getByTestId('person-form-email').props.editable).toBe(false);
  expect(screen.getByText('The address they asked to join with.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('person-role-parent'));
  await fireEvent.press(screen.getByTestId('person-form-save'));
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      full_name: 'Jo Joiner',
      email: 'jo@example.com',
      roles: ['parent'],
      join_request_user_id: '11111111-1111-4111-8111-111111111111',
    }),
  );
  expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('parent_consent');
  expect(onSaved).toHaveBeenCalled();
});

it('asks a self-serve space for a parent’s consent for a new student only, and sends it', async () => {
  mockOrganization = { created_via: 'self_serve' };
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ data: { ...alex, id: 'kit', full_name: 'Kit', roles: ['student'] } });
  await renderWithProviders(<PersonForm onSaved={noop} onCancel={noop} />);
  expect(screen.queryByTestId('person-parent-consent')).toBeNull();
  await fireEvent.press(screen.getByTestId('person-role-student'));
  const box = screen.getByTestId('person-parent-consent');
  expect(box.props.accessibilityState).toEqual({ checked: false });
  await fireEvent.press(box);
  expect(screen.getByTestId('person-parent-consent').props.accessibilityState).toEqual({ checked: true });
});

it('shows the server’s consent refusal under the box', async () => {
  mockOrganization = { created_via: 'self_serve' };
  const { ApiRequestError } = jest.requireActual('@/lib/api-client');
  mockCreate.mockReset();
  mockCreate.mockRejectedValue(
    new ApiRequestError(422, 'validation_failed', 'Please correct the highlighted fields.', {
      parent_consent: ['Confirm you are their parent or guardian, or have their permission.'],
    }),
  );
  await renderWithProviders(
    <PersonForm
      preset={{
        roles: ['student'],
        guardians: [{ guardian_user_id: '22222222-2222-4222-8222-222222222222', relationship: 'mother', is_primary: true }],
      }}
      onSaved={noop}
      onCancel={noop}
    />,
  );
  await fireEvent.changeText(screen.getByTestId('person-form-name'), 'Kit Creator');
  await fireEvent.press(screen.getByTestId('person-form-save'));
  expect(mockCreate.mock.calls[0][0]).toMatchObject({ parent_consent: false });
  expect(screen.getByTestId('person-parent-consent-error')).toHaveTextContent(
    'Confirm you are their parent or guardian, or have their permission.',
  );
});

it('never asks for consent outside a self-serve space, nor on an edit', async () => {
  mockOrganization = { created_via: 'console' };
  await renderWithProviders(<PersonForm preset={{ roles: ['student'] }} onSaved={noop} onCancel={noop} />);
  expect(screen.queryByTestId('person-parent-consent')).toBeNull();
  mockOrganization = { created_via: 'self_serve' };
  await renderWithProviders(
    <PersonForm detail={{ ...alex, roles: ['student'], shared_fields_locked: false }} onSaved={noop} onCancel={noop} />,
  );
  expect(screen.queryByTestId('person-parent-consent')).toBeNull();
});
