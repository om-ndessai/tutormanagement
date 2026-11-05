// UI audit (JF2, JF8): a sign-up says the wait (Post-approved) or the list (Pre-approved) before the
// provider's button, in the shared words; Open, and an older Worker, say nothing. On the sign-in screen's
// sign-up path it sits above "Sign up as", and never with a plain refusal.
import { SIGNUP_ACCESS_NOTES } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { SignInError } from './sign-in-error';
import { SignupAccessNote, signupAccessNote } from './signup-access-note';

describe('signupAccessNote', () => {
  it('says the shared words for Post- and Pre-approved, and nothing for Open or an older Worker', () => {
    expect(signupAccessNote({ signup_access: 'postapproved' })).toBe(SIGNUP_ACCESS_NOTES.postapproved);
    expect(signupAccessNote({ signup_access: 'postapproved' })).toMatch(/checks every new account/);
    expect(signupAccessNote({ signup_access: 'preapproved' })).toBe(SIGNUP_ACCESS_NOTES.preapproved);
    expect(signupAccessNote({ signup_access: 'open' })).toBeNull();
    expect(signupAccessNote({})).toBeNull();
    expect(signupAccessNote(null)).toBeNull();
  });
});

describe('SignupAccessNote', () => {
  it('shows the note, or nothing', async () => {
    await renderWithProviders(<SignupAccessNote config={{ signup_access: 'preapproved' }} />);
    expect(screen.getByText(SIGNUP_ACCESS_NOTES.preapproved!)).toBeTruthy();
    expect(screen.getByTestId('signup-access-note')).toBeTruthy();
    await renderWithProviders(<SignupAccessNote config={{ signup_access: 'open' }} />);
    expect(screen.queryByTestId('signup-access-note')).toBeNull();
  });

  it('sits above "Sign up as" on the sign-in screen’s sign-up path, and nowhere else there', async () => {
    const note = <SignupAccessNote config={{ signup_access: 'postapproved' }} />;
    await renderWithProviders(
      <SignInError
        code="not_found"
        message="No such person."
        signUpEmail="sam@example.com"
        onSignUp={jest.fn()}
        signUpNote={note}
      />,
    );
    expect(screen.getByTestId('signup-access-note')).toBeTruthy();
    await renderWithProviders(<SignInError code="no_account" message="Not authorized." signUpNote={note} />);
    expect(screen.queryByTestId('signup-access-note')).toBeNull();
  });
});
