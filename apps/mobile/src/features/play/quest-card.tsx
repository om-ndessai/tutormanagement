// Ported from apps/web/src/features/play/quest-card.tsx @ working tree (Phase 67, H6 in
// docs/member-home-plan.md): the guest Quest board's pieces, shared by the guest home and the member Play
// home -- a quest card, the five-ring Today card and the grade row. The guest home keeps its mode colours
// exactly as before; the member home wears one hue per grade (`grade1`..`grade8` tokens, H5). A card
// always says its level in words, so colour is never the only signal (WCAG 1.4.1).
//
// Mobile: the band's icon sits at its left, as the guest board had it; a card's star (the member's
// favorite) sits just under the band, at the right. Grids are rows of `columns` with the last row's gaps
// kept empty, so no card stretches.
import type { TileGrade, TileIcon } from '@tmi/shared';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';

import { OutlinedCard } from '@/components/outlined-card';
import { useAppTheme } from '@/providers/theme-provider';
import type { AppTheme } from '@/theme/paper-theme';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';

/** A card's band: a grade's hue on the member home, the mode's colour on the guest home, or locked. */
export type CardTone = { grade: TileGrade | null } | { mode: 'count' | 'timed' } | 'locked';

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
  if ('mode' in tone) {
    return tone.mode === 'timed'
      ? { fill: theme.tokens.warning, ink: theme.tokens.warningForeground }
      : { fill: theme.tokens.primary, ink: theme.tokens.primaryForeground };
  }
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
  code,
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
  /** The tile's code, shown small (members only; a guest never reads codes). */
  code?: string;
  /** Lines under the detail: a best score, "Beta", "Free account". */
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
          {advanced ? (
            <View
              style={{
                paddingHorizontal: 6,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(ink, 0.16),
              }}
            >
              <Text variant="labelSmall" style={{ color: ink, fontWeight: '800', letterSpacing: 0.6 }}>
                ADV
              </Text>
            </View>
          ) : null}
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
          {code ? (
            <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6 }}>
              {code}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {aside ? <View style={{ position: 'absolute', top: BAND_HEIGHT, right: 0 }}>{aside}</View> : null}
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

/** One target: open, hit (filled amber) or missed (faint). */
export function TargetRing({ state }: { state: RingState }) {
  const theme = useAppTheme();
  const ink =
    state === 'hit' ? theme.tokens.warning : state === 'miss' ? theme.colors.outlineVariant : theme.tokens.primary;
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" aria-hidden>
      <Circle
        cx={18}
        cy={18}
        r={16}
        stroke={ink}
        strokeWidth={2.5}
        fill={state === 'hit' ? withAlpha(theme.tokens.warning, 0.22) : 'none'}
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
  /** An outlined button (already played), rather than the amber call to play. */
  quiet?: boolean;
}) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  return (
    <OutlinedCard testID={testID} style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text
          testID={eyebrowTestID}
          variant="labelMedium"
          style={{ color: theme.tokens.primary, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}
        >
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
            buttonColor={quiet ? undefined : theme.tokens.warning}
            textColor={quiet ? undefined : theme.tokens.warningForeground}
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

/** The grade row: one chip per grade, the chosen one filled (in its hue on the member home). */
export function GradeRow({
  grades,
  value,
  onChange,
  testIDPrefix,
  hued = false,
  gutter = 0,
}: {
  grades: readonly number[];
  value: number | null;
  onChange: (grade: number) => void;
  testIDPrefix: string;
  /** The chosen chip wears its grade's hue (member home); else the brand's (guest home). */
  hued?: boolean;
  /** Side padding inside the scroll, for a row that runs to the screen's edges. */
  gutter?: number;
}) {
  const theme = useAppTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm }}
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
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: selected && hued ? 2 : 1,
              borderColor: selected ? (hued ? theme.colors.onSurface : fill.fill) : theme.colors.outlineVariant,
              backgroundColor: selected
                ? fill.fill
                : pressed
                  ? withAlpha(theme.tokens.primary, 0.08)
                  : theme.colors.surface,
            })}
          >
            <Text
              variant="titleMedium"
              style={{ fontWeight: '700', color: selected ? fill.ink : theme.colors.onSurface }}
            >
              {g}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
