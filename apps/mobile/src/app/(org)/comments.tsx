import { CommentsScreen } from '@/features/comments/comments-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Every comment the reader may see, newest first. */
function CommentsRouteContent() {
  return <CommentsScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function CommentsRoute() {
  return (
    <FeatureGate set="tutoring">
      <CommentsRouteContent />
    </FeatureGate>
  );
}
