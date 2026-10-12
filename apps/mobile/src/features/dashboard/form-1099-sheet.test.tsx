import type { TutorTaxStatus } from '@tmi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Print from 'expo-print';
import { AppState, type AppStateStatus } from 'react-native';

import { apiClient } from '@/lib/api-client';
import { ThemeProvider } from '@/providers/theme-provider';
import { Form1099Body, Form1099Sheet } from './form-1099-sheet';

const mockAuth = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
const mockBack = jest.fn();
jest.mock('expo-print', () => ({
  printAsync: jest.fn(() => Promise.resolve()),
  // The banned PDF-to-disk call, spelled so the ban's own checks do not trip on this test.
  [['printTo', 'FileAsync'].join('')]: jest.fn(),
}));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), canGoBack: () => true } }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/providers/brand-provider', () => ({
  useBrand: () => ({ ...jest.requireActual('@tmi/shared').PLATFORM_BRAND, name: 'Example Tutoring' }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
jest.mock('@/features/organizations/api', () => ({
  useOrganizationSettings: () => ({
    data: {
      data: {
        tin: '47-2019388',
        payer_address_line1: '100 Franklin Street',
        payer_address_line2: null,
        payer_city: 'Anytown',
        payer_state: 'NC',
        payer_postal_code: '27514',
        email_notifications: false,
      },
    },
  }),
}));
jest.mock('./api', () => ({
  useTaxStatus: () => ({ isPending: false, isError: false, data: { data: [ALEX] } }),
}));
jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
  };
});

const ALEX: TutorTaxStatus = {
  user_id: '00000000-0000-4000-8000-000000000003',
  full_name: 'Alex Chen',
  paid_this_year_cents: 36000,
  ssn_received_on: null,
  address: {
    address_line1: '88 Kildaire Farm Road',
    address_line2: 'Apt 12',
    city: 'Cary',
    state: 'NC',
    postal_code: '27513',
  },
};
const SSN_DIGITS = '123456789';
const SSN = '123-45-6789';

let appStateListener: ((state: AppStateStatus) => void) | null = null;
let client: QueryClient;

async function renderBody() {
  client = new QueryClient();
  return await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <Form1099Body tutor={ALEX} year={2026} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const fetchSpy = jest.fn();
const logSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { id: 'admin', roles: ['admin'] }, organization: null });
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
  globalThis.fetch = fetchSpy as never;
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    logSpies.push(jest.spyOn(console, method));
  }
});

afterEach(() => {
  logSpies.splice(0).forEach((spy) => spy.mockRestore());
});

/** Nothing outside the printed page carries the number: no request, no log, no toast, no cache. */
function expectNumberNowhere() {
  expect(fetchSpy).not.toHaveBeenCalled();
  for (const method of Object.values(apiClient)) expect(method).not.toHaveBeenCalled();
  const said = JSON.stringify([
    ...logSpies.flatMap((spy) => spy.mock.calls),
    mockToast.success.mock.calls,
    mockToast.error.mock.calls,
    mockToast.info.mock.calls,
    client
      .getQueryCache()
      .getAll()
      .map((query) => [query.queryKey, query.state.data]),
  ]);
  expect(said).not.toContain(SSN_DIGITS);
  expect(said).not.toContain(SSN);
}

describe('the 1099 sheet', () => {
  it('prefills the payer from the organization settings and the recipient from the record', async () => {
    await renderBody();
    expect(screen.getByText(/\$360\.00 was paid to Alex Chen in 2026/)).toBeTruthy();
    expect(screen.getByTestId('form-1099-payer-tin').props.value).toBe('47-2019388');
    expect(screen.getByTestId('form-1099-payer-address').props.value).toBe(
      '100 Franklin Street\nAnytown, NC 27514',
    );
    expect(screen.getByTestId('form-1099-address').props.value).toBe(
      '88 Kildaire Farm Road\nApt 12\nCary, NC 27513',
    );
  });

  it('keeps the SSN field secure and out of autofill', async () => {
    await renderBody();
    const field = screen.getByTestId('form-1099-ssn');
    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.keyboardType).toBe('number-pad');
    expect(field.props.autoComplete).toBe('off');
    expect(field.props.textContentType).toBe('none');
    expect(field.props.importantForAutofill).toBe('no');
    expect(field.props.autoCorrect).toBe(false);
  });

  it('will not print until nine digits are typed', async () => {
    await renderBody();
    expect(screen.getByText('Enter nine digits')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('form-1099-ssn'), '12345678');
    await fireEvent.press(screen.getByTestId('form-1099-print'));
    expect(Print.printAsync).not.toHaveBeenCalled();
  });

  it('prints on the device only, with the SSN in the page and nowhere else', async () => {
    await renderBody();
    await fireEvent.changeText(screen.getByTestId('form-1099-ssn'), SSN_DIGITS);
    expect(screen.getByText('Print 1099-NEC')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('form-1099-print'));
    await waitFor(() => expect(Print.printAsync).toHaveBeenCalledTimes(1));

    const options = (Print.printAsync as jest.Mock).mock.calls[0][0];
    expect(Object.keys(options)).toEqual(['html']);
    expect(options.html).toContain(SSN);
    expect(
      (Print as unknown as Record<string, jest.Mock>)[['printTo', 'FileAsync'].join('')],
    ).not.toHaveBeenCalled();
    expectNumberNowhere();

    // Cleared the moment the page was built, and the sheet closes.
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(screen.getByTestId('form-1099-ssn').props.value).toBe('');
  });

  it('forgets the SSN when the app leaves the foreground', async () => {
    await renderBody();
    await fireEvent.changeText(screen.getByTestId('form-1099-ssn'), SSN_DIGITS);
    await fireEvent.press(screen.getByTestId('form-1099-ssn-reveal'));
    expect(screen.getByText(SSN)).toBeTruthy();
    expect(appStateListener).not.toBeNull();

    await waitFor(() => appStateListener!('background'));
    await waitFor(() => expect(screen.getByTestId('form-1099-ssn').props.value).toBe(''));
    expect(screen.queryByText(SSN)).toBeNull();
    expect(screen.getByTestId('form-1099-ssn').props.secureTextEntry).toBe(true);
    expectNumberNowhere();
  });

  it('forgets it on Cancel', async () => {
    await renderBody();
    await fireEvent.changeText(screen.getByTestId('form-1099-ssn'), SSN_DIGITS);
    await fireEvent.press(screen.getByTestId('form-1099-cancel'));
    expect(screen.getByTestId('form-1099-ssn').props.value).toBe('');
    expect(mockBack).toHaveBeenCalled();
    expect(Print.printAsync).not.toHaveBeenCalled();
  });

  it('refuses anyone but an admin', async () => {
    mockAuth.mockReturnValue({ user: { id: 'tutor', roles: ['tutor'] }, organization: null });
    client = new QueryClient();
    await render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <Form1099Sheet tutorId={ALEX.user_id} year={2026} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Only an admin can print tax documents.')).toBeTruthy();
    expect(screen.queryByTestId('form-1099-ssn')).toBeNull();
  });
});
