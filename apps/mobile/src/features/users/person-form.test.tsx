import type { UserDetail } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { AvailabilityPicker, toggleSlot } from './availability-picker';
import { PersonForm } from './person-form';

jest.mock('@/providers/auth-provider', () => ({ useOrgTimeZone: () => 'America/New_York' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/features/progress/api', () => ({ useStudentProgress: () => ({ data: undefined }) }));
jest.mock('./api', () => ({
  useCreateUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
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
