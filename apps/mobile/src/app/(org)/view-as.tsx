import { useLocalSearchParams } from 'expo-router';

import { UserPickerSheet } from '@/features/dashboard/user-picker';

/** The admin's "view dashboard as" people picker, as a form sheet (`?current=<userId>`). */
export default function ViewAsRoute() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  return <UserPickerSheet current={current || null} />;
}
