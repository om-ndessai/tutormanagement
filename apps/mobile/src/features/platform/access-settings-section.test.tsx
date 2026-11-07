import type { AccessConsoleResponse } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { AccessSettingsSection, ageBandLabel, entryLabel, providersLabel } from './access-settings-section';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

const mockSave = jest.fn();
const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockDecide = jest.fn();
let mockData: AccessConsoleResponse;
jest.mock('./api', () => ({
  useAccessConsole: () => ({ data: { data: mockData }, isPending: false, isError: false }),
  useSaveAccessMode: () => ({ mutateAsync: mockSave, isPending: false }),
  useAddAccessEntry: () => ({ mutateAsync: mockAdd, isPending: false }),
  useRemoveAccessEntry: () => ({ mutateAsync: mockRemove, isPending: false }),
  useDecideAccess: () => ({ mutateAsync: mockDecide, isPending: false }),
}));

const WAITING = {
  user_id: 'u-wait',
  full_name: 'Pat Pending',
  email: 'pat@example.com',
  age_band: '13-17' as const,
  access: 'pending' as const,
  providers: ['google', 'microsoft'],
  signed_up_at: '2026-11-03T08:00:00.000Z',
  decided_at: null,
  decided_by_name: null,
};

function console_(overrides: Partial<AccessConsoleResponse> = {}): AccessConsoleResponse {
  return {
    settings: { mode: 'postapproved' },
    list: [
      {
        id: 'e1',
        email: '*@school.org',
        provider: null,
        subject: null,
        note: 'The pilot school',
        added_at: '2026-11-02T08:00:00.000Z',
        added_by_name: 'Nav Dessai',
      },
    ],
    waiting: [WAITING],
    decided: [
      { ...WAITING, user_id: 'u-ok', full_name: 'Avery Approved', access: 'approved', decided_at: '2026-11-03T09:00:00.000Z', decided_by_name: 'Nav Dessai' },
      { ...WAITING, user_id: 'u-no', full_name: 'Dana Declined', access: 'declined', decided_at: '2026-11-03T09:00:00.000Z', decided_by_name: 'Nav Dessai' },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockPush.mockReset();
  [mockSave, mockAdd, mockRemove, mockDecide].forEach((mock) => mock.mockReset().mockResolvedValue({ data: {} }));
  mockData = console_();
});

describe('AccessSettingsSection (Phase 65)', () => {
  it('shows the mode, its description, the count, the list, who waits and who was decided', async () => {
    await renderWithProviders(<AccessSettingsSection />);
    expect(screen.getByText('Sign-up access · 1 waiting')).toBeTruthy();
    expect(screen.getByTestId('access-mode-postapproved').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('access-mode-description')).toHaveTextContent(
      'Anyone may sign up, then waits until a platform admin approves them.',
    );
    expect(screen.getByTestId('access-list-row-e1')).toHaveTextContent(/\*@school\.org/);
    expect(screen.getByTestId('access-list-row-e1')).toHaveTextContent(/The pilot school/);
    expect(screen.getByTestId('access-waiting-u-wait')).toHaveTextContent(/13-17 · Google and Microsoft · signed up Nov 3, 2026/);
    expect(screen.getByTestId('access-revoke-u-ok')).toBeTruthy();
    expect(screen.getByTestId('access-approve-u-no')).toBeTruthy();
    expect(screen.queryByTestId('access-revoke-u-no')).toBeNull();
  });

  it('saves a mode with PUT', async () => {
    await renderWithProviders(<AccessSettingsSection />);
    await fireEvent.press(screen.getByTestId('access-mode-open'));
    expect(mockSave).toHaveBeenCalledWith({ mode: 'open' });
  });

  it('under Open with nobody waiting and an empty list, shows only the choice', async () => {
    mockData = console_({ settings: { mode: 'open' }, list: [], waiting: [], decided: [] });
    await renderWithProviders(<AccessSettingsSection />);
    expect(screen.getByText('Sign-up access')).toBeTruthy();
    expect(screen.queryByTestId('access-list')).toBeNull();
    expect(screen.queryByTestId('access-waiting')).toBeNull();
    expect(screen.queryByTestId('access-decided')).toBeNull();
  });

  it('checks an entry with the shared schema before sending it, and shows the server’s refusal', async () => {
    await renderWithProviders(<AccessSettingsSection />);
    await fireEvent.changeText(screen.getByTestId('access-list-add-email'), 'not an email');
    await fireEvent.press(screen.getByTestId('access-list-add'));
    expect(mockAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('access-list-error')).toHaveTextContent(/does not look like an email/);

    const { ApiRequestError } = jest.requireActual<typeof import('@/lib/api-client')>('@/lib/api-client');
    mockAdd.mockRejectedValueOnce(new ApiRequestError(422, 'validation_failed', 'That address is already on the list.'));
    await fireEvent.changeText(screen.getByTestId('access-list-add-email'), ' Sam@Example.com ');
    await fireEvent.changeText(screen.getByTestId('access-list-add-note'), 'Pilot');
    await fireEvent.press(screen.getByTestId('access-list-add'));
    expect(mockAdd).toHaveBeenCalledWith({ email: 'sam@example.com', note: 'Pilot' });
    await waitFor(() => expect(screen.getByTestId('access-list-error')).toHaveTextContent('That address is already on the list.'));
  });

  it('removes an entry after confirming', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithProviders(<AccessSettingsSection />);
    await fireEvent.press(screen.getByTestId('access-list-remove-e1'));
    const buttons = alert.mock.calls[0]![2]!;
    buttons.find((b) => b.text === 'Remove')!.onPress!();
    expect(mockRemove).toHaveBeenCalledWith('e1');
    alert.mockRestore();
  });

  it('approves through the sheet (Phase 80, A11); declines and revokes after confirming', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithProviders(<AccessSettingsSection />);
    await fireEvent.press(screen.getByTestId('access-approve-u-wait'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/approve-account', params: { user: 'u-wait' } });
    expect(mockDecide).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('access-decline-u-wait'));
    alert.mock.calls[0]![2]!.find((b) => b.text === 'Decline')!.onPress!();
    expect(mockDecide).toHaveBeenCalledWith({ userId: 'u-wait', access: 'declined' });

    await fireEvent.press(screen.getByTestId('access-revoke-u-ok'));
    alert.mock.calls[1]![2]!.find((b) => b.text === 'Revoke')!.onPress!();
    expect(mockDecide).toHaveBeenCalledWith({ userId: 'u-ok', access: 'declined' });

    // A declined account is approved through the same sheet.
    await fireEvent.press(screen.getByTestId('access-approve-u-no'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/approve-account', params: { user: 'u-no' } });
    expect(mockDecide).not.toHaveBeenCalledWith(expect.objectContaining({ access: 'approved' }));
    alert.mockRestore();
  });

  it('says where an approval placed someone (Phase 80): joined, or asked to join for them', async () => {
    mockData = console_({
      decided: [
        { ...WAITING, user_id: 'u-in', full_name: 'Ida In', access: 'approved', placed_in: { name: 'Chapel Hill Math Institute', how: 'joined' } },
        { ...WAITING, user_id: 'u-ask', full_name: 'Abe Asked', access: 'approved', placed_in: { name: 'Ferreira Family Practice', how: 'requested' } },
        { ...WAITING, user_id: 'u-own', full_name: 'Oli Own', access: 'approved', placed_in: null },
        { ...WAITING, user_id: 'u-old', full_name: 'Dee Declined', access: 'declined', placed_in: { name: 'Gone', how: 'joined' } },
      ],
    });
    await renderWithProviders(<AccessSettingsSection />);
    expect(screen.getByTestId('access-placed-u-in')).toHaveTextContent('Joined Chapel Hill Math Institute');
    expect(screen.getByTestId('access-placed-u-ask')).toHaveTextContent('Asked to join Ferreira Family Practice');
    expect(screen.queryByTestId('access-placed-u-own')).toBeNull();
    // Only an approval stands where it placed them.
    expect(screen.queryByTestId('access-placed-u-old')).toBeNull();
  });
});

describe('access labels', () => {
  it('words the age band, the ways in and an entry', () => {
    expect(ageBandLabel('adult')).toBe('Adult');
    expect(ageBandLabel('13-17')).toBe('13-17');
    expect(providersLabel(['google'])).toBe('Google');
    expect(providersLabel(['google', 'microsoft', 'facebook'])).toBe('Google, Microsoft and Facebook');
    expect(providersLabel([])).toBe('Developer sign-in');
    expect(entryLabel({ email: null, provider: 'google', subject: '1234' })).toBe('google: 1234');
  });
});
