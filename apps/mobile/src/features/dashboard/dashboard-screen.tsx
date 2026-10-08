// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322 (the person's own dashboard; the
// role selector and view-as are feature 16)
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TutoringFinanceTabs } from '@/components/tutoring-finance-tabs';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useDashboard } from './api';
import { AdminFinance, TutorFinance } from './finance-views';
import { ParentView } from './parent-balance-view';
import { StudentView } from './student-view';
import { AdminTutoring, TutorTutoring } from './tutoring-views';

/**
 * Home: who is signed in, then their dashboard. Which one is the server's choice, made the same
 * way as the web (`defaultDashboardRole`: admin, then tutor, then parent, then student) -- so
 * someone who tutors and parents lands on the tutor's, as on the web.
 */
export function DashboardScreen() {
  const { user } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

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
    <Screen testID="screen-home" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <View style={{ gap: 2 }}>
        <Text testID="home-user" variant="titleMedium">
          {user?.full_name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {brand.name}
        </Text>
      </View>
      <RoleDashboard />
    </Screen>
  );
}

function RoleDashboard() {
  const { data, isPending, isError, error, refetch } = useDashboard({});
  const response = data?.data;

  if (isPending) return <LoadingState label="Loading your dashboard…" testID="dashboard-loading" />;
  if (isError || !response) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const view = response.data;
  switch (view.kind) {
    case 'admin':
      return (
        <TutoringFinanceTabs
          tutoring={<AdminTutoring data={view} />}
          finance={<AdminFinance data={view} />}
        />
      );
    case 'tutor':
      return (
        <TutoringFinanceTabs
          tutoring={<TutorTutoring data={view} />}
          finance={<TutorFinance data={view} />}
        />
      );
    case 'parent':
      return <ParentView data={view} />;
    case 'student':
      return <StudentView data={view} />;
  }
}
