import { MemberHomeScreen } from '@/features/home/member-home-screen';

/**
 * Phase 66: one Home for every space; the role dashboards are More → Dashboard. Phase 67 retired the
 * Quest landing (Phase 42): a student's waiting question and a tutor's answers to review are Next up
 * items now, never a redirect.
 */
export default function DashboardRoute() {
  return <MemberHomeScreen />;
}
