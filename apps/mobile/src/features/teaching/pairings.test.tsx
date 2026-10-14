import type { Assignment } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { AssignmentForm } from './assignment-form-sheet';
import { copyFor, PairingsScreen } from './pairings-screen';

const mockAuth = jest.fn();
const mockAssignments = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, setParams: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('./api', () => ({
  useAssignments: () => mockAssignments(),
  useDeleteAssignment: () => ({ mutate: jest.fn(), isPending: false }),
  useCreateAssignment: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateAssignment: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));
const mockLocations = jest.fn();
const mockSetLocations = jest.fn();
jest.mock('@/features/locations/api', () => ({
  useLocations: (userId: string | null) => mockLocations(userId),
  useSetPairingLocations: () => ({ mutateAsync: mockSetLocations, isPending: false }),
}));
jest.mock('@/features/users/api', () => ({
  useUsers: () => ({ data: { data: [] } }),
  useUserDetail: () => ({ data: undefined }),
}));

const TUTOR_ID = '00000000-0000-4000-8000-000000000003';

function pairing(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1',
    tutor_user_id: TUTOR_ID,
    tutor_name: 'Alex Chen',
    student_user_id: '00000000-0000-4000-8000-000000000008',
    student_name: 'Sofia Okafor',
    rate_in_person_cents: null,
    rate_virtual_cents: null,
    effective_rate_in_person_cents: 7500,
    effective_rate_virtual_cents: 6500,
    is_active: true,
    notes: 'Weekly',
    locations: [],
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

/** What the API sends a reader who may not see the pay (`scopeAssignmentRates`). */
const blanked = (row: Assignment): Assignment => ({
  ...row,
  rate_in_person_cents: null,
  rate_virtual_cents: null,
  effective_rate_in_person_cents: null,
  effective_rate_virtual_cents: null,
});

beforeEach(() => {
  mockLocations.mockReturnValue({ isPending: false, data: { data: [] } });
});

describe('pairings', () => {
  it('describes the page in the reader’s own terms, clause by clause', () => {
    expect(copyFor(['admin', 'tutor']).description).toBe(
      'Which tutor teaches which student, and what the tutor is paid for it.',
    );
    expect(copyFor(['tutor', 'parent'])).toEqual({
      description: 'The students you teach, and who teaches your children.',
      empty: 'You have no students assigned, and no tutor teaches your children.',
    });
    expect(copyFor(['student']).description).toBe('Your own tutors.');
    expect(copyFor([]).empty).toBe('Nothing is assigned to you yet.');
  });

  it('shows the tutor their own rate, with "custom" only on an override, and no admin actions', async () => {
    mockAuth.mockReturnValue({ user: { id: TUTOR_ID, roles: ['tutor'] } });
    mockAssignments.mockReturnValue({
      data: {
        data: [
          pairing(),
          pairing({
            id: 'a2',
            student_name: 'Ben Whitfield',
            rate_in_person_cents: 7000,
            effective_rate_in_person_cents: 7000,
          }),
        ],
      },
      isPending: false,
    });
    await renderWithProviders(<PairingsScreen />);
    expect(screen.getAllByText('Your rate, in person:')).toHaveLength(2);
    expect(screen.getByText('$75.00')).toBeOnTheScreen();
    expect(screen.queryByTestId('pairing-custom-in-person-a1')).toBeNull();
    expect(screen.getByTestId('pairing-custom-in-person-a2')).toBeOnTheScreen();
    expect(screen.queryByText(/Tutor pay/)).toBeNull();
    expect(screen.queryByTestId('pairings-add-button')).toBeNull();
    expect(screen.queryByTestId('pairing-edit-a1')).toBeNull();
  });

  it('a parent sees who teaches their child, and no rate line at all', async () => {
    mockAuth.mockReturnValue({ user: { id: 'parent-1', roles: ['parent'] } });
    mockAssignments.mockReturnValue({ data: { data: [blanked(pairing())] }, isPending: false });
    await renderWithProviders(<PairingsScreen />);
    expect(screen.getByText('Sofia Okafor')).toBeOnTheScreen();
    expect(screen.getByText('Who teaches your children.')).toBeOnTheScreen();
    expect(screen.queryByTestId('pairing-rates-a1')).toBeNull();
    expect(screen.queryByText(/No rate set/)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('labels the rate as the tutor’s pay for the office, with the admin’s actions', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin-1', roles: ['admin'] } });
    mockAssignments.mockReturnValue({ data: { data: [pairing()] }, isPending: false });
    await renderWithProviders(<PairingsScreen />);
    expect(screen.getByText('Tutor pay, in person:')).toBeOnTheScreen();
    expect(screen.getByTestId('pairing-edit-a1')).toBeOnTheScreen();
    expect(screen.getByTestId('pairing-remove-a1')).toBeOnTheScreen();
  });

  it('refuses a rate that is not an amount, and sends null for a cleared one', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin-1', roles: ['admin'] } });
    mockUpdate.mockResolvedValue({});
    await renderWithProviders(
      <AssignmentForm existing={pairing({ rate_in_person_cents: 7000, rate_virtual_cents: 6000 })} />,
    );
    expect(screen.getByDisplayValue('70.00')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('assignment-rate-in-person'), 'lots');
    await fireEvent.press(screen.getByTestId('assignment-save'));
    expect(await screen.findByText('Enter an amount, like 75.00.')).toBeOnTheScreen();
    expect(mockUpdate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('assignment-rate-in-person'), '82.50');
    await fireEvent.changeText(screen.getByTestId('assignment-rate-virtual'), '');
    await fireEvent.press(screen.getByTestId('assignment-save'));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'a1',
        input: { rate_in_person_cents: 8250, rate_virtual_cents: null, notes: 'Weekly' },
      }),
    );
  });

  it('offers the tutor’s and the student’s places, and saves the pairing’s set when it changes', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin-1', roles: ['admin'] } });
    mockUpdate.mockResolvedValue({});
    mockSetLocations.mockResolvedValue({});
    const place = (id: string, owner: string, kind: 'physical' | 'virtual') => ({
      id,
      owner_user_id: owner,
      owner_name: owner === TUTOR_ID ? 'Alex Chen' : 'Sofia Okafor',
      name: id,
      kind,
      address: null,
      reminder_minutes: 0,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    });
    const room = place('room', TUTOR_ID, 'physical');
    const online = place('online', TUTOR_ID, 'virtual');
    const home = place('home', 'student', 'physical');
    mockLocations.mockImplementation((userId: string | null) => ({
      isPending: false,
      data: { data: userId === TUTOR_ID ? [room, online] : [home] },
    }));
    await renderWithProviders(<AssignmentForm existing={pairing({ locations: [room, online, home] })} />);
    expect(screen.getByTestId('assignment-location-home')).toBeOnTheScreen();
    expect(screen.getByLabelText('room · In person · Alex Chen')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('assignment-location-home'));
    await fireEvent.press(screen.getByTestId('assignment-save'));
    await waitFor(() =>
      expect(mockSetLocations).toHaveBeenCalledWith({ assignmentId: 'a1', locationIds: ['room', 'online'] }),
    );
  });

  it('asks for a tutor and a student before creating', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin-1', roles: ['admin'] } });
    await renderWithProviders(<AssignmentForm existing={null} />);
    await fireEvent.press(screen.getByTestId('assignment-save'));
    expect(await screen.findByText('Choose a tutor.')).toBeOnTheScreen();
    expect(screen.getByText('Choose a student.')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
