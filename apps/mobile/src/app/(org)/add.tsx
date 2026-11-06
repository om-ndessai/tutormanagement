import { AddChooser } from '@/features/users/add-chooser';

/**
 * The one Add chooser (Phase 76, JF21): a family, a tutor (where Tutoring is on), someone else, or an invitation by
 * email -- opened by the home's quick action, the (+) sheet's "Add people", and People's header and empty state. A
 * fitted quick sheet; a choice gives way to its flow.
 */
export default function AddRoute() {
  return <AddChooser />;
}
