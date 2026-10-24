import { useLocalSearchParams } from 'expo-router';

import { CommentThreadSheet } from '@/features/comments/comment-thread-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** One thread, as a form sheet (`?target_type=&target_id=&title=`). */
function CommentsThreadRouteContent() {
  const { target_type, target_id, title, description } = useLocalSearchParams<{
    target_type?: string;
    target_id?: string;
    title?: string;
    description?: string;
  }>();
  return (
    <CommentThreadSheet
      targetType={target_type}
      targetId={target_id}
      title={title}
      description={description}
    />
  );
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function CommentsThreadRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <CommentsThreadRouteContent />
    </FeatureGate>
  );
}
