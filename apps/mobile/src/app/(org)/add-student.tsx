import { AddStudentFlow } from '@/features/users/add-student-flow';

/** Add a student, family first (UI upgrades U3): a step flow. Admin only. */
export default function AddStudentRoute() {
  return <AddStudentFlow fromWizard={false} />;
}
