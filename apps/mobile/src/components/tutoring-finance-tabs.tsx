// Ported from apps/web/src/components/layout/tutoring-finance-tabs.tsx @ 1132322
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { useTourTarget } from '@/features/onboarding/tour-targets';
import { haptics } from '@/lib/haptics';
import { space } from '@/theme/tokens';

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

/** The Tutoring / Finance segmented control alone, for a screen that renders its halves itself. */
export function TutoringFinanceSwitch() {
  const [tab, setTab] = useTutoringFinanceTab();
  const tourRef = useTourTarget('tabs');
  return (
    <View ref={tourRef} nativeID="tabs" collapsable={false}>
      <SegmentedButtons
        value={tab}
        onValueChange={(value) => {
          if (value === tab) return;
          haptics.selection();
          setTab(value as TutoringFinanceTab);
        }}
        buttons={[
          { value: 'tutoring', label: 'Tutoring', icon: 'school-outline', testID: 'tabs-tutoring' },
          { value: 'finance', label: 'Finance', icon: 'wallet-outline', testID: 'tabs-finance' },
        ]}
      />
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
