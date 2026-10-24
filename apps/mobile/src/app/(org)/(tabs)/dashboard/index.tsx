import { featureOn } from '@tmi/shared';

import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { SpaceHomeScreen } from '@/features/dashboard/space-home-screen';
import { QuestLanding } from '@/features/quest/quest-landing';
import { useAuth } from '@/providers/auth-provider';

export default function DashboardRoute() {
  const { organization } = useAuth();
  return (
    <>
      {/* Phase 42: once per sign-in, a student or a tutor with something waiting goes into Quest. */}
      <QuestLanding />
      {/* Phase 50: the dashboard is Tutoring's; a space without it gets the space home. */}
      {featureOn(organization, 'tutoring') ? <DashboardScreen /> : <SpaceHomeScreen />}
    </>
  );
}
