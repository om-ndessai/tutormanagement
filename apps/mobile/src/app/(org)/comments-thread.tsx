import { useLocalSearchParams } from 'expo-router';

import { CommentThreadSheet } from '@/features/comments/comment-thread-sheet';

/** One thread, as a form sheet (`?target_type=&target_id=&title=`). */
export default function CommentsThreadRoute() {
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
