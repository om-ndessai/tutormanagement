import { ACCESS_DECLINED_MESSAGE, NOT_ON_LIST_MESSAGE, PLATFORM_CONTACT_EMAIL } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { AccessRefusedScreen } from './access-refused-screen';

describe('AccessRefusedScreen (Phase 65)', () => {
  it.each([
    ['access_pending', 'Waiting for approval', 'Thanks, Sam. Your access is waiting for approval.'],
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

  it('Contact us writes to the platform; Back goes back', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const onBack = jest.fn();
    await renderWithProviders(<AccessRefusedScreen code="access_pending" message="Waiting." onBack={onBack} />);
    await fireEvent.press(screen.getByTestId('access-refused-contact'));
    expect(open).toHaveBeenCalledWith(`mailto:${PLATFORM_CONTACT_EMAIL}`);
    await fireEvent.press(screen.getByTestId('access-refused-back'));
    expect(onBack).toHaveBeenCalled();
    open.mockRestore();
  });
});
