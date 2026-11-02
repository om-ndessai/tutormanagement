import type { SignInSettingsResponse } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { SignInSettingsSection, inForceLine, untilLabel } from './sign-in-settings-section';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn() } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

const mockUpdate = jest.fn();
let mockData: SignInSettingsResponse;
jest.mock('./api', () => ({
  useSignInSettings: () => ({ data: { data: mockData }, isPending: false, isError: false }),
  useUpdateSignInSetting: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

const UNTIL = '2026-11-01T21:30:00.000Z';

function response(overrides: Partial<SignInSettingsResponse> = {}): SignInSettingsResponse {
  return {
    configured: ['google', 'microsoft', 'facebook'],
    clients: [
      {
        client: 'web',
        effective: { providers: ['google'], signup_open: false, source: 'defaults', until: null },
        defaults: { providers: ['google'], signup_open: false },
        setting: null,
      },
      {
        client: 'app',
        effective: { providers: ['google', 'facebook'], signup_open: true, source: 'console', until: UNTIL },
        defaults: { providers: ['google'], signup_open: false },
        setting: { providers: ['facebook'], signup_open: true, until: UNTIL },
      },
    ],
    ...overrides,
  };
}

describe('SignInSettingsSection', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({ data: response() });
    mockData = response();
  });

  it('says what is in force for each client, in words', async () => {
    await renderWithProviders(<SignInSettingsSection />);
    expect(screen.getByTestId('platform-sign-in-web-in-force')).toHaveTextContent(
      "This address's defaults: Google · sign-up closed",
    );
    expect(screen.getByTestId('platform-sign-in-app-in-force')).toHaveTextContent(
      `Google and Facebook · sign-up open · until ${untilLabel(UNTIL)}`,
    );
    // Only a client with a stored setting can go back to the defaults.
    expect(screen.queryByTestId('platform-sign-in-web-defaults')).toBeNull();
    expect(screen.getByTestId('platform-sign-in-app-defaults')).toBeTruthy();
  });

  it('shows a provider this address has not set up off and disabled', async () => {
    await renderWithProviders(<SignInSettingsSection />);
    const apple = screen.getByTestId('platform-sign-in-app-apple');
    expect(apple.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    expect(screen.getAllByText('Not set up here')).toHaveLength(2);
    // Prefilled from the stored setting while it is in force.
    expect(screen.getByTestId('platform-sign-in-app-facebook').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('platform-sign-in-app-signup').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('saves the chosen switches for 3 hours by default, or for the chosen duration', async () => {
    await renderWithProviders(<SignInSettingsSection />);
    await fireEvent(screen.getByTestId('platform-sign-in-web-microsoft'), 'valueChange', true);
    await fireEvent(screen.getByTestId('platform-sign-in-web-signup'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('platform-sign-in-web-save'));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        client: 'web',
        setting: { providers: ['microsoft'], signup_open: true, hours: 3 },
      }),
    );

    await fireEvent.press(screen.getByTestId('platform-sign-in-app-hours-until-changed'));
    await fireEvent(screen.getByTestId('platform-sign-in-app-facebook'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('platform-sign-in-app-save'));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenLastCalledWith({
        client: 'app',
        setting: { providers: [], signup_open: true, hours: null },
      }),
    );
  });

  it('goes back to the defaults with a null setting, after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Return to defaults')?.onPress?.();
    });
    await renderWithProviders(<SignInSettingsSection />);
    await fireEvent.press(screen.getByTestId('platform-sign-in-app-defaults'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ client: 'app', setting: null }));
    alert.mockRestore();
  });

  it('prefills from the defaults once a stored setting has lapsed', async () => {
    mockData = response({
      clients: [
        {
          client: 'app',
          effective: { providers: ['google', 'microsoft'], signup_open: true, source: 'defaults', until: null },
          defaults: { providers: ['google', 'microsoft'], signup_open: true },
          setting: { providers: ['facebook'], signup_open: false, until: '2026-10-01T00:00:00.000Z' },
        },
      ],
    });
    await renderWithProviders(<SignInSettingsSection />);
    expect(screen.getByTestId('platform-sign-in-app-microsoft').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('platform-sign-in-app-facebook').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });
});

describe('inForceLine', () => {
  it('leaves out a provider in force that this address has not set up', () => {
    const status = response().clients[1]!;
    expect(inForceLine({ ...status, setting: null, effective: { ...status.effective, until: null } }, ['google'])).toBe(
      'Google · sign-up open · until changed',
    );
  });

  it('names the weekday when the setting lapses on another day', () => {
    const now = new Date(2026, 10, 1, 20, 0);
    expect(untilLabel(new Date(2026, 10, 1, 21, 30).toISOString(), now)).toBe('9:30 PM');
    expect(untilLabel(new Date(2026, 10, 2, 0, 5).toISOString(), now)).toBe('Mon 12:05 AM');
  });
});
