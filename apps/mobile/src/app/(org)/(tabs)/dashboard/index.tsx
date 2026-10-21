import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { QuestLanding } from '@/features/quest/quest-landing';

export default function DashboardRoute() {
  return (
    <>
      {/* Phase 42: once per sign-in, a student or a tutor with something waiting goes into Quest. */}
      <QuestLanding />
      <DashboardScreen />
    </>
  );
}
