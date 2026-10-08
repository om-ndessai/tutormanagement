// Ported from apps/web/src/features/dashboard/stat-card.tsx @ 1132322
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';

import { useCountUp } from '@/hooks/use-count-up';
import { useAppTheme } from '@/providers/theme-provider';
import type { AppTheme } from '@/theme/paper-theme';
import { radius, space } from '@/theme/tokens';

export type StatTone = 'default' | 'warning' | 'brand' | 'success';

/** The text colour of a tone, as the web's `text-warning-foreground dark:text-warning` etc. */
export function toneColor(theme: AppTheme, tone: StatTone): string | undefined {
  const dark = theme.scheme === 'dark';
  switch (tone) {
    case 'warning':
      return dark ? theme.tokens.warning : theme.tokens.warningForeground;
    case 'brand':
      return dark ? theme.tokens.brand300 : theme.tokens.brand700;
    case 'success':
      return theme.tokens.success;
    default:
      return undefined;
  }
}

/** "Sessions running" -> "sessions-running", for testIDs. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * One figure, read at a glance: a label, an icon and the number, counting up on its first
 * arrival. Deliberately tight -- the vendored web Card's padding is replaced by its own, so a
 * row of these stays one height. The Analytics row passes `compact` and no hint.
 *
 * Plain counts by default. A card for money is given its `formatValue` by a finance component
 * (the only files allowed to format money), and never counts up: a moving amount invites
 * misreading.
 */
export function StatCard({
  label,
  value,
  formatValue,
  icon,
  to,
  hint,
  tone = 'default',
  compact = false,
  animate = true,
}: {
  label: string;
  value: number | undefined;
  /** Formats the settled number (minutes, money) instead of printing it plainly. */
  formatValue?: (value: number) => string;
  /** Material Community icon name. */
  icon: string;
  /** Makes the whole card a link. */
  to?: Href;
  hint?: string;
  tone?: StatTone;
  /** The Analytics row's size: a smaller figure and tighter padding. */
  compact?: boolean;
  /** False for money, which is never animated. */
  animate?: boolean;
}) {
  const theme = useAppTheme();
  const counted = useCountUp(value ?? 0);
  const settled = animate ? counted : (value ?? 0);
  const format = (n: number) => formatValue?.(n) ?? String(n);
  const display = value === undefined ? '—' : format(settled);
  const final = value === undefined ? 'not available' : format(value);
  const color = toneColor(theme, tone);
  const id = `stat-${slug(label)}`;

  const body: ReactNode = (
    <View
      style={{
        paddingHorizontal: compact ? 14 : space.lg,
        paddingVertical: compact ? 10 : 14,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}
      >
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: theme.tokens.mutedForeground,
          }}
        >
          {label}
        </Text>
        <Icon source={icon} size={16} color={color ?? theme.tokens.mutedForeground} />
      </View>
      <Text
        testID={`${id}-value`}
        style={{
          marginTop: compact ? 2 : 4,
          fontSize: compact ? 20 : 24,
          lineHeight: compact ? 26 : 30,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          color: color ?? theme.colors.onSurface,
        }}
      >
        {display}
      </Text>
      {hint ? (
        <Text style={{ marginTop: 2, fontSize: 12, color: theme.tokens.mutedForeground }}>{hint}</Text>
      ) : null}
    </View>
  );

  const card = (
    <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
      {body}
    </Card>
  );

  // The figure is announced at its final value, never mid-count.
  const a11y = `${label}: ${final}${hint ? `. ${hint}` : ''}`;

  if (!to) {
    return (
      <View testID={id} accessible accessibilityLabel={a11y} style={{ flex: 1 }}>
        {card}
      </View>
    );
  }
  return (
    <Pressable
      testID={id}
      accessibilityRole="link"
      accessibilityLabel={a11y}
      onPress={() => router.navigate(to)}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
    >
      {card}
    </Pressable>
  );
}

/**
 * Cards two to a row (the web's `grid-cols-2 items-stretch`). Children are StatCards; an odd one
 * out keeps its half width.
 */
export function StatGrid({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  children.forEach((child, index) => {
    if (index % 2 === 0) rows.push([child]);
    else rows[rows.length - 1]!.push(child);
  });
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
          {row}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
