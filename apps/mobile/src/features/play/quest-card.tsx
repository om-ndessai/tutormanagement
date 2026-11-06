// Ported from apps/web/src/features/play/quest-card.tsx @ working tree (Phase 67, H6 in
// docs/member-home-plan.md): the guest Quest board's pieces, shared by the guest home and the member Play
// home -- a quest card, the five-ring Today card and the grade row. Both boards wear one hue per grade
// (`grade1`..`grade8` tokens, H5); since Phase 78 (owner, 2026-11-05) the guest page does too, its mode
// shown by the icon alone, and amber does one job: the Daily's button and a hit ring take the space's
// primary. A card always says its level in words, so colour is never the only signal (WCAG 1.4.1); it no
// longer prints the tile's code (codes stay in the console).
//
// Mobile: the band's icon sits at its left, as the guest board had it; a card's star (the member's
// favorite) sits just under the band, at the right. Grids are rows of `columns` with the last row's gaps
// kept empty, so no card stretches.
//
// Phase 78 (JF29, JF28): the "Adv" pill is white on a dark pill (black at 55% over the hue), 12pt, sentence
// case; the chosen grade chip wears a 2pt ring with a gap; the grade row fades at the edge it scrolls toward
// and scrolls the chosen grade into view.
import type { TileGrade, TileIcon } from '@tmi/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Icon, MD3Colors, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { OutlinedCard } from '@/components/outlined-card';
import { useAppTheme } from '@/providers/theme-provider';
import type { AppTheme } from '@/theme/paper-theme';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';

/** A card's band: a grade's hue (the brand's for a level off the row), or locked. */
export type CardTone = { grade: TileGrade | null } | 'locked';

/** A grade's hue and the ink that reads on it. */
export function gradeColors(theme: AppTheme, grade: TileGrade): { fill: string; ink: string } {
  const t = theme.tokens;
  const table: Record<TileGrade, { fill: string; ink: string }> = {
    1: { fill: t.grade1, ink: t.grade1Foreground },
    2: { fill: t.grade2, ink: t.grade2Foreground },
    3: { fill: t.grade3, ink: t.grade3Foreground },
    4: { fill: t.grade4, ink: t.grade4Foreground },
    5: { fill: t.grade5, ink: t.grade5Foreground },
    6: { fill: t.grade6, ink: t.grade6Foreground },
    7: { fill: t.grade7, ink: t.grade7Foreground },
    8: { fill: t.grade8, ink: t.grade8Foreground },
  };
  return table[grade];
}

/** The band's colour and its ink, for a tone. */
export function toneColors(theme: AppTheme, tone: CardTone): { fill: string; ink: string } {
  if (tone === 'locked') return { fill: withAlpha(theme.tokens.primary, 0.15), ink: theme.tokens.primary };
  return tone.grade
    ? gradeColors(theme, tone.grade)
    : { fill: theme.tokens.primary, ink: theme.tokens.primaryForeground };
}

const ICONS: Record<TileIcon, string> = {
  target: 'bullseye-arrow',
  timer: 'timer-outline',
  pencil: 'pencil-outline',
};

const BAND_HEIGHT = 56;

export function QuestCard({
  title,
  detail,
  level,
  icon,
  tone,
  onPress,
  label,
  testID,
  pressTestID,
  advanced = false,
  locked = false,
  footer,
  aside,
  disabled = false,
}: {
  title: string;
  detail: string;
  /** The level in words ("Grade 4", "Beast Academy 3"): members read it; the guest's detail carries its own. */
  level?: string;
  icon: TileIcon;
  tone: CardTone;
  onPress: () => void;
  /** What a screen reader hears for the card's button. */
  label: string;
  /** The card's root. */
  testID?: string;
  /** The card's button. */
  pressTestID?: string;
  /** An "Adv" mark on the band: a harder track than the grade's standards. */
  advanced?: boolean;
  locked?: boolean;
  /** Lines under the detail: a best score, "Free account". */
  footer?: ReactNode;
  /** Beside the card's button, e.g. the favorite star (just under the band, at the right). */
  aside?: ReactNode;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const { fill, ink } = toneColors(theme, locked ? 'locked' : tone);
  return (
    <View
      testID={testID}
      collapsable={false}
      style={{
        flex: 1,
        minWidth: 0,
        borderWidth: 1,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderColor: theme.colors.outline,
        backgroundColor: theme.colors.surface,
        // Lift the card off the page: on a light page a card and the background are close.
        shadowColor: theme.colors.shadow,
        shadowOpacity: theme.dark ? 0 : 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Pressable
        testID={pressTestID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : disabled ? 0.6 : 1 })}
      >
        <View
          style={{
            height: BAND_HEIGHT,
            backgroundColor: fill,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.md,
          }}
        >
          <Icon source={locked ? 'lock' : ICONS[icon]} size={locked ? 34 : 28} color={ink} />
          {advanced ? <AdvPill /> : null}
        </View>
        <View style={{ padding: space.md, paddingRight: aside ? 40 : space.md, gap: 2, minHeight: 84 }}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {detail}
          </Text>
          {level ? (
            <Text variant="labelMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
              {level}
            </Text>
          ) : null}
          {footer}
        </View>
      </Pressable>
      {aside ? <View style={{ position: 'absolute', top: BAND_HEIGHT, right: 0 }}>{aside}</View> : null}
    </View>
  );
}

/**
 * "Adv": a harder track than the grade's standards. White on a dark pill -- black at 55% over the band's hue,
 * which every grade's hue keeps at 4.5:1 or more (apps/mobile/scripts/check-contrast.mjs) -- 12pt, sentence case.
 * Paper's own palette supplies the black (`scrim`) and the white, so no colour is written here.
 */
export function AdvPill() {
  const theme = useAppTheme();
  return (
    <View testID="quest-card-adv" style={{ borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: space.sm, paddingVertical: 2 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim, opacity: 0.55 }]} />
      <Text variant="labelSmall" style={{ color: MD3Colors.neutral100, fontWeight: '800' }}>
        Adv
      </Text>
    </View>
  );
}

/** Items in rows of `columns`, the last row's gaps kept empty so no card stretches. */
export function CardGrid<T>({
  items,
  columns,
  keyOf,
  render,
}: {
  items: readonly T[];
  columns: number;
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
}) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row) => (
        <View key={row.map(keyOf).join()} style={{ flexDirection: 'row', gap: space.md }}>
          {row.map((item) => (
            <View key={keyOf(item)} style={{ flex: 1, minWidth: 0, flexDirection: 'row' }}>
              {render(item)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`gap-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export type RingState = 'open' | 'hit' | 'miss';

/** One target: open (a control's neutral edge), hit (filled, in the space's primary) or missed (faint). */
export function TargetRing({ state }: { state: RingState }) {
  const theme = useAppTheme();
  const ink =
    state === 'hit' ? theme.tokens.primary : state === 'miss' ? theme.colors.outlineVariant : theme.colors.outline;
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" aria-hidden>
      <Circle
        cx={18}
        cy={18}
        r={16}
        stroke={ink}
        strokeWidth={2.5}
        fill={state === 'hit' ? withAlpha(theme.tokens.primary, 0.22) : 'none'}
      />
      <Circle cx={18} cy={18} r={10} stroke={ink} strokeWidth={2.5} fill="none" />
      <Circle
        cx={18}
        cy={18}
        r={4}
        fill={state === 'miss' ? 'none' : ink}
        stroke={ink}
        strokeWidth={state === 'miss' ? 2 : 0}
      />
    </Svg>
  );
}

/** Today's five: the day's set as five rings, and a button to play it. */
export function TodayCard({
  testID,
  eyebrow,
  eyebrowTestID,
  title,
  titleTestID,
  states,
  ringsTestID,
  ringsLabel,
  note,
  onPlay,
  playLabel,
  playIcon,
  playTestID,
  quiet = false,
}: {
  testID: string;
  eyebrow: string;
  eyebrowTestID?: string;
  title: string;
  titleTestID?: string;
  states: RingState[];
  ringsTestID?: string;
  ringsLabel: string;
  note?: string | null;
  onPlay?: () => void;
  playLabel: string;
  playIcon: string;
  playTestID: string;
  /** An outlined button (already played), rather than the call to play in the space's primary. */
  quiet?: boolean;
}) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  return (
    <OutlinedCard testID={testID} style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text testID={eyebrowTestID} variant="labelMedium" style={{ color: theme.tokens.primary, fontWeight: '700' }}>
          {eyebrow}
        </Text>
        <Text testID={titleTestID} variant="titleMedium" style={{ fontWeight: '700' }}>
          {title}
        </Text>
        <View
          testID={ringsTestID}
          accessible
          accessibilityRole="image"
          accessibilityLabel={ringsLabel}
          style={{ flexDirection: 'row', gap: space.sm }}
        >
          {states.map((state, i) => (
            <TargetRing key={i} state={state} />
          ))}
        </View>
        {note ? (
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {note}
          </Text>
        ) : null}
        {onPlay ? (
          <Button
            testID={playTestID}
            mode={quiet ? 'outlined' : 'contained'}
            icon={playIcon}
            onPress={onPlay}
            // Full width on a phone; its own width on a tablet, where a full-width button reads as a bar.
            style={{ alignSelf: wide ? 'flex-start' : 'stretch' }}
            contentStyle={{ minHeight: 48, paddingHorizontal: wide ? space.lg : 0 }}
            labelStyle={{ fontWeight: '700' }}
          >
            {playLabel}
          </Button>
        ) : null}
      </View>
    </OutlinedCard>
  );
}

/** A chip's place on the row: its 2pt ring, the gap inside it, and the 44pt chip. */
const CHIP = 44;
const RING = 2;
const RING_GAP = 2;
const CHIP_OUTER = CHIP + 2 * (RING + RING_GAP);
/** The fade at an edge the row scrolls toward: a cue that there is more (JF28). */
const FADE = 32;

/** Where the row scrolls so the chosen chip is in view (centred when it can be), or null when it already is. */
export function gradeScrollTarget(input: {
  index: number;
  gutter: number;
  gap: number;
  viewport: number;
  content: number;
  offset: number;
}): number | null {
  const { index, gutter, gap, viewport, content, offset } = input;
  if (index < 0 || viewport <= 0 || content <= viewport) return null;
  const left = gutter + index * (CHIP_OUTER + gap);
  const right = left + CHIP_OUTER;
  if (left >= offset + FADE / 2 && right <= offset + viewport - FADE / 2) return null;
  const centred = left - (viewport - CHIP_OUTER) / 2;
  return Math.max(0, Math.min(content - viewport, Math.round(centred)));
}

/** A strip that fades from clear to `color`, laid over one end of the row. */
function EdgeFade({ side, color, testID }: { side: 'start' | 'end'; color: string; testID: string }) {
  const id = `grade-row-fade-${side}`;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, width: FADE, [side === 'end' ? 'right' : 'left']: 0 }}
    >
      <Svg width="100%" height="100%" aria-hidden>
        <Defs>
          <LinearGradient id={id} x1={side === 'end' ? '0' : '1'} y1="0" x2={side === 'end' ? '1' : '0'} y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The grade row: one chip per grade, the chosen one filled (in its hue on the member home) inside a 2pt ring
 * in the page's ink. It fades at an edge it can still scroll toward, and scrolls the chosen grade into view.
 */
export function GradeRow({
  grades,
  value,
  onChange,
  testIDPrefix,
  hued = false,
  gutter = 0,
  fadeColor,
}: {
  grades: readonly number[];
  value: number | null;
  onChange: (grade: number) => void;
  testIDPrefix: string;
  /** The chosen chip wears its grade's hue (member home); else the brand's (guest home). */
  hued?: boolean;
  /** Side padding inside the scroll, for a row that runs to the screen's edges. */
  gutter?: number;
  /** What the row sits on, for its edge fade (the page's background by default). */
  fadeColor?: string;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const scroller = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const scrolledOnce = useRef(false);
  const index = value === null ? -1 : grades.indexOf(value);

  // The chosen grade in view: on the first layout at once, after a change with motion (unless reduced).
  useEffect(() => {
    const target = gradeScrollTarget({ index, gutter, gap: space.sm, viewport, content, offset });
    if (target === null) return;
    scroller.current?.scrollTo({ x: target, animated: scrolledOnce.current && !reduced });
    scrolledOnce.current = true;
    // Only when the choice or the row's size changes -- never on the reader's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, viewport, content]);

  const fade = fadeColor ?? theme.colors.background;
  const overflows = content > viewport + 1;
  return (
    <View testID={`${testIDPrefix}row`}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm }}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
        {grades.map((g) => {
          const selected = g === value;
          const fill =
            selected && hued && g >= 1 && g <= 8
              ? gradeColors(theme, g as TileGrade)
              : { fill: theme.tokens.primary, ink: theme.tokens.primaryForeground };
          return (
            <Pressable
              key={g}
              testID={`${testIDPrefix}${g}`}
              accessibilityRole="radio"
              accessibilityLabel={`Grade ${g}`}
              accessibilityState={{ checked: selected, selected }}
              onPress={() => onChange(g)}
              style={{
                width: CHIP_OUTER,
                height: CHIP_OUTER,
                borderRadius: radius.pill,
                borderWidth: RING,
                // JF29: a 2pt ring in the page's ink, a gap inside it, then the chip.
                borderColor: selected ? theme.colors.onSurface : 'transparent',
                padding: RING_GAP,
              }}
            >
              {({ pressed }) => (
                <View
                  testID={`${testIDPrefix}${g}-chip`}
                  style={{
                    flex: 1,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selected ? 0 : 1,
                    borderColor: theme.colors.outlineVariant,
                    backgroundColor: selected
                      ? fill.fill
                      : pressed
                        ? withAlpha(theme.tokens.primary, 0.08)
                        : theme.colors.surface,
                  }}
                >
                  <Text
                    variant="titleMedium"
                    style={{ fontWeight: '700', color: selected ? fill.ink : theme.colors.onSurface }}
                  >
                    {g}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {overflows && offset > 1 ? <EdgeFade side="start" color={fade} testID={`${testIDPrefix}fade-start`} /> : null}
      {overflows && offset < content - viewport - 1 ? (
        <EdgeFade side="end" color={fade} testID={`${testIDPrefix}fade-end`} />
      ) : null}
    </View>
  );
}
