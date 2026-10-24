import { useLocalSearchParams } from 'expo-router';

import { UserPickerSheet } from '@/features/dashboard/user-picker';
import { FeatureGate } from '@/features/shell/feature-gate';

/** The admin's "view dashboard as" people picker, as a form sheet (`?current=<userId>`). */
function ViewAsRouteContent() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  return <UserPickerSheet current={current || null} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ViewAsRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <ViewAsRouteContent />
    </FeatureGate>
  );
}
