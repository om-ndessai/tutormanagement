import { SSN_REJECTED_MESSAGE, type NotificationLogEntry } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { OrganizationSettingsScreen } from './organization-settings-screen';
import { validateForm } from './settings-form';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockSettings = jest.fn();
const mockNotifications = jest.fn();
const mockPatch = jest.fn();
jest.mock('./api', () => ({
  useOrganizationSettings: (enabled: boolean) => mockSettings(enabled),
  useOrganizationNotifications: (enabled: boolean) => mockNotifications(enabled),
  useUpdateOrganizationSettings: () => ({ mutateAsync: mockPatch, isPending: false }),
}));

const ORGANIZATION = { name: 'Chapel Hill Math', palette: 'indigo', time_zone: 'America/New_York' };
const SETTINGS = {
  tin: '47-2019388',
  payer_address_line1: '100 Franklin Street',
  payer_address_line2: null,
  payer_city: 'Chapel Hill',
  payer_state: 'NC',
  payer_postal_code: '27514',
  email_notifications: true,
};
const LOG: NotificationLogEntry[] = [
  {
    id: 'n1',
    kind: 'session_recorded',
    subject_user_id: 's',
    subject_name: 'Sofia Okafor',
    recipient_user_id: 'm',
    recipient_name: 'Maria Okafor',
    status: 'skipped',
    detail: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'n2',
    kind: 'user_added',
    subject_user_id: 'b',
    subject_name: 'Ben Whitfield',
    recipient_user_id: 'b',
    recipient_name: 'Ben Whitfield',
    status: 'failed',
    detail: 'destination not verified',
    created_at: new Date().toISOString(),
  },
];

function asAdmin(isAdmin = true) {
  mockAuth.mockReturnValue({
    organization: ORGANIZATION,
    user: { id: 'p', roles: isAdmin ? ['admin', 'tutor'] : ['tutor'] },
  });
  mockSettings.mockReturnValue({
    data: isAdmin ? { data: SETTINGS } : undefined,
    isPending: !isAdmin,
    isError: false,
    dataUpdatedAt: 1,
    refetch: jest.fn(),
  });
  mockNotifications.mockReturnValue({ data: isAdmin ? { data: LOG } : undefined, refetch: jest.fn() });
}

beforeEach(() => {
  mockPatch.mockReset();
  mockSettings.mockReset();
  mockNotifications.mockReset();
});

describe('OrganizationSettingsScreen', () => {
  it('shows a non-admin the stub, and asks for nothing', async () => {
    asAdmin(false);
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByText('Only an administrator can see the organization’s settings.')).toBeTruthy();
    expect(mockSettings).toHaveBeenCalledWith(false);
    expect(mockNotifications).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('org-tin')).toBeNull();
  });

  it('prefills the payer box and shows what the platform sets', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByTestId('org-tin').props.value).toBe('47-2019388');
    expect(screen.getByTestId('org-payer_city').props.value).toBe('Chapel Hill');
    expect(screen.getByText('Eastern time', { exact: false })).toBeTruthy();
  });

  it('refuses an SSN-shaped TIN on the device, with the shared sentence and no request', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    await fireEvent.changeText(screen.getByTestId('org-tin'), '123-45-6789');
    await fireEvent.press(screen.getByTestId('org-save'));
    expect(await screen.findByText(SSN_REJECTED_MESSAGE)).toBeTruthy();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('saves the payer fields only', async () => {
    asAdmin();
    mockPatch.mockResolvedValue({});
    await renderWithProviders(<OrganizationSettingsScreen />);
    await fireEvent.changeText(screen.getByTestId('org-payer_address_line1'), '200 Rosemary Street');
    await fireEvent.press(screen.getByTestId('org-save'));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({
        tin: '47-2019388',
        payer_address_line1: '200 Rosemary Street',
        payer_address_line2: '',
        payer_city: 'Chapel Hill',
        payer_state: 'NC',
        payer_postal_code: '27514',
      }),
    );
  });

  it('lists recent emails by name, kind and outcome', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByText('Maria Okafor')).toBeTruthy();
    expect(screen.getByText(/Session recorded · Sofia Okafor/)).toBeTruthy();
    expect(screen.getByText('Not sent here')).toBeTruthy();
    expect(screen.getByText('Not delivered')).toBeTruthy();
    // The subject is not repeated when the email went to them.
    expect(screen.queryByText(/Added to the organization · Ben Whitfield/)).toBeNull();
  });
});

describe('validateForm', () => {
  it('passes blanks and a ZIP, refuses a bad ZIP', () => {
    expect(
      validateForm({
        tin: '',
        payer_address_line1: '',
        payer_address_line2: '',
        payer_city: '',
        payer_state: '',
        payer_postal_code: '27514',
      }).ok,
    ).toBe(true);
    const verdict = validateForm({
      tin: '',
      payer_address_line1: '',
      payer_address_line2: '',
      payer_city: '',
      payer_state: '',
      payer_postal_code: '275',
    });
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.errors.payer_postal_code).toBe('Use a 5-digit ZIP code.');
  });
});
