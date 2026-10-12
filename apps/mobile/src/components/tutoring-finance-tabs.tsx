// Ported from apps/web/src/components/layout/tutoring-finance-tabs.tsx @ 1132322
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { ICON_TARGET } from '@/components/icon-button';
import { useTourTarget } from '@/features/onboarding/tour-targets';
import { useIconSize, useLargeText } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export type TutoringFinanceTab = 'tutoring' | 'finance';

/**
 * Which half of a Tutoring / Finance screen is showing, kept in `?tab=` so a link to the finance
 * view stays the finance view. Tutoring is the default: a screen opened in front of a student
 * must not lead with money.
 */
export function useTutoringFinanceTab(): [TutoringFinanceTab, (tab: TutoringFinanceTab) => void] {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: TutoringFinanceTab = params.tab === 'finance' ? 'finance' : 'tutoring';
  const setTab = (value: TutoringFinanceTab) => router.setParams({ tab: value });
  return [tab, setTab];
}

const TABS = [
  { value: 'tutoring', label: 'Tutoring', icon: 'school-outline', testID: 'tabs-tutoring' },
  { value: 'finance', label: 'Finance', icon: 'wallet-outline', testID: 'tabs-finance' },
] as const;

/**
 * The Tutoring / Finance switch alone, for a screen that renders its halves itself. It looks like
 * a segmented control but is a tab list to a screen reader -- "Finance, tab, 2 of 2, selected" --
 * which Paper's SegmentedButtons (buttons that are "checked") could not say (ux-audit F-20).
 */
export function TutoringFinanceSwitch() {
  const [tab, setTab] = useTutoringFinanceTab();
  const tourRef = useTourTarget('tabs');
  const theme = useAppTheme();
  // At the largest text sizes two side-by-side halves read "Tutor… / Fina…", so they stack, each
  // a full-width row (ux-audit F-12).
  const stacked = useLargeText();
  const iconSize = useIconSize(18);
  return (
    <View
      ref={tourRef}
      nativeID="tabs"
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
      {TABS.map((item, index) => {
        const selected = item.value === tab;
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
              setTab(item.value);
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

/**
 * A screen's two halves: how the teaching is going, and the money. Only the chosen half is
 * rendered, so nothing from Finance is ever mounted while Tutoring shows.
 */
export function TutoringFinanceTabs({ tutoring, finance }: { tutoring: ReactNode; finance: ReactNode }) {
  const [tab] = useTutoringFinanceTab();

  return (
    <View style={{ gap: space.lg }}>
      <TutoringFinanceSwitch />
      {tab === 'tutoring' ? tutoring : finance}
    </View>
  );
}
