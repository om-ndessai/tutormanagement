// Phase 62 (P6): a game opened from Home's Play home exits back to Home; any other exits to the Quest hub.
import { exitGame } from './quest-frame';

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    dismissTo: (to: unknown) => mockDismissTo(to),
    canGoBack: () => mockCanGoBack,
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});

describe('exitGame', () => {
  it('goes back to Home when the Play home opened the game', () => {
    exitGame('home');
    expect(mockBack).toHaveBeenCalled();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('goes to the Quest hub otherwise, or when there is nothing to go back to', () => {
    exitGame(undefined);
    expect(mockDismissTo).toHaveBeenCalledWith('/quest');
    mockCanGoBack = false;
    exitGame('home');
    expect(mockDismissTo).toHaveBeenCalledTimes(2);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
