// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322 (the person's own dashboard; the
// role selector and view-as are feature 16, the parent and student views feature 15)
import { useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_ROLE_LABELS, defaultDashboardRole, type UserRole } from '@tmi/shared';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { TutoringFinanceTabs } from '@/components/tutoring-finance-tabs';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useDashboard } from './api';
import { AdminFinance, TutorFinance } from './finance-views';
import { AdminTutoring, TutorTutoring } from './tutoring-views';

/** The dashboards built so far: the admin's and the tutor's. */
function isStaffRole(role: UserRole | null): boolean {
  return role === 'admin' || role === 'tutor';
}

/**
 * Home: who is signed in, then their dashboard. Which one is the server's choice, made the same
 * way as the web (`defaultDashboardRole`: admin, then tutor, then parent, then student); the app
 * uses the same rule only to know whether that dashboard is built yet, so a parent's or a
 * student's (with its money) is not fetched before it can be shown.
 */
export function DashboardScreen() {
  const { user } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const role = user ? defaultDashboardRole(user.roles) : null;
  const staff = isStaffRole(role);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['schedules', 'upcoming'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen
      testID="screen-home"
      refreshing={refreshing}
      onRefresh={staff ? () => void onRefresh() : undefined}
    >
      <View style={{ gap: 2 }}>
        <Text testID="home-user" variant="titleMedium">
          {user?.full_name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {brand.name}
        </Text>
      </View>
      {staff ? <StaffDashboard /> : <RolePlaceholder role={role} />}
    </Screen>
  );
}

function StaffDashboard() {
  const { data, isPending, isError, error, refetch } = useDashboard({});
  const response = data?.data;

  if (isPending) return <LoadingState label="Loading your dashboard…" testID="dashboard-loading" />;
  if (isError || !response) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const view = response.data;
  if (view.kind !== 'admin' && view.kind !== 'tutor') return <RolePlaceholder role={response.role} />;

  return (
    <TutoringFinanceTabs
      tutoring={view.kind === 'admin' ? <AdminTutoring data={view} /> : <TutorTutoring data={view} />}
      finance={view.kind === 'admin' ? <AdminFinance data={view} /> : <TutorFinance data={view} />}
    />
  );
}

function RolePlaceholder({ role }: { role: UserRole | null }) {
  return (
    <EmptyState
      testID="dashboard-role-placeholder"
      icon="view-dashboard-outline"
      title={
        role
          ? `Your ${DASHBOARD_ROLE_LABELS[role].toLowerCase()} dashboard is on its way`
          : 'No dashboard yet'
      }
      body="Sessions, Schedule and Progress are in the tabs below."
    />
  );
}
