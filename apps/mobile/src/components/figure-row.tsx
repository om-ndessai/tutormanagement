// Home's compact row of figures (UI upgrades U6): the old two-by-two grid of stat cards took a
// third of the first screen; one card with the figures side by side says the same in one line.
import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { slug, toneColor, type StatTone } from '@/components/stat-card';
import { useTourTarget } from '@/features/onboarding/tour-targets';
import { useCountUp } from '@/hooks/use-count-up';
import { useLargeText } from '@/hooks/use-large-text';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export interface Figure {
  /** Sentence case: "Students", "Sessions running". Its slug is the testID (`stat-<slug>`). */
  label: string;
  value: number | undefined;
  /** Formats the settled number (minutes, money) instead of printing it plainly. */
  formatValue?: (value: number) => string;
  hint?: string;
  tone?: StatTone;
  to?: Href;
  /** False for money, which is never animated. */
  animate?: boolean;
}

/**
 * The figures in one card, side by side; one per line under large text. Each keeps the stat card's
 * ids (`stat-<slug>`, `stat-<slug>-value`) and its spoken form ("Students: 50"), so a screen reader
 * hears the final figure, never one counting up. `tourId` is what the tour lights: keep it.
 */
export function FigureRow({
  figures,
  tourId,
  testID = 'home-figures',
}: {
  figures: Figure[];
  tourId?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  const large = useLargeText();
  const tourRef = useTourTarget(tourId);
  return (
    <View ref={tourRef} testID={testID} nativeID={tourId} collapsable={false}>
      <OutlinedCard style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
        <View style={{ flexDirection: large ? 'column' : 'row', paddingVertical: space.xs }}>
          {figures.map((figure, index) => (
            <Fragment key={figure.label}>
              {index > 0 ? (
                <View
                  style={
                    large
                      ? {
                          height: 1,
                          marginHorizontal: space.lg,
                          backgroundColor: theme.colors.outlineVariant,
                        }
                      : { width: 1, marginVertical: space.sm, backgroundColor: theme.colors.outlineVariant }
                  }
                />
              ) : null}
              <FigureCell figure={figure} large={large} />
            </Fragment>
          ))}
        </View>
      </OutlinedCard>
    </View>
  );
}

function FigureCell({ figure, large }: { figure: Figure; large: boolean }) {
  const theme = useAppTheme();
  const { label, value, formatValue, hint, tone = 'default', to, animate = true } = figure;
  const counted = useCountUp(value ?? 0);
  const settled = animate ? counted : (value ?? 0);
  const format = (n: number) => formatValue?.(n) ?? String(n);
  const display = value === undefined ? '—' : format(settled);
  const final = value === undefined ? 'not available' : format(value);
  const color = toneColor(theme, tone) ?? theme.colors.onSurface;
  const id = `stat-${slug(label)}`;
  const a11y = `${label}: ${final}${hint ? `. ${hint}` : ''}`;

  const body = (
    <View
      style={
        large
          ? { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md }
          : { alignItems: 'flex-start' }
      }
    >
      {large ? <FigureLabel label={label} hint={hint} /> : null}
      <Text
        testID={`${id}-value`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'], color }}
      >
        {display}
      </Text>
      {large ? null : <FigureLabel label={label} hint={hint} />}
    </View>
  );

  const style = { flex: 1, minWidth: 0, paddingHorizontal: space.md, paddingVertical: space.sm };
  if (!to) {
    return (
      <View testID={id} accessible accessibilityLabel={a11y} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={id}
      accessibilityRole="link"
      accessibilityLabel={a11y}
      onPress={() => router.navigate(to)}
      style={({ pressed }) => ({ ...style, opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

function FigureLabel({ label, hint }: { label: string; hint?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexShrink: 1 }}>
      <Text
        numberOfLines={2}
        style={{ fontSize: 12, fontWeight: '500', color: theme.tokens.mutedForeground }}
      >
        {label}
      </Text>
      {hint ? (
        <Text numberOfLines={1} style={{ fontSize: 12, color: theme.tokens.mutedForeground }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
