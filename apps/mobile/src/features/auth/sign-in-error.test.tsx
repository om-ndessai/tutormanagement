import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { SignInError } from './sign-in-error';

describe('SignInError', () => {
  it('says a rate limit calmly: no alert, and what to do (Phase 51)', async () => {
    await renderWithProviders(<SignInError code="rate_limited" message="Too many tries. Try again in 42 seconds." />);
    expect(screen.getByTestId('sign-in-error').props.accessibilityRole).toBeUndefined();
    expect(screen.getByText('Wait a minute, then try again.')).toBeTruthy();
  });

  it('is an alert for a refusal', async () => {
    await renderWithProviders(<SignInError code="no_account" message="Not authorized." />);
    expect(screen.getByTestId('sign-in-error').props.accessibilityRole).toBe('alert');
    expect(screen.queryByTestId('sign-in-signup')).toBeNull();
  });

  it('offers to sign up an address the server does not know (developer sign-in, Phase 52)', async () => {
    const onSignUp = jest.fn();
    await renderWithProviders(
      <SignInError code="not_found" message="No such person." signUpEmail="sam@example.com" onSignUp={onSignUp} />,
    );
    expect(screen.getByText('Sign up as sam@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sign-in-signup'));
    expect(onSignUp).toHaveBeenCalled();
  });
});
