import { useLocalSearchParams } from 'expo-router';

import { PersonFormSheet } from '@/features/users/person-form-sheet';

/**
 * Add a person, or edit one (`?id=`), as a form sheet. `?preset=` roles, `?guardian=` a guardian
 * already chosen and `?sections=` the blocks to show are for the welcome wizard; `?for=guardian`
 * adds a parent from a student's form. Admin only.
 */
export default function PersonFormRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    preset?: string;
    guardian?: string;
    sections?: string;
    for?: string;
  }>();
  return (
    <PersonFormSheet
      id={params.id}
      preset={params.preset}
      guardian={params.guardian}
      sections={params.sections}
      forGuardian={params.for === 'guardian'}
    />
  );
}
