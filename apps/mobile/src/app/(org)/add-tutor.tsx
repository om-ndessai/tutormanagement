import { AddTutorFlow } from '@/features/users/add-tutor-flow';

/** Add a tutor (UI upgrades U3): a step flow. Admin only. */
export default function AddTutorRoute() {
  return <AddTutorFlow fromWizard={false} />;
}
