import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RequireAuth } from '@/features/auth/require-auth';
import { ActivityPage } from '@/features/audit/activity-page';
import { CommentsPage } from '@/features/comments/comments-page';
import { AssignmentsPage } from '@/features/teaching/assignments-page';
import { SessionsPage } from '@/features/teaching/sessions-page';
import { SchedulesPage } from '@/features/schedules/schedules-page';
import { BillingPage } from '@/features/payments/billing-page';
import { UsersPage } from '@/features/users/users-page';
import { ProgressPage } from '@/features/progress/progress-page';
import { StudentProgressPage } from '@/features/progress/student-progress-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { OrganizationSettingsPage } from '@/features/organizations/organization-settings-page';
import { RequireOrg } from '@/features/organizations/require-org';
import { SelectOrganizationPage } from '@/features/organizations/select-organization-page';
import { OrganizationsPage } from '@/features/platform/organizations-page';
import { PlatformActivityPage } from '@/features/platform/platform-activity-page';
import { PlatformAdminsPage } from '@/features/platform/platform-admins-page';
import { PlatformPeoplePage } from '@/features/platform/platform-people-page';
import { PlatformShell } from '@/features/platform/platform-shell';
import { ProfilePage } from '@/pages/profile-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below requires a session. The Worker enforces the same
          rule on the API, so this guard is about UX, not security. */}
      <Route element={<RequireAuth />}>
        {/* Choosing where to go, and the platform console: signed in, but not
            inside any one organization. */}
        <Route path="select-organization" element={<SelectOrganizationPage />} />
        <Route path="platform" element={<PlatformShell />}>
          <Route index element={<OrganizationsPage />} />
          <Route path="admins" element={<PlatformAdminsPage />} />
          <Route path="people" element={<PlatformPeoplePage />} />
          <Route path="activity" element={<PlatformActivityPage />} />
        </Route>

        {/* The portal itself runs inside the organization this tab chose. */}
        <Route element={<RequireOrg />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="progress/:studentId" element={<StudentProgressPage />} />
          <Route path="schedule" element={<SchedulesPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="organization" element={<OrganizationSettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        </Route>
      </Route>
    </Routes>
  );
}
