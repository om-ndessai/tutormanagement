import { useLocalSearchParams } from 'expo-router';

import { DailyScreen } from '@/features/habit/daily-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Phase 64 (P19): today's Daily set of a level, full screen outside the tabs, like a game. */
function QuestDailyRouteContent() {
  const { level } = useLocalSearchParams<{ level: string }>();
  return <DailyScreen level={level ?? ''} />;
}

/** Only where Quest is on here; otherwise the calm "Not part of this space". */
export default function QuestDailyRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <QuestDailyRouteContent />
    </FeatureGate>
  );
}
