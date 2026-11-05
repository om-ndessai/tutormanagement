import { useLocalSearchParams } from 'expo-router';

import { LetInSheet } from '@/features/users/let-in-sheet';

/**
 * Let in someone who asked to join with the space's code (UI audit JF1): `?request=<userId>`, a fitted
 * quick sheet -- the role, then, for a parent, which child is theirs. Adult admins only.
 */
export default function LetInRoute() {
  const { request } = useLocalSearchParams<{ request?: string }>();
  return <LetInSheet requestId={request} />;
}
