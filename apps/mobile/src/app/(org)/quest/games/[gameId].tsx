import { useLocalSearchParams } from 'expo-router';

import { GameScreen } from '@/features/quest/game-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** One Quest game (Phase 46), full screen outside the tabs: its lobby, its play, its results. */
function QuestGameRouteContent() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  return <GameScreen gameId={gameId ?? ''} />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function QuestGameRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <QuestGameRouteContent />
    </FeatureGate>
  );
}
