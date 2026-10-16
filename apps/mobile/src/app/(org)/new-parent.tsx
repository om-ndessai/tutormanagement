import { useLocalSearchParams } from 'expo-router';

import { NewParentSheet } from '@/features/users/new-parent-sheet';

/** "New parent" from Add a student's Family step (UI upgrades U3): a fitted quick sheet. `?name=` prefills. */
export default function NewParentRoute() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  return <NewParentSheet name={name} />;
}
