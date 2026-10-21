// The Dashboard screen (Phase 43, the owner's decision of 2026-10-20): the Analytics figures that
// left Home, one tap away under More (and Search). The same components and the same read as Home
// used (`useDashboard`), for the roles that had them: the office's counts, and a tutor's own. Counts
// only, no money.
import type { UserRole } from '@tmi/shared';
import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { DashboardSection } from '@/components/section';
import { Screen } from '@/components/screen';
import { DashboardSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useAuth } from '@/providers/auth-provider';
import { useDashboard } from './api';
import { AdminFigures, TutorFigures } from './tutoring-views';

function RoleFigures({ role, title }: { role: Extract<UserRole, 'admin' | 'tutor'>; title: string }) {
  const query = useDashboard({ role });
  const view = query.data?.data.data;
  return (
    <DashboardSection title={title}>
      {query.isPending ? (
        <DashboardSkeleton testID={`analytics-loading-${role}`} />
      ) : query.isError || !view ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : view.kind === 'admin' ? (
        <AdminFigures data={view} />
      ) : view.kind === 'tutor' ? (
        <TutorFigures data={view} />
      ) : null}
    </DashboardSection>
  );
}

export function AnalyticsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const roles = user?.roles ?? [];
  const admin = roles.includes('admin');
  const tutor = roles.includes('tutor');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen testID="screen-dashboard-analytics" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      {admin ? <RoleFigures role="admin" title="Analytics" /> : null}
      {tutor ? <RoleFigures role="tutor" title={admin ? 'Your teaching' : 'Analytics'} /> : null}
      {!admin && !tutor ? (
        <EmptyState icon="chart-box-outline" title="Nothing to count here." body="The dashboard's figures are for tutors and the office." />
      ) : null}
    </Screen>
  );
}
