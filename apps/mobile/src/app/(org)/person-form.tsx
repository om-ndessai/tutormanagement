import { useLocalSearchParams } from 'expo-router';

import { PersonFormSheet } from '@/features/users/person-form-sheet';

/**
 * Add a person, or edit one (`?id=`), as a form sheet. `?preset=` roles, `?guardian=` a guardian
 * already chosen and `?sections=` the blocks to show are for the welcome wizard; `?for=guardian`
 * adds a parent from a student's form; `?request=` lets in someone who asked to join (Phase 52). `?section=` is one section of a person's record (UI upgrades
 * U5): its blocks alone, under its own title. Admin only.
 */
export default function PersonFormRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    preset?: string;
    guardian?: string;
    sections?: string;
    section?: string;
    for?: string;
    request?: string;
  }>();
  return (
    <PersonFormSheet
      id={params.id}
      preset={params.preset}
      guardian={params.guardian}
      sections={params.sections}
      section={params.section}
      forGuardian={params.for === 'guardian'}
      request={params.request}
    />
  );
}
