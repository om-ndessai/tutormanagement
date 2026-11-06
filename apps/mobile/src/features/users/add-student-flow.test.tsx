// Add a student, family first (UI upgrades U3): the Family step will not move on without a
// guardian, a parent added in the New parent sheet comes back chosen, and the student and their
// guardians go to the server in ONE request at the end.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { GUARDIAN_REQUIRED_MESSAGE } from './add-person-model';
import { AddStudentFlow, presetGuardian, studentSteps } from './add-student-flow';
import { announceFormSaved } from '@/lib/form-bridge';
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
let mockRoles = ['admin', 'parent'];
const mockRefreshSession = jest.fn(async () => undefined);
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '33333333-3333-4333-8333-333333333333', full_name: 'Ines Ferreira', roles: mockRoles },
    organization: mockOrganization,
    refreshSession: mockRefreshSession,
  }),
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
  mockRoles = ['admin', 'parent'];
  mockRefreshSession.mockClear();
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
  // What next, in place of the flow (Phase 76: shared `nextStepsAfterAdd`): the pairing, then the weekly lesson,
  // which waits for the pairing; and, where Tutoring is on, its progress assessment (even with Assessment off).
  expect(screen.getByText('Mila Novak is added')).toBeTruthy();
  expect(screen.getByTestId('add-done-next-pair_tutor')).toHaveTextContent(/Pair Mila with a tutor/);
  expect(screen.getByTestId('add-done-next-weekly_lesson')).toBeDisabled();
  expect(screen.getByTestId('add-done-next-weekly_lesson-line')).toHaveTextContent('Pair them with a tutor first.');
  expect(screen.getByTestId('add-done-next-assessment')).toHaveTextContent(/Record an assessment/);
  expect(screen.getByTestId('add-person-done-again')).toHaveTextContent(/Add another student/);
});

it('Pair, then Set a weekly lesson on that pairing (Phase 76)', async () => {
  mockOrganization = { canvas_assessments: true };
  mockCreate.mockResolvedValue({ data: { id: 'mila', full_name: 'Mila Novak', roles: ['student'] } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} />);
  await fireEvent.press(screen.getByTestId(`add-student-parents-row-${ANITA}`));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.changeText(screen.getByTestId('add-student-name'), 'Mila Novak');
  for (let step = 0; step < 6; step += 1) {
    await fireEvent.press(screen.getByTestId(screen.queryByTestId('step-flow-skip') ? 'step-flow-skip' : 'step-flow-next'));
  }
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('add-done-next-assessment')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('add-done-next-pair_tutor'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/assignment-form', params: { student: 'mila' } });
  await act(async () => announceFormSaved({ form: 'assignment', id: 'pairing-7' }));
  expect(screen.getByTestId('add-done-next-pair_tutor-line')).toHaveTextContent('Done.');
  expect(screen.getByTestId('add-done-next-weekly_lesson')).not.toBeDisabled();
  await fireEvent.press(screen.getByTestId('add-done-next-weekly_lesson'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/schedule-lesson', params: { assignment: 'pairing-7' } });
  await act(async () => announceFormSaved({ form: 'schedule', id: 'schedule-1' }));
  expect(screen.getByTestId('add-done-next-weekly_lesson-line')).toHaveTextContent('Done.');
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
  // Phase 76: the one next step is the handwritten assessment; nothing about tutors or lessons.
  expect(screen.getByTestId('add-done-next-assessment')).toHaveTextContent(/Record an assessment/);
  expect(screen.queryByTestId('add-done-next-pair_tutor')).toBeNull();
  expect(screen.queryByTestId('add-done-next-weekly_lesson')).toBeNull();
});

it('lists only the Tutoring-free steps without Tutoring', () => {
  const steps = [{ key: 'family' }, { key: 'student' }, { key: 'school' }, { key: 'availability' }, { key: 'lessons' }, { key: 'price' }];
  expect(studentSteps(steps, false).map((s) => s.key)).toEqual(['family', 'student', 'school']);
  expect(studentSteps(steps, true)).toHaveLength(6);
});

// Phase 52 ------------------------------------------------------------------------------------

const INES = '33333333-3333-4333-8333-333333333333';

async function toReview(withFamily: boolean) {
  if (withFamily) await fireEvent.press(screen.getByTestId(`add-student-parents-row-${ANITA}`));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.changeText(screen.getByTestId('add-student-name'), 'Kit Creator');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
}

it('in a self-serve space, asks for consent on the Review, refuses before sending, then sends it', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, created_via: 'self_serve' };
  mockCreate.mockResolvedValue({ data: { id: 'kit', full_name: 'Kit Creator' } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} />);
  await toReview(true);

  expect(screen.getByTestId('add-student-consent')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getByTestId('add-student-consent-error')).toHaveTextContent(
    'Confirm you are their parent or guardian, or have their permission.',
  );

  await fireEvent.press(screen.getByTestId('add-student-consent'));
  expect(screen.queryByTestId('add-student-consent-error')).toBeNull();
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0]).toMatchObject({ parent_consent: true, full_name: 'Kit Creator' });
});

it('asks for no consent outside a self-serve space', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, created_via: 'console' };
  mockCreate.mockResolvedValue({ data: { id: 'kit', full_name: 'Kit Creator' } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} />);
  await toReview(true);
  expect(screen.queryByTestId('add-student-consent')).toBeNull();
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect('parent_consent' in mockCreate.mock.calls[0][0]).toBe(false);
});

it('with guardian=me, starts with the reader chosen as the family', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, created_via: 'self_serve' };
  mockCreate.mockResolvedValue({ data: { id: 'kit', full_name: 'Kit Creator' } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} guardian="me" />);
  expect(screen.getByTestId(`guardian-${INES}`)).toBeTruthy();
  expect(screen.getByText('Ines Ferreira')).toBeTruthy();
  await toReview(false);
  await fireEvent.press(screen.getByTestId('add-student-consent'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate.mock.calls[0][0].guardians).toEqual([
    { guardian_user_id: INES, relationship: 'guardian', is_primary: true },
  ]);
});

it('from Let in (UI audit JF1), starts with the parent just let in, and keeps the consent step', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, created_via: 'self_serve' };
  mockCreate.mockResolvedValue({ data: { id: 'kit', full_name: 'Kit Joiner' } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} guardian={HANNAH} guardianName="Jo Joiner" />);
  expect(screen.getByTestId(`guardian-${HANNAH}`)).toBeTruthy();
  expect(screen.getByText('Jo Joiner')).toBeTruthy();
  await toReview(false);
  // The consent the self-serve space asks for is still asked.
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('add-student-consent'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate.mock.calls[0][0].guardians).toEqual([
    { guardian_user_id: HANNAH, relationship: 'guardian', is_primary: true },
  ]);
});

// Phase 76 (JF21): "My child" in a personal space ----------------------------------------------------------------

it('"My child" in a personal space asks only for the child, the reader the parent, consent still the box', async () => {
  mockOrganization = { feature_tutoring: false, feature_assessment: true, created_via: 'self_serve', personal: true };
  mockRoles = ['admin'];
  mockCreate.mockResolvedValue({ data: { id: 'kit', full_name: 'Kit Ferreira', roles: ['student'] } });
  await renderWithProviders(<AddStudentFlow fromWizard={false} guardian="me" />);
  // No Family step: the child first.
  expect(screen.getByText('Who is your child?')).toBeTruthy();
  expect(screen.queryByText('Who is their family?')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('add-student-name'), 'Kit Ferreira');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  // The consent is asked on the Review, as anywhere self-serve.
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('add-student-consent'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0]).toMatchObject({
    roles: ['student'],
    parent_consent: true,
    guardians: [{ guardian_user_id: INES, relationship: 'guardian', is_primary: true }],
  });
  // The server made the reader a parent in the same request: the session is read again.
  expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('add-person-done-again')).toHaveTextContent(/Add another child/);
});

it("says the server's refusal of the reader's own address as given", async () => {
  const { ApiRequestError } = jest.requireActual('@/lib/api-client');
  mockOrganization = { feature_tutoring: false, feature_assessment: true, personal: true };
  mockCreate.mockRejectedValue(
    new ApiRequestError(409, 'conflict', "That's you: add your child, and you'll be their parent."),
  );
  await renderWithProviders(<AddStudentFlow fromWizard={false} guardian="me" />);
  await fireEvent.changeText(screen.getByTestId('add-student-name'), 'Ines Ferreira');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(await screen.findByText("That's you: add your child, and you'll be their parent.")).toBeTruthy();
});

it('studentSteps leaves the Family step out only for "My child"', () => {
  const steps = [{ key: 'family' }, { key: 'student' }, { key: 'school' }];
  expect(studentSteps(steps, false, { mine: true }).map((s) => s.key)).toEqual(['student', 'school']);
  expect(studentSteps(steps, false).map((s) => s.key)).toEqual(['family', 'student', 'school']);
});

it('presetGuardian: the reader, a named parent, or nobody', () => {
  const reader = { id: INES, full_name: 'Ines Ferreira' };
  expect(presetGuardian('me', undefined, reader)).toEqual({ id: INES, name: 'Ines Ferreira' });
  expect(presetGuardian(HANNAH, ' Jo Joiner ', reader)).toEqual({ id: HANNAH, name: 'Jo Joiner' });
  // An id without a name is not enough to say who they are.
  expect(presetGuardian(HANNAH, undefined, reader)).toBeNull();
  expect(presetGuardian(undefined, undefined, reader)).toBeNull();
});
