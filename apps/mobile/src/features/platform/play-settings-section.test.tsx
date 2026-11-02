// Phase 62 (P5): the console's Play section -- the Play home switch, the depth, the tiles with their
// guest state, members switch, order and removal, a tile added from level, kind and number (its code
// derived, a bad number or a duplicate refused), all saved together; and "Default tiles" while the
// list is not the default. Phase 64: the Daily set switch.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DEFAULT_TILES, type PlayConsoleResponse } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { PlaySettingsSection } from './play-settings-section';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn() } }));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));

const mockSave = jest.fn();
const mockReset = jest.fn();
let mockData: PlayConsoleResponse;
jest.mock('./api', () => ({
  usePlayConsole: () => ({ data: { data: mockData }, isPending: false, isError: false }),
  useSavePlay: () => ({ mutateAsync: mockSave, isPending: false }),
  useResetTiles: () => ({ mutateAsync: mockReset, isPending: false }),
}));

const strip = ({ code: _code, ...tile }: (typeof DEFAULT_TILES)[number]) => tile;
const THREE = DEFAULT_TILES.filter((t) => ['G4Q5', 'G4A5', 'BA3Q5'].includes(t.code));

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ data: {} });
  mockReset.mockResolvedValue({ data: {} });
  mockData = { settings: { play_home: true, min_depth: 50, daily: true }, tiles: THREE, is_default: false };
});

describe('PlaySettingsSection', () => {
  it('lists the tiles with their words, guest state and members switch (off and fixed for an assessment)', async () => {
    await renderWithProviders(<PlaySettingsSection />);
    expect(screen.getByTestId('tile-G4Q5')).toBeTruthy();
    expect(screen.getByText('Grade 4 · Assessment, 5 questions')).toBeTruthy();
    expect(screen.getByTestId('tile-G4Q5-guest-open').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('tile-G4A5-members').props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });
    expect(screen.getByTestId('play-settings-play-home').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('play-settings-defaults')).toBeTruthy();
  });

  it('saves the switch, the depth and the edited, reordered list together', async () => {
    await renderWithProviders(<PlaySettingsSection />);
    await fireEvent(screen.getByTestId('play-settings-play-home'), 'valueChange', false);
    await fireEvent.changeText(screen.getByTestId('play-settings-min-depth'), '80');
    await fireEvent.press(screen.getByTestId('tile-BA3Q5-guest-hidden'));
    await fireEvent(screen.getByTestId('tile-G4Q5-members'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('tile-BA3Q5-up'));
    await fireEvent.press(screen.getByTestId('tile-G4A5-remove'));
    await fireEvent.press(screen.getByTestId('play-settings-save'));
    const [g4q5, , ba3q5] = THREE.map(strip);
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        settings: { play_home: false, min_depth: 80, daily: true },
        tiles: [
          { ...g4q5, members: false },
          { ...ba3q5, guest: 'hidden' },
        ],
      }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Play settings saved.');
  });

  it('turns the Daily set off and saves it with the rest (Phase 64)', async () => {
    await renderWithProviders(<PlaySettingsSection />);
    const daily = screen.getByTestId('play-settings-daily');
    expect(daily.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('Five questions a level, the same for everyone each day, played once, with a share grid.')).toBeTruthy();
    await fireEvent(daily, 'valueChange', false);
    await fireEvent.press(screen.getByTestId('play-settings-save'));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        settings: { play_home: true, min_depth: 50, daily: false },
        tiles: THREE.map(strip),
      }),
    );
  });

  it('adds a tile from level, kind and number, its code derived; refuses a bad number and a duplicate', async () => {
    await renderWithProviders(<PlaySettingsSection />);
    // Grade 4, Questions, 5 is G4Q5: already listed.
    expect(screen.getByTestId('play-settings-draft')).toHaveTextContent('G4Q5 is already listed.');
    expect(screen.getByTestId('play-settings-add').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(screen.getByTestId('play-settings-kind-T'));
    await fireEvent.changeText(screen.getByTestId('play-settings-value'), '500');
    expect(screen.getByTestId('play-settings-draft')).toHaveTextContent(/at most/);

    await fireEvent.changeText(screen.getByTestId('play-settings-value'), '15');
    expect(screen.getByTestId('play-settings-draft')).toHaveTextContent('Grade 4 · 15 minutes');
    await fireEvent.press(screen.getByTestId('play-settings-add'));
    expect(screen.getByTestId('tile-G4T15')).toBeTruthy();
    // A new tile is locked for guests and shown to members.
    expect(screen.getByTestId('tile-G4T15-guest-locked').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('tile-G4T15-members').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('puts the default tiles back, and offers it only while the list is not the default', async () => {
    await renderWithProviders(<PlaySettingsSection />);
    await fireEvent.press(screen.getByTestId('play-settings-defaults'));
    await waitFor(() => expect(mockReset).toHaveBeenCalled());
    expect(mockToast.success).toHaveBeenCalledWith('The default tiles are back.');
  });

  it('has no "Default tiles" while the list is the default', async () => {
    mockData = { ...mockData, tiles: DEFAULT_TILES, is_default: true };
    await renderWithProviders(<PlaySettingsSection />);
    expect(screen.queryByTestId('play-settings-defaults')).toBeNull();
  });
});
