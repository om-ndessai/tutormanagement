// Add a student, family first (UI upgrades U3): the Family step will not move on without a
// guardian, a parent added in the New parent sheet comes back chosen, and the student and their
// guardians go to the server in ONE request at the end.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { GUARDIAN_REQUIRED_MESSAGE } from './add-person-model';
import { AddStudentFlow, studentSteps } from './add-student-flow';
import { announceGuardianCreated } from './guardian-bridge';

const mockCreate = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useDirty: () => false,
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
let mockOrganization: Record<string, unknown> = {};
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'priya', roles: ['admin'] }, organization: mockOrganization }),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/features/payments/api', () => ({
  useBalances: () => ({
    data: {
      data: {
        students: [
          {
            student_name: 'Sofia Patel',
            guardians: [{ user_id: '00000000-0000-4000-8000-000000000007', full_name: 'Anita Patel', is_primary: true }],
          },
        ],
      },
    },
  }),
}));
jest.mock('./api', () => ({
  useCreateUser: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUsers: () => ({
    isPending: false,
    data: {
      data: [
        {
          id: '00000000-0000-4000-8000-000000000007',
          full_name: 'Anita Patel',
          email: 'anita.patel.nc@gmail.com',
          roles: ['parent'],
        },
      ],
    },
  }),
}));

const ANITA = '00000000-0000-4000-8000-000000000007';
const HANNAH = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mockOrganization = {};
  mockCreate.mockReset();
  mockPush.mockReset();
});

it('starts with the family, names children on a parent row, and refuses to go on without a guardian', async () => {
  await renderWithProviders(<AddStudentFlow fromWizard={false} />);
  expect(screen.getByText('Who is their family?')).toBeTruthy();
  expect(screen.getByText('Parent of Sofia')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText(GUARDIAN_REQUIRED_MESSAGE)).toBeTruthy();

  // New parent opens the quick sheet.
  await fireEvent.press(screen.getByTestId('add-student-new-parent'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/new-parent', params: {} });
});

it('takes a new parent back chosen, and sends the student with both guardians in one request', async () => {
  mockCreate.mockResolvedValue({ data: { id: 'mila', full_name: 'Mila Novak' } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} />);

  await fireEvent.press(screen.getByTestId(`add-student-parents-row-${ANITA}`));
  await fireEvent.press(screen.getByTestId(`guardian-${ANITA}-rel-mother`));
  await act(async () => {
    announceGuardianCreated({ id: HANNAH, full_name: 'Hannah Marsh', email: 'hannah@example.com' });
  });
  expect(screen.getByTestId(`guardian-${HANNAH}`)).toBeTruthy();
  // Two guardians: now there is a primary contact to choose.
  expect(screen.getByTestId(`guardian-${ANITA}-primary`)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('step-flow-next'));

  // The student: a name is required, an email is not.
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText('Name is required.')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('add-student-name'), 'Mila Novak');
  await fireEvent.press(screen.getByTestId('step-flow-next'));

  // School and goal, and the week: both skippable.
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  await fireEvent.press(screen.getByTestId('add-student-band-2-after-school'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));

  // Lessons, the price, then the review and Add.
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText('Tuesday: 3:00–6:00 PM')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('step-flow-next'));

  expect(mockCreate).toHaveBeenCalledTimes(1);
  const body = mockCreate.mock.calls[0][0];
  expect(body.roles).toEqual(['student']);
  expect(body.full_name).toBe('Mila Novak');
  expect(body.email).toBeNull();
  expect(body.guardians).toEqual([
    { guardian_user_id: ANITA, relationship: 'mother', is_primary: true },
    { guardian_user_id: HANNAH, relationship: 'guardian', is_primary: false },
  ]);
  expect(body.availability).toEqual([
    { day_of_week: 2, hour: 15 },
    { day_of_week: 2, hour: 16 },
    { day_of_week: 2, hour: 17 },
  ]);
  // What next, in place of the flow.
  expect(screen.getByText('Mila Novak is added')).toBeTruthy();
  expect(screen.getByTestId('add-person-done-assess')).toBeTruthy();
});

it('without Tutoring, is family, student and school, then the review; and offers to start an assessment (Phase 50)', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, canvas_assessments: true };
  mockCreate.mockResolvedValue({ data: { id: 'mila', full_name: 'Mila Novak' } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} />);

  await fireEvent.press(screen.getByTestId(`add-student-parents-row-${ANITA}`));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.changeText(screen.getByTestId('add-student-name'), 'Mila Novak');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  // School and goal (skippable), then straight to the review: no week, lessons or price.
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  expect(screen.queryByTestId('add-student-limit')).toBeNull();
  await fireEvent.press(screen.getByTestId('step-flow-next'));

  expect(mockCreate).toHaveBeenCalledTimes(1);
  const body = mockCreate.mock.calls[0][0];
  expect('tutor_profile' in body).toBe(false);
  expect('payment_handles' in body).toBe(false);
  expect('availability' in body).toBe(false);
  expect(screen.getByTestId('add-person-done-start-assessment')).toBeTruthy();
  expect(screen.queryByTestId('add-person-done-assess')).toBeNull();
});

it('lists only the Tutoring-free steps without Tutoring', () => {
  const steps = [{ key: 'family' }, { key: 'student' }, { key: 'school' }, { key: 'availability' }, { key: 'lessons' }, { key: 'price' }];
  expect(studentSteps(steps, false).map((s) => s.key)).toEqual(['family', 'student', 'school']);
  expect(studentSteps(steps, true)).toHaveLength(6);
});
