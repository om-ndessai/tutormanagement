import { useLocalSearchParams } from 'expo-router';

import { Form1099Sheet } from '@/features/dashboard/form-1099-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * A tutor's year-end 1099-NEC, as a form sheet: `?tutor=<user id>&year=<yyyy>`. The Social Security
 * number is never a param -- it is typed in the sheet and lives only in its state.
 */
function Form1099RouteContent() {
  const { tutor, year } = useLocalSearchParams<{ tutor?: string; year?: string }>();
  return <Form1099Sheet tutorId={tutor} year={Number(year)} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function Form1099Route() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <Form1099RouteContent />
    </FeatureGate>
  );
}
