import {
  ACCESS_DECLINED_MESSAGE,
  NOT_ON_LIST_MESSAGE,
  PLATFORM_CONTACT_EMAIL,
  accessPendingMessage,
} from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { AccessRefusedScreen, invitationMailto } from './access-refused-screen';

describe('AccessRefusedScreen (Phase 65)', () => {
  it.each([
    // The server's words since 2026-11-04 (UI audit JF2): who checks, and how long it usually takes.
    ['access_pending', 'Waiting for approval', accessPendingMessage('Sam Signup')],
    ['access_declined', 'Access not approved', ACCESS_DECLINED_MESSAGE],
    ['not_on_list', 'Sign-up is by invitation', NOT_ON_LIST_MESSAGE],
  ])('%s: its own title and the server’s words', async (code, title, message) => {
    await renderWithProviders(<AccessRefusedScreen code={code} message={message} onBack={jest.fn()} />);
    expect(screen.getByTestId('screen-access-refused')).toBeTruthy();
    expect(screen.getByTestId('access-refused-title')).toHaveTextContent(title);
    expect(screen.getByTestId('access-refused-message')).toHaveTextContent(message);
  });

  it('falls back to the shared words when the server sent none', async () => {
    await renderWithProviders(<AccessRefusedScreen code="access_declined" message="" onBack={jest.fn()} />);
    expect(screen.getByTestId('access-refused-message')).toHaveTextContent(ACCESS_DECLINED_MESSAGE);
  });
});

describe('AccessRefusedScreen: the next step (UI audit JF2, JF8, JF36)', () => {
  let open: jest.SpyInstance;
  beforeEach(() => {
    open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => open.mockRestore());

  it('with guest play: says play goes on, and Keep playing is the main button, in place of Back', async () => {
    const keep = jest.fn();
    await renderWithProviders(
      <AccessRefusedScreen code="access_pending" message="Waiting." onKeepPlaying={keep} />,
    );
    expect(screen.getByTestId('access-refused-keep-line')).toHaveTextContent(
      'You can keep playing without an account.',
    );
    expect(screen.getByTestId('access-refused-keep-playing')).toHaveTextContent(/Keep playing$/);
    expect(screen.queryByTestId('access-refused-back')).toBeNull();
    // Waiting or declined: nothing about invitations.
    expect(screen.queryByTestId('access-refused-ask-invitation')).toBeNull();
    expect(screen.queryByTestId('access-refused-use-another')).toBeNull();
    await fireEvent.press(screen.getByTestId('access-refused-keep-playing'));
    expect(keep).toHaveBeenCalled();
  });

  it('without guest play: no keep-playing line, and Back goes back', async () => {
    const onBack = jest.fn();
    await renderWithProviders(<AccessRefusedScreen code="access_declined" message="No." onBack={onBack} />);
    expect(screen.queryByTestId('access-refused-keep-line')).toBeNull();
    expect(screen.queryByTestId('access-refused-keep-playing')).toBeNull();
    await fireEvent.press(screen.getByTestId('access-refused-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('Contact us shows the address in full and writes to it', async () => {
    await renderWithProviders(
      <AccessRefusedScreen code="access_pending" message="Waiting." onKeepPlaying={jest.fn()} />,
    );
    expect(screen.getByTestId('access-refused-contact')).toHaveTextContent(
      `Contact us: ${PLATFORM_CONTACT_EMAIL}`,
      {
        exact: false,
      },
    );
    await fireEvent.press(screen.getByTestId('access-refused-contact'));
    expect(open).toHaveBeenCalledWith(`mailto:${PLATFORM_CONTACT_EMAIL}`);
  });

  it('not on the list: names the account, asks for an invitation with it, and offers another account', async () => {
    const another = jest.fn();
    await renderWithProviders(
      <AccessRefusedScreen
        code="not_on_list"
        message={NOT_ON_LIST_MESSAGE}
        email="pat.quinn@example.com"
        onKeepPlaying={jest.fn()}
        onUseAnother={another}
      />,
    );
    expect(screen.getByTestId('access-refused-account')).toHaveTextContent('Checked: pat.quinn@example.com');
    await fireEvent.press(screen.getByTestId('access-refused-ask-invitation'));
    expect(open).toHaveBeenCalledWith(invitationMailto('pat.quinn@example.com'));
    await fireEvent.press(screen.getByTestId('access-refused-use-another'));
    expect(another).toHaveBeenCalled();
  });

  it('not on the list, the account unknown here: the invitation asks for "me", and no account line', async () => {
    await renderWithProviders(
      <AccessRefusedScreen code="not_on_list" message={NOT_ON_LIST_MESSAGE} onBack={jest.fn()} />,
    );
    expect(screen.queryByTestId('access-refused-account')).toBeNull();
    // Without a way back to the buttons, no "Use another account".
    expect(screen.queryByTestId('access-refused-use-another')).toBeNull();
    await fireEvent.press(screen.getByTestId('access-refused-ask-invitation'));
    expect(open).toHaveBeenCalledWith(invitationMailto(null));
  });
});

describe('invitationMailto', () => {
  it('writes to the platform, with the subject and the address in the body', () => {
    const url = invitationMailto(' pat.quinn@example.com ');
    expect(url.startsWith(`mailto:${PLATFORM_CONTACT_EMAIL}?`)).toBe(true);
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(params.get('subject')).toBe('An invitation to Aimtrue');
    expect(params.get('body')).toBe('Please add pat.quinn@example.com to the sign-up list.');
  });

  it('asks for "me" when the address is not known', () => {
    const url = invitationMailto(null);
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(params.get('body')).toBe('Please add me to the sign-up list.');
  });
});

describe('the waiting words (UI audit JF2)', () => {
  it('say who checks, how long it usually takes, and to sign in again', () => {
    expect(accessPendingMessage('Sam Signup')).toBe(
      'Thanks, Sam. A person at Aimtrue checks every new account, usually within a day. Keep playing meanwhile, and sign in again tomorrow.',
    );
  });
});
