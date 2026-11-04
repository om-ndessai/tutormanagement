// Phase 67 (H5-H6): the shared Quest board pieces -- a member's card wears its grade's hue (tokens, never
// a literal), a guest's its mode's colour; "Adv" marks a harder track; the grade row is a radio group whose
// chosen chip wears its grade's hue on the member home and the brand's on the guest home.
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PALETTE_TOKENS } from '@/theme/palettes.generated';
import { renderWithProviders } from '@/test/render';
import { GradeRow, QuestCard, TodayCard } from './quest-card';

const light = PALETTE_TOKENS.platform.light;

/** Every background colour drawn under a node. */
function fills(node: ReturnType<typeof screen.getByTestId>): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const props = (n as { props?: { style?: unknown } }).props;
    const style = StyleSheet.flatten(props?.style as never) as { backgroundColor?: string } | undefined;
    if (style?.backgroundColor) out.push(style.backgroundColor);
    for (const child of (n as { children?: unknown[] }).children ?? []) walk(child);
  };
  walk(node);
  return out;
}

describe('QuestCard', () => {
  it("wears its grade's hue and says its level in words; Adv on a harder track", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <QuestCard
        testID="card"
        pressTestID="card-start"
        label="Start BA4Q5: Quick 5, Beast Academy 4, 5 questions"
        title="Quick 5"
        detail="5 questions"
        level="Beast Academy 4"
        icon="target"
        tone={{ grade: 4 }}
        advanced
        code="BA4Q5"
        onPress={onPress}
      />,
    );
    expect(fills(screen.getByTestId('card'))).toContain(light.grade4);
    expect(screen.getByText('ADV')).toBeTruthy();
    expect(screen.getByText('Beast Academy 4')).toBeTruthy();
    expect(screen.getByText('BA4Q5')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('card-start'));
    expect(onPress).toHaveBeenCalled();
  });

  it("keeps the guest's mode colours: amber for the clock, the brand for a count", async () => {
    await renderWithProviders(
      <>
        <QuestCard testID="timed" label="t" title="5-minute dash" detail="Beat the clock" icon="timer" tone={{ mode: 'timed' }} onPress={jest.fn()} />
        <QuestCard testID="count" label="c" title="Quick 5" detail="5 questions" icon="target" tone={{ mode: 'count' }} onPress={jest.fn()} />
      </>,
    );
    expect(fills(screen.getByTestId('timed'))).toContain(light.warning);
    expect(fills(screen.getByTestId('count'))).toContain(light.primary);
    expect(screen.queryByText('ADV')).toBeNull();
  });
});

describe('GradeRow', () => {
  it("is a radio group; the chosen chip wears its grade's hue when hued", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<GradeRow grades={[3, 4, 6]} value={4} onChange={onChange} testIDPrefix="g-" hued />);
    expect(screen.getByTestId('g-4').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('g-3').props.accessibilityState).toMatchObject({ checked: false });
    expect(StyleSheet.flatten(screen.getByTestId('g-4').props.style).backgroundColor).toBe(light.grade4);
    expect(screen.queryByTestId('g-5')).toBeNull();
    await fireEvent.press(screen.getByTestId('g-6'));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("wears the brand's colour on the guest home", async () => {
    await renderWithProviders(<GradeRow grades={[1, 2]} value={2} onChange={jest.fn()} testIDPrefix="g-" />);
    expect(StyleSheet.flatten(screen.getByTestId('g-2').props.style).backgroundColor).toBe(light.primary);
  });
});

describe('TodayCard', () => {
  it('draws the rings and says them aloud; no button without onPlay', async () => {
    await renderWithProviders(
      <TodayCard
        testID="today"
        eyebrow="Today's Daily · G4D"
        title="You hit 2 of 5 today."
        states={['hit', 'miss', 'hit', 'miss', 'miss']}
        ringsTestID="rings"
        ringsLabel="2 hit of 5"
        playLabel="Play"
        playIcon="play"
        playTestID="play"
      />,
    );
    expect(screen.getByTestId('rings').props.accessibilityLabel).toBe('2 hit of 5');
    expect(screen.queryByTestId('play')).toBeNull();
  });
});
