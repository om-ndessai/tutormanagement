import { useLocalSearchParams } from 'expo-router';

import { ReflectionSheet } from '@/features/teaching/reflection-form';

/** The student's reflection on one lesson, as a form sheet (`?session=<id>`). */
export default function ReflectionRoute() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  return <ReflectionSheet sessionId={session} />;
}
