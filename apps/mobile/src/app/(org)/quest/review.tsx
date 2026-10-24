import { QuestReviewScreen } from '@/features/quest/quest-review-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** A tutor's or an admin's Question Quest review, full screen outside the tabs (Phase 42). */
function QuestReviewRouteContent() {
  return <QuestReviewScreen />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function QuestReviewRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <QuestReviewRouteContent />
    </FeatureGate>
  );
}
