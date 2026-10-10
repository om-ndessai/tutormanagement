// The layouts under large text (ux-audit F-12): what adapts from a font scale of 1.35.
import { fireEvent, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { isLargeText, scaledIconSize } from '@/hooks/use-large-text';
import { countOf } from '@/lib/plural';
import { formatPlainDay, readableDates } from '@/features/teaching/session-format';
import { carouselWidths } from '@/features/dashboard/carousel-model';
import { renderWithProviders } from '@/test/render';
import { PageIntro } from './page-intro';
import { StatCard, StatGrid } from './stat-card';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

type Node = ReturnType<typeof screen.getByTestId>;

/** The nearest native view above an element: a StatGrid row. */
function hostParent(node: Node): Node | null {
  let parent = node.parent as Node | null;
  while (parent && typeof parent.type !== 'string') parent = parent.parent as Node | null;
  return parent;
}

function setFontScale(fontScale: number) {
  const window = Dimensions.get('window');
  const screenSize = Dimensions.get('screen');
  // Set before rendering, so no update needs wrapping in act().
  Dimensions.set({ window: { ...window, fontScale }, screen: { ...screenSize, fontScale } });
}

beforeEach(() => setFontScale(1));
afterEach(() => setFontScale(1));

describe('large text', () => {
  it('adapts from 1.35, and caps icon growth at 1.6x', () => {
    expect(isLargeText(1)).toBe(false);
    expect(isLargeText(1.3)).toBe(false);
    expect(isLargeText(1.35)).toBe(true);
    expect(scaledIconSize(16, 1)).toBe(16);
    expect(scaledIconSize(16, 1.25)).toBe(20);
    expect(scaledIconSize(16, 3.1)).toBe(26);
  });

  it('grows carousel cards with the text, never past the screen', () => {
    expect(carouselWidths(1).card).toBe(224);
    expect(carouselWidths(1.5).card).toBe(336);
    expect(carouselWidths(3, 358)).toMatchObject({ card: 358, next: 358 });
  });

  it('puts stat cards one to a row under large text, two otherwise', async () => {
    const grid = (
      <StatGrid>
        {[
          <StatCard key="a" label="Sessions" value={2} icon="book" animate={false} />,
          <StatCard key="b" label="Time taught" value={3} icon="clock" animate={false} />,
        ]}
      </StatGrid>
    );
    await renderWithProviders(grid);
    const row = (id: string) => hostParent(screen.getByTestId(id));
    expect(row('stat-sessions')).toBe(row('stat-time-taught'));
    await screen.unmount();
    setFontScale(2);
    await renderWithProviders(grid);
    expect(row('stat-sessions')).not.toBe(row('stat-time-taught'));
  });

  it('folds a page intro into "About this page" under large text', async () => {
    await renderWithProviders(<PageIntro testID="intro">Standing weekly lessons.</PageIntro>);
    expect(screen.getByText('Standing weekly lessons.')).toBeOnTheScreen();
    await screen.unmount();
    setFontScale(3);
    await renderWithProviders(<PageIntro testID="intro">Standing weekly lessons.</PageIntro>);
    expect(screen.queryByText('Standing weekly lessons.')).toBeNull();
    await fireEvent.press(screen.getByTestId('intro-toggle'));
    expect(screen.getByText('Standing weekly lessons.')).toBeOnTheScreen();
  });
});

describe('copy', () => {
  it('reads calendar dates as a person would (F-24)', () => {
    expect(formatPlainDay('2026-09-15', '2026-10-10')).toBe('Sep 15');
    expect(formatPlainDay('2025-12-01', '2026-10-10')).toBe('Dec 1, 2025');
    expect(readableDates('the 2026-09-15 session with Sofia Okafor', '2026-10-10')).toBe(
      'the Sep 15 session with Sofia Okafor',
    );
  });

  it('pluralises counts (F-25)', () => {
    expect(countOf(1, 'session')).toBe('1 session');
    expect(countOf(2, 'session')).toBe('2 sessions');
    expect(countOf(0, 'session')).toBe('0 sessions');
  });
});
