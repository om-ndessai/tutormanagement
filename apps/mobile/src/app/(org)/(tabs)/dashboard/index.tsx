import { MemberHomeScreen } from '@/features/home/member-home-screen';
import { QuestLanding } from '@/features/quest/quest-landing';

export default function DashboardRoute() {
  return (
    <>
      {/* Phase 42: once per sign-in, a student or a tutor with something waiting goes into Quest (kept
          through Phase 66; Phase 67 makes it a Next up item). */}
      <QuestLanding />
      {/* Phase 66: one Home for every space; the role dashboards are More → Dashboard. */}
      <MemberHomeScreen />
    </>
  );
}
