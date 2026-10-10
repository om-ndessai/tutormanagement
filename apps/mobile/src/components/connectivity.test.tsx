// The offline / unreachable banner (ux-audit F-16).
import { act, fireEvent, screen } from '@testing-library/react-native';

import { reportReachable } from '@/lib/reachability';
import { renderWithProviders } from '@/test/render';
import { ConnectivityBanner, OfflineSaveNote } from './connectivity';

afterEach(() => reportReachable(true));

describe('the connectivity banner', () => {
  it('says nothing while the server answers', async () => {
    await renderWithProviders(<ConnectivityBanner />);
    expect(screen.queryByTestId('banner-unreachable')).toBeNull();
    expect(screen.queryByTestId('banner-offline')).toBeNull();
  });

  it('says plainly when the server cannot be reached, with a way to try again', async () => {
    await renderWithProviders(<ConnectivityBanner />);
    await act(async () => reportReachable(false));
    expect(screen.getByTestId('banner-unreachable')).toBeOnTheScreen();
    expect(screen.getByText(/Cannot reach the server/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('banner-retry'));
    await act(async () => reportReachable(true));
    expect(screen.queryByTestId('banner-unreachable')).toBeNull();
  });

  it('explains a held-back Save only while offline', async () => {
    await renderWithProviders(<OfflineSaveNote offline={false} />);
    expect(screen.queryByTestId('form-offline-note')).toBeNull();
    await screen.unmount();
    await renderWithProviders(<OfflineSaveNote offline />);
    expect(screen.getByTestId('form-offline-note')).toBeOnTheScreen();
  });
});
