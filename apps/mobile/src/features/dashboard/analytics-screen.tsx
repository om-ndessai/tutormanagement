// The Dashboard screen (More → Dashboard). Phase 43 moved the Analytics figures here from Home; since
// 2026-10-28 (the owner: "the dashboard and home should match") it is the whole dashboard, as the web
// shows it: Home's own sections, with Analytics first and Recent Activity last, and the Finance tab.
// The same read as Home (`useDashboard`); the roles are chips here, as the web's role picker.
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { Screen } from '@/components/screen';
import { useDashboard } from './api';
import { asRole, RoleDashboard } from './dashboard-screen';
import { RoleSelector } from './role-selector';

export function AnalyticsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams<{ role?: string }>();
  const requestedRole = asRole(params.role);
  const query = useDashboard(requestedRole ? { role: requestedRole } : {});
  const response = query.data?.data;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['schedules', 'upcoming'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen testID="screen-dashboard-analytics" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      {response ? <RoleSelector roles={response.subject.roles} current={response.role} /> : null}
      <RoleDashboard query={query} subjectId={undefined} mine tutors={false} full />
    </Screen>
  );
}
