import { useLocalSearchParams } from 'expo-router';

import { GameScreen } from '@/features/quest/game-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** One Quest game (Phase 46), full screen outside the tabs: its lobby, its play, its results. */
function QuestGameRouteContent() {
  // Phase 62 (P6): `from=home` when the Play home opened it, so Exit goes back to Home.
  const { gameId, from } = useLocalSearchParams<{ gameId: string; from?: string }>();
  return <GameScreen gameId={gameId ?? ''} from={from} />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function QuestGameRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <QuestGameRouteContent />
    </FeatureGate>
  );
}
