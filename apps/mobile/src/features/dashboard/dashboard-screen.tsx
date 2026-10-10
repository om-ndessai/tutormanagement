// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322: one route, four dashboards, with the
// role selector and the admin's "view as" kept in Home's params as the web keeps them in the URL.
import { useQueryClient } from '@tanstack/react-query';
import { USER_ROLES, type UserRole } from '@tmi/shared';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TutoringFinanceTabs } from '@/components/tutoring-finance-tabs';
import { useOptionalOnboarding } from '@/features/onboarding/onboarding-provider';
import { useTourScroller } from '@/features/onboarding/tour-targets';
import { AccountButton } from '@/features/shell/account-button';
import { SearchButton } from '@/features/shell/search-button';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useDashboard } from './api';
import { AdminFinance, TutorFinance } from './finance-views';
import { ParentView } from './parent-balance-view';
import { RoleSelector } from './role-selector';
import { StudentView } from './student-view';
import { AdminTutoring, TutorTutoring } from './tutoring-views';
import { onSubjectChosen } from './view-as';
import { ViewAsBanner } from './view-as-banner';

function asRole(value: string | undefined): UserRole | undefined {
  return USER_ROLES.find((role) => role === value);
}

/** The header's actions: the admin's "view as" beside the account button. */
function HeaderActions({ isAdmin, viewingId }: { isAdmin: boolean; viewingId: string | undefined }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {isAdmin ? (
        <IconButton
          testID="dashboard-view-as"
          icon="eye-outline"
          size={22}
          accessibilityLabel="View dashboard as"
          style={{ margin: 0 }}
          onPress={() =>
            router.push({ pathname: '/view-as', params: viewingId ? { current: viewingId } : {} })
          }
        />
      ) : null}
      <SearchButton />
      <AccountButton />
    </View>
  );
}

/**
 * Home: whose dashboard, then the dashboard. Which role is the server's choice unless one is asked
 * for (`?role=`), made the same way as the web (`defaultDashboardRole`: admin, then tutor, then
 * parent, then student) -- so someone who tutors and parents lands on the tutor's. An admin may
 * look at anybody's (`?as=`); for anyone else the param is ignored, so the app never asks the
 * server for somebody else's dashboard on their behalf.
 */
export function DashboardScreen() {
  const { user } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams<{ as?: string; role?: string }>();
  const navigation = useNavigation();

  // The people sheet's choice: this screen's own params, whoever is focused. A new subject
  // clears the chosen role and tab, as on the web.
  useEffect(
    () =>
      onSubjectChosen((userId) =>
        navigation.setParams({ as: userId ?? undefined, role: undefined, tab: undefined } as never),
      ),
    [navigation],
  );

  const isAdmin = user?.roles.includes('admin') ?? false;
  const viewingId = isAdmin && params.as && params.as !== user?.id ? params.as : undefined;
  const requestedRole = asRole(params.role);

  const query = useDashboard({
    ...(requestedRole ? { role: requestedRole } : {}),
    ...(viewingId ? { userId: viewingId } : {}),
  });
  const response = query.data?.data;
  const subject = response?.subject;
  const viewingOther = Boolean(viewingId && subject?.viewing_as_other);

  // The welcome wizard waits for this: never while viewing somebody else, and a tour that matches
  // the dashboard on screen (#34).
  const onboarding = useOptionalOnboarding();
  const reportDashboard = onboarding?.reportDashboard;
  const shownRole = response?.role ?? null;
  useEffect(() => {
    reportDashboard?.({ role: viewingId ? null : shownRole, viewingAs: Boolean(viewingId) });
  }, [reportDashboard, shownRole, viewingId]);
  const tourScroller = useTourScroller();

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
    <Screen
      // A new subject starts at the top, not wherever the last one was scrolled to.
      key={viewingId ?? 'me'}
      testID="screen-home"
      scrollRef={tourScroller}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      <Stack.Screen
        options={{ headerRight: () => <HeaderActions isAdmin={isAdmin} viewingId={viewingId} /> }}
      />
      <View style={{ gap: 2 }}>
        <Text testID={viewingOther ? 'dashboard-heading' : 'home-user'} variant="titleMedium">
          {viewingOther && subject ? `${subject.full_name}'s dashboard` : user?.full_name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {viewingOther ? 'You are seeing the portal exactly as they see it.' : brand.name}
        </Text>
      </View>
      {viewingOther && subject && response ? <ViewAsBanner subject={subject} role={response.role} /> : null}
      {subject && response ? <RoleSelector roles={subject.roles} current={response.role} /> : null}
      <RoleDashboard query={query} subjectId={viewingOther ? subject?.user_id : undefined} />
    </Screen>
  );
}

function RoleDashboard({
  query,
  subjectId,
}: {
  query: ReturnType<typeof useDashboard>;
  /** The person being viewed, when it is not the reader. */
  subjectId: string | undefined;
}) {
  const { data, isPending, isError, error, refetch } = query;
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
          finance={<TutorFinance data={view} subjectId={subjectId} />}
        />
      );
    case 'parent':
      return <ParentView data={view} />;
    case 'student':
      return <StudentView data={view} />;
  }
}
