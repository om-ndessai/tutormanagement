// Ported from apps/web/src/features/quest/start-game-page.tsx @ 9eccdf2 (working tree): Tile.
//
// One choice of the start wizard (Phase 47, design 61): a level with its count, Random, Single player
// or Multiplayer -- a radio -- or a favorite, a button. At least 80 pt tall, outlined; chosen, the
// primary border over a wash of the primary. One accessible element ("G6, 412 questions, selected").
// A corner slot holds a favorite's ×, beside the tile rather than inside it, so it stays its own
// control to a screen reader.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';

export function GameTile({
  testID,
  title,
  detail,
  icon,
  selected = false,
  role = 'radio',
  onPress,
  corner,
}: {
  testID: string;
  title: string;
  detail?: string;
  /** Material Community icon name. */
  icon?: string;
  selected?: boolean;
  /** A level or a mode is a radio; a favorite is a button. */
  role?: 'radio' | 'button';
  onPress: () => void;
  /** Top right, over the tile: a favorite's ×. */
  corner?: ReactNode;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <Pressable
        testID={testID}
        accessibilityRole={role}
        accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
        accessibilityState={role === 'radio' ? { checked: selected } : undefined}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 80,
          justifyContent: 'center',
          gap: space.xs,
          padding: space.lg,
          paddingRight: corner ? space.xxl + space.lg : space.lg,
          borderRadius: radius.lg,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.colors.primary : theme.colors.outline,
          backgroundColor: selected
            ? withAlpha(theme.colors.primary, 0.12)
            : pressed
              ? theme.colors.surfaceVariant
              : 'transparent',
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {icon ? <Icon source={icon} size={18} color={theme.colors.primary} /> : null}
          <Text variant="titleMedium" style={{ flexShrink: 1, fontWeight: '600' }}>
            {title}
          </Text>
        </View>
        {detail ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            {detail}
          </Text>
        ) : null}
      </Pressable>
      {corner ? <View style={{ position: 'absolute', top: 0, right: 0 }}>{corner}</View> : null}
    </View>
  );
}

/** Tiles in rows of `columns`, each row as tall as its tallest, the last row padded. */
export function TileGrid({ columns, children }: { columns: number; children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) rows.push(children.slice(i, i + columns));
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', alignItems: 'stretch', gap: space.md }}>
          {row}
          {Array.from({ length: columns - row.length }, (_, pad) => (
            <View key={`pad-${pad}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
