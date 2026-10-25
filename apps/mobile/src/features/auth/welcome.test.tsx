import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { Welcome } from './welcome';

describe('Welcome', () => {
  it('shows the platform drawn as its wordmark, its promise and its four steps', async () => {
    await renderWithProviders(<Welcome busy={false} onSignIn={() => undefined} />);
    expect(screen.getByLabelText('AimTrue')).toBeTruthy();
    expect(screen.getByText('Set Goals. Aim True')).toBeTruthy();
    expect(screen.getByLabelText('Goals, Assess, Plan, Track')).toBeTruthy();
  });

  it('signs in from its one button', async () => {
    const onSignIn = jest.fn();
    await renderWithProviders(<Welcome busy={false} onSignIn={onSignIn} />);
    await fireEvent.press(screen.getByTestId('sign-in-google'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('says continuing accepts the terms, with a link to each (Phase 51)', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithProviders(<Welcome busy={false} onSignIn={() => undefined} />);
    expect(screen.getByTestId('sign-in-legal')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sign-in-terms'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/\/terms$/));
    await fireEvent.press(screen.getByTestId('sign-in-privacy'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/\/privacy$/));
    open.mockRestore();
  });
});
