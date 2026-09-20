import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RequireAuth } from '@/features/auth/require-auth';
import { ActivityPage } from '@/features/audit/activity-page';
import { AssignmentsPage } from '@/features/teaching/assignments-page';
import { SessionsPage } from '@/features/teaching/sessions-page';
import { UsersPage } from '@/features/users/users-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { ProfilePage } from '@/pages/profile-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below requires a session. The Worker enforces the same
          rule on the API, so this guard is about UX, not security. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
