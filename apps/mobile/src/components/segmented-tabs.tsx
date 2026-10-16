// The app's segmented control: two or three halves side by side in a pill, the chosen one filled.
// It looks like a segmented control but is a tab list to a screen reader -- "Finance, tab, 2 of 2,
// selected" -- which Paper's SegmentedButtons (buttons that are "checked") could not say
// (ux-audit F-20). The Tutoring / Finance switch and the Lessons / Schedule switch both use it.
import type { Ref } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { ICON_TARGET } from '@/components/icon-button';
import { useIconSize, useLargeText } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export interface SegmentedTab<V extends string> {
  value: V;
  label: string;
  /** Material Community icon name. */
  icon: string;
  testID: string;
}

export function SegmentedTabs<V extends string>({
  tabs,
  value,
  onChange,
  viewRef,
  nativeID,
  testID,
}: {
  tabs: readonly SegmentedTab<V>[];
  value: V;
  onChange: (value: V) => void;
  /** For the feature tour, which lights the whole control. */
  viewRef?: Ref<View>;
  nativeID?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  // At the largest text sizes two side-by-side halves read "Tutor… / Fina…", so they stack, each
  // a full-width row (ux-audit F-12).
  const stacked = useLargeText();
  const iconSize = useIconSize(18);
  return (
    <View
      ref={viewRef}
      testID={testID}
      nativeID={nativeID}
      collapsable={false}
      accessibilityRole="tablist"
      style={{
        flexDirection: stacked ? 'column' : 'row',
        borderWidth: 1,
        borderColor: theme.colors.outline,
        borderRadius: stacked ? radius.lg : radius.pill,
        overflow: 'hidden',
      }}
    >
      {tabs.map((item, index) => {
        const selected = item.value === value;
        const ink = selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface;
        return (
          <Pressable
            key={item.value}
            testID={item.testID}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(item.value);
            }}
            style={({ pressed }) => ({
              flex: stacked ? undefined : 1,
              minHeight: ICON_TARGET,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              paddingHorizontal: space.md,
              paddingVertical: stacked ? space.sm : 0,
              borderLeftWidth: index > 0 && !stacked ? 1 : 0,
              borderTopWidth: index > 0 && stacked ? 1 : 0,
              borderColor: theme.colors.outline,
              backgroundColor: selected
                ? theme.colors.secondaryContainer
                : pressed
                  ? theme.colors.surfaceVariant
                  : 'transparent',
            })}
          >
            <Icon source={item.icon} size={iconSize} color={ink} />
            <Text variant="labelLarge" style={{ flexShrink: 1, color: ink }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
