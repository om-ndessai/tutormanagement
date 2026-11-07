import { useLocalSearchParams } from 'expo-router';

import { ApproveSheet } from '@/features/platform/approve-sheet';

/**
 * Phase 80 (A11, A15): approve a sign-up, with an optional place -- `?user=<userId>`, a form sheet over the console's
 * Settings. Platform admins only (the console's own routes).
 */
export default function ApproveAccountRoute() {
  const { user } = useLocalSearchParams<{ user?: string }>();
  return <ApproveSheet userId={user} />;
}
