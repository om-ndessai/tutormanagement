import { QuestScreen } from '@/features/quest/quest-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Question Quest (Phase 42): a student's start, a reviewer's queue and their students' levels. */
function QuestRouteContent() {
  return <QuestScreen />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function QuestRoute() {
  return (
    <FeatureGate set="quest">
      <QuestRouteContent />
    </FeatureGate>
  );
}
