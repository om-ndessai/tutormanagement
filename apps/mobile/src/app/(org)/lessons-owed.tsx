import { FeatureGate } from '@/features/shell/feature-gate';
import { LessonsOwedSheet } from '@/features/teaching/lessons-owed';

/**
 * Phase 75 (JF30): every "Record a lesson" door -- the home's quick action, the (+), the Sessions page's button, the
 * phone's home-screen action -- opens the lessons still owed, each recorded as planned, with "Another lesson" for one
 * the schedule does not know. Tutoring only; otherwise the calm "Not part of this space".
 */
export default function LessonsOwedRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <LessonsOwedSheet />
    </FeatureGate>
  );
}
