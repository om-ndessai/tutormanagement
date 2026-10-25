import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { SignUpScreen } from './sign-up-screen';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const completeSignup = jest.fn();
const cancelSignup = jest.fn(async () => undefined);
function as(pending: Record<string, unknown>) {
  mockAuth.mockReturnValue({ pendingSignup: pending, completeSignup, cancelSignup });
}
const GOOGLE = { token: 't', email: 'nina@example.com', name: 'Nina Newcomer', dev: false };
const DEV = { token: null, email: 'sam.signup@example.com', name: 'sam.signup@example.com', dev: true };

async function fill() {
  await fireEvent.press(screen.getByTestId('signup-month'));
  await fireEvent.press(screen.getByTestId('signup-month-6'));
  await fireEvent.press(screen.getByTestId('signup-year'));
  await fireEvent.changeText(screen.getByTestId('signup-year-search'), '1990');
  await fireEvent.press(screen.getByTestId('signup-year-1990'));
}

beforeEach(() => {
  completeSignup.mockReset();
  cancelSignup.mockClear();
});

describe('SignUpScreen (Phase 52)', () => {
  it('greets the person, and holds Continue until the month, the year and the tick', async () => {
    as(GOOGLE);
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByText('Welcome, Nina')).toBeTruthy();
    expect(screen.queryByTestId('signup-dev-name')).toBeNull();
    expect(screen.getByTestId('signup-submit')).toBeDisabled();
    await fill();
    expect(screen.getByTestId('signup-submit')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    expect(screen.getByTestId('signup-submit')).toBeEnabled();
    completeSignup.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(completeSignup).toHaveBeenCalledWith({ birth_year: 1990, birth_month: 6 });
  });

  it('asks a child to have a parent add them, and Back clears the sign-up', async () => {
    as(GOOGLE);
    completeSignup.mockRejectedValue(new ApiRequestError(403, 'too_young', 'You need to be 13 or older.'));
    await renderWithProviders(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('signup-too-young')).toBeTruthy();
    expect(screen.getByText('Ask a parent to add you')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('signup-too-young-back'));
    expect(cancelSignup).toHaveBeenCalled();
  });

  it('shows any other refusal in the server’s words', async () => {
    as(GOOGLE);
    completeSignup.mockRejectedValue(new ApiRequestError(409, 'conflict', 'That address already has an account.'));
    await renderWithProviders(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    await waitFor(() => expect(screen.getByTestId('signup-error')).toHaveTextContent('That address already has an account.'));
  });

  it('opens the terms and the privacy notice on the portal’s address', async () => {
    as(GOOGLE);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.press(screen.getByTestId('signup-terms'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/\/terms$/));
    await fireEvent.press(screen.getByTestId('signup-privacy'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/\/privacy$/));
    open.mockRestore();
  });

  it('asks a developer sign-up for a name, and sends it', async () => {
    as(DEV);
    completeSignup.mockResolvedValue(undefined);
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('signup-dev-name'), 'Sam Signup');
    expect(screen.getByText('Welcome, Sam')).toBeTruthy();
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(completeSignup).toHaveBeenCalledWith({ birth_year: 1990, birth_month: 6, dev_name: 'Sam Signup' });
  });
});
