import { AssessmentPdfScreen } from '@/features/canvas-assessments/assessment-pdf-screen';

/**
 * An assessment's PDF, shown in the app: the submitted one for the student's tutors and the admins
 * (Phase 38), or with `?kind=reviewed` the reviewed one for the student's whole audience (Phase 40).
 */
export default function AssessmentPdfRoute() {
  return <AssessmentPdfScreen />;
}
