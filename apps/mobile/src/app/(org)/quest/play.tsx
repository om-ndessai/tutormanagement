import { QuestPlayScreen } from '@/features/quest/quest-play-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** A student's Question Quest, full screen outside the tabs (Phase 42). */
function QuestPlayRouteContent() {
  return <QuestPlayScreen />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function QuestPlayRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <QuestPlayRouteContent />
    </FeatureGate>
  );
}
