// Phase 67 (H5-H6): the shared Quest board pieces -- a card wears its grade's hue (tokens, never a literal);
// "Adv" marks a harder track; the grade row is a radio group whose chosen chip wears its grade's hue on the
// member home and the brand's on the guest home. Phase 78 (owner 2026-11-05; JF29, JF34): the guest's cards
// wear the grade hues too (no mode colour), no card prints a tile code, "Adv" is a white 12pt label on a
// dark pill, the chosen chip has a 2pt ring in the page's ink, and amber is gone from the Daily's button and
// the hit rings (the space's primary).
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, processColor } from 'react-native';
import { MD3Colors } from 'react-native-paper';

import { PALETTE_TOKENS } from '@/theme/palettes.generated';
import { renderWithProviders } from '@/test/render';
import { GradeRow, QuestCard, TodayCard, gradeScrollTarget } from './quest-card';

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
        label="Start Quick 5, Beast Academy 4, 5 questions"
        title="Quick 5"
        detail="5 questions"
        level="Beast Academy 4"
        icon="target"
        tone={{ grade: 4 }}
        advanced
        onPress={onPress}
      />,
    );
    expect(fills(screen.getByTestId('card'))).toContain(light.grade4);
    expect(screen.getByText('Beast Academy 4')).toBeTruthy();
    // No tile code on a card (JF32): the level in words is what a member reads.
    expect(screen.queryByText('BA4Q5')).toBeNull();
    await fireEvent.press(screen.getByTestId('card-start'));
    expect(onPress).toHaveBeenCalled();
  });

  it('marks a harder track "Adv": white 12pt text on black at 55%, sentence case (JF29)', async () => {
    await renderWithProviders(
      <QuestCard testID="card" label="c" title="Quick 5" detail="5 questions" icon="target" tone={{ grade: 4 }} advanced onPress={jest.fn()} />,
    );
    expect(screen.queryByText('ADV')).toBeNull();
    const text = StyleSheet.flatten(screen.getByText('Adv').props.style) as { color?: string; fontSize?: number };
    expect(text.color).toBe(MD3Colors.neutral100);
    expect(text.fontSize).toBeGreaterThanOrEqual(12);
    const under = screen.getByTestId('quest-card-adv').props.children[0];
    expect(StyleSheet.flatten(under.props.style)).toMatchObject({ opacity: 0.55 });
  });

  it('wears the grade hue on the guest page too: the mode is the icon, never amber (owner 2026-11-05)', async () => {
    await renderWithProviders(
      <>
        <QuestCard testID="timed" label="t" title="5-minute dash" detail="Beat the clock" icon="timer" tone={{ grade: 3 }} onPress={jest.fn()} />
        <QuestCard testID="off" label="c" title="Quick 5" detail="5 questions" icon="target" tone={{ grade: null }} onPress={jest.fn()} />
      </>,
    );
    expect(fills(screen.getByTestId('timed'))).toContain(light.grade3);
    expect(fills(screen.getByTestId('timed'))).not.toContain(light.warning);
    // A level off the 1-8 row wears the brand's.
    expect(fills(screen.getByTestId('off'))).toContain(light.primary);
    expect(screen.queryByText('Adv')).toBeNull();
  });
});

describe('GradeRow', () => {
  it("is a radio group; the chosen chip wears its grade's hue when hued", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<GradeRow grades={[3, 4, 6]} value={4} onChange={onChange} testIDPrefix="g-" hued />);
    expect(screen.getByTestId('g-4').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('g-3').props.accessibilityState).toMatchObject({ checked: false });
    expect(StyleSheet.flatten(screen.getByTestId('g-4-chip').props.style).backgroundColor).toBe(light.grade4);
    // JF29: the chosen chip wears a 2pt ring in the page's ink; the others none.
    expect(StyleSheet.flatten(screen.getByTestId('g-4').props.style)).toMatchObject({
      borderWidth: 2,
      borderColor: light.foreground,
    });
    expect(StyleSheet.flatten(screen.getByTestId('g-3').props.style).borderColor).toBe('transparent');
    expect(screen.queryByTestId('g-5')).toBeNull();
    await fireEvent.press(screen.getByTestId('g-6'));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("wears the brand's colour on the guest home", async () => {
    await renderWithProviders(<GradeRow grades={[1, 2]} value={2} onChange={jest.fn()} testIDPrefix="g-" />);
    expect(StyleSheet.flatten(screen.getByTestId('g-2-chip').props.style).backgroundColor).toBe(light.primary);
  });

  it('scrolls the chosen grade into view, centred, and leaves it when it is already in view (JF28)', () => {
    // Eight 52pt chips 8pt apart, a 16pt gutter: 16 + 8 * 52 + 7 * 8 + 16 = 504 wide, in a 358pt viewport.
    const row = { gutter: 16, gap: 8, viewport: 358, content: 504, offset: 0 };
    expect(gradeScrollTarget({ ...row, index: 0 })).toBeNull();
    // Grade 8 (index 7) sits at 16 + 7 * 60 = 436: scrolled to the end of the row.
    expect(gradeScrollTarget({ ...row, index: 7 })).toBe(146);
    // Grade 5 (index 4) is already in view; scrolled to the end, Grade 1 comes back to the start.
    expect(gradeScrollTarget({ ...row, index: 4 })).toBeNull();
    expect(gradeScrollTarget({ ...row, offset: 146, index: 0 })).toBe(0);
    // In a wider row, a middle grade is centred: 16 + 9 * 60 - (358 - 52) / 2.
    expect(gradeScrollTarget({ ...row, content: 1000, index: 9 })).toBe(403);
    // A row that fits never scrolls.
    expect(gradeScrollTarget({ ...row, content: 300, index: 3 })).toBeNull();
  });
});

describe('TodayCard', () => {
  it('draws the rings and says them aloud; no button without onPlay', async () => {
    await renderWithProviders(
      <TodayCard
        testID="today"
        eyebrow="Today's Daily · Grade 4"
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

  it("draws the call to play and the hit rings in the space's primary, never amber (owner 2026-11-05)", async () => {
    await renderWithProviders(
      <TodayCard
        testID="today"
        eyebrow="Today's Daily · Grade 3"
        eyebrowTestID="eyebrow"
        title="Five questions"
        states={['hit', 'open']}
        ringsTestID="rings"
        ringsLabel="1 hit of 2"
        onPlay={jest.fn()}
        playLabel="Play"
        playIcon="play"
        playTestID="play"
      />,
    );
    // Paper draws a contained button's fill on the surface around its pressable.
    const around: string[] = [];
    for (let n = screen.getByTestId('play') as { props?: { style?: unknown }; parent?: unknown } | null; n; n = n.parent as typeof n) {
      const style = StyleSheet.flatten(n.props?.style as never) as { backgroundColor?: string } | undefined;
      if (style?.backgroundColor) around.push(style.backgroundColor);
    }
    expect(around).toContain(light.primary);
    expect(around).not.toContain(light.warning);
    // react-native-svg hands its native view each stroke as a processed colour ({ payload }).
    const strokes: unknown[] = [];
    const walk = (n: unknown): void => {
      if (!n || typeof n !== 'object') return;
      const stroke = (n as { props?: { stroke?: { payload?: unknown } } }).props?.stroke;
      if (stroke?.payload !== undefined) strokes.push(stroke.payload);
      for (const child of (n as { children?: unknown[] }).children ?? []) walk(child);
    };
    walk(screen.getByTestId('rings'));
    expect(strokes).toContain(processColor(light.primary));
    expect(strokes).not.toContain(processColor(light.warning));
    // The eyebrow is sentence case (JF35).
    expect(StyleSheet.flatten(screen.getByTestId('eyebrow').props.style).textTransform).toBeUndefined();
  });
});
