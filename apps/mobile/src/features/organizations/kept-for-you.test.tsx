// Phase 72 (UI audit JF4, JF9; owner 2026-11-04): the first home offers what a signed-out visit left on this phone,
// once -- a code typed ("Use it" opens the code sheet on it) or a quest a friend sent ("Play it" starts it here);
// "Not now" forgets both. Nothing when the phone kept nothing.
import { fireEvent, screen } from '@testing-library/react-native';

import { guestMemory, resetGuestMemoryForTests } from '@/features/guest/guest-store';
import { renderWithProviders } from '@/test/render';
import { KeptForYou } from './kept-for-you';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (to: unknown) => mockPush(to) } }));

beforeEach(() => {
  mockPush.mockReset();
});

it('is nothing when this phone kept nothing', async () => {
  resetGuestMemoryForTests({});
  await renderWithProviders(<KeptForYou />);
  expect(screen.queryByTestId('home-kept')).toBeNull();
});

it('offers a kept code first, and Use it opens the code sheet on it', async () => {
  resetGuestMemoryForTests({ keptCode: 'FMXY2345', sentTile: 'G4T10' });
  await renderWithProviders(<KeptForYou />);
  expect(screen.getByTestId('home-kept-line')).toHaveTextContent('You kept a code on this device: FMXY2345');
  expect(screen.getByTestId('home-kept-use')).toHaveTextContent('Use it');
  await fireEvent.press(screen.getByTestId('home-kept-use'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/have-a-code', params: { code: 'FMXY2345' } });
  expect(screen.queryByTestId('home-kept')).toBeNull();
  // The sent quest goes with it; the code itself is forgotten by the sheet once looked up.
  expect(guestMemory.sentTile()).toBeUndefined();
  expect(guestMemory.keptCode()).toBe('FMXY2345');
});

it('offers a quest a friend sent by its name, and Play it starts it here', async () => {
  resetGuestMemoryForTests({ sentTile: 'G4T10' });
  await renderWithProviders(<KeptForYou />);
  expect(screen.getByTestId('home-kept-line')).toHaveTextContent(/^You were sent a quest: .*Grade 4$/);
  expect(screen.getByTestId('home-kept-use')).toHaveTextContent('Play it');
  await fireEvent.press(screen.getByTestId('home-kept-use'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/quest/tile/[code]', params: { code: 'G4T10' } });
  expect(guestMemory.sentTile()).toBeUndefined();
});

it('Not now forgets both, so the next home offers nothing', async () => {
  resetGuestMemoryForTests({ keptCode: 'ABC234', sentTile: 'G4T10' });
  await renderWithProviders(<KeptForYou />);
  await fireEvent.press(screen.getByTestId('home-kept-later'));
  expect(screen.queryByTestId('home-kept')).toBeNull();
  expect(guestMemory.keptCode()).toBeUndefined();
  expect(guestMemory.sentTile()).toBeUndefined();
  expect(mockPush).not.toHaveBeenCalled();
  await screen.unmount();
  await renderWithProviders(<KeptForYou />);
  expect(screen.queryByTestId('home-kept')).toBeNull();
});
