// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322: one route, four dashboards, with the
// role selector and the admin's "view as" kept in Home's params as the web keeps them in the URL.
import { useQueryClient } from '@tanstack/react-query';
import { USER_ROLES, type UserRole } from '@tmi/shared';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useLargeText } from '@/hooks/use-large-text';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { DashboardSkeleton } from '@/components/skeletons';
import { TutoringFinanceTabs, useTutoringFinanceTab } from '@/components/tutoring-finance-tabs';
import { TutorNow, useNowState } from '@/features/home/tutor-now';
import { LessonReminderSheet } from '@/features/locations/lesson-reminder';
import { useOptionalOnboarding } from '@/features/onboarding/onboarding-provider';
import { useTourScroller } from '@/features/onboarding/tour-targets';
import { AccountButton } from '@/features/shell/account-button';
import { SearchButton } from '@/features/shell/search-button';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useDashboard } from './api';
import { AdminFinance, TutorFinance } from './finance-views';
import { ParentView } from './parent-balance-view';
import { publishHomeRole, onHomeRoleChosen } from './home-role';
import { Greeting, TodayCard, useToday, type TodayScope } from './home-top';
import { RoleSelector } from './role-selector';
import { StudentView } from './student-view';
import { AdminTutoring, TutorTutoring } from './tutoring-views';
import { onSubjectChosen } from './view-as';
import { ViewAsBanner } from './view-as-banner';

export function asRole(value: string | undefined): UserRole | undefined {
  return USER_ROLES.find((role) => role === value);
}

/** The header's actions: the admin's "view as" beside the account button. */
function HeaderActions({ isAdmin, viewingId }: { isAdmin: boolean; viewingId: string | undefined }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {isAdmin ? (
        <IconButton
          testID="dashboard-view-as"
          icon="eye-outline"
          size={22}
          iconColor={theme.colors.onSurface}
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
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const large = useLargeText();
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

  // The account sheet's role chips (U6): what Home shows of the reader's own, and their choice.
  const ownRoles = viewingId ? null : (subject?.roles ?? null);
  const ownKey = ownRoles?.join(',');
  useEffect(() => {
    publishHomeRole(
      ownKey && shownRole ? { roles: ownKey.split(',') as UserRole[], current: shownRole } : null,
    );
  }, [ownKey, shownRole]);
  useEffect(() => () => publishHomeRole(null), []);
  useEffect(
    () => onHomeRoleChosen((role) => navigation.setParams({ role, tab: undefined } as never)),
    [navigation],
  );

  // Phase 43: the Now card greets the reader by name when it is about their next lesson, so the
  // heading's greeting gives way to it on the Tutoring tab (never twice on one screen).
  const tutors = !viewingId && (user?.roles.includes('tutor') ?? false);
  const now = useNowState(tutors);
  const [tab] = useTutoringFinanceTab();
  const nowGreets =
    tutors &&
    tab === 'tutoring' &&
    (shownRole === 'tutor' || shownRole === 'admin') &&
    now.state.kind === 'next';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['schedules', 'upcoming'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
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
      {viewingOther && subject ? (
        <View style={{ gap: 2 }}>
          <Text testID="dashboard-heading" variant="titleMedium">
            {`${subject.full_name}'s dashboard`}
          </Text>
          {large ? null : (
            <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
              You are seeing the portal exactly as they see it.
            </Text>
          )}
        </View>
      ) : nowGreets ? null : (
        <Greeting />
      )}
      {viewingOther && subject && response ? <ViewAsBanner subject={subject} role={response.role} /> : null}
      {/* The reader's own roles are chosen in the account sheet (UI upgrades U6); while viewing
          somebody else, their roles stay here, under whose they are. */}
      {viewingOther && subject && response ? (
        <RoleSelector roles={subject.roles} current={response.role} />
      ) : null}
      <RoleDashboard
        query={query}
        subjectId={viewingOther ? subject?.user_id : undefined}
        mine={!viewingId}
        tutors={tutors}
      />
      {/* Phase 33: a lesson about to start, where its locations ask for a reminder. Never while
          viewing someone else. */}
      {!viewingId ? <LessonReminderSheet /> : null}
    </Screen>
  );
}

/** Today for the office or a tutor: above the tabs, no money. */
function ScopedToday({ scope }: { scope: TodayScope }) {
  const today = useToday(scope);
  return <TodayCard summary={today.summary} pending={today.pending} failed={today.failed} />;
}

export function RoleDashboard({
  query,
  subjectId,
  mine,
  tutors,
  full = false,
}: {
  query: ReturnType<typeof useDashboard>;
  /** The person being viewed, when it is not the reader. */
  subjectId: string | undefined;
  /** The reader's own dashboard (not an admin's "view as"). */
  mine: boolean;
  /** The reader tutors here and is on their own Home: the Now card and brief lead Tutoring. */
  tutors: boolean;
  /** The Dashboard page: Home's sections plus Analytics and Recent Activity, as the web's dashboard. */
  full?: boolean;
}) {
  const { data, isPending, isError, error, refetch } = query;
  const response = data?.data;

  if (isPending) return <DashboardSkeleton />;
  if (isError || !response) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const view = response.data;
  // Phase 43 (the owner, 2026-10-20): Analytics left Home for the Dashboard screen (More →
  // Dashboard), and the Now card with the next lesson's brief leads the Tutoring tab of anyone who
  // tutors -- an admin too, for their own pairings.
  const lead = mine && tutors && !full ? <TutorNow /> : null;
  let body: ReactNode;
  switch (view.kind) {
    case 'admin':
      body = (
        <>
          <ScopedToday scope={{ who: 'both' }} />
          <TutoringFinanceTabs
            tutoring={<AdminTutoring data={view} lead={lead} full={full} />}
            finance={<AdminFinance data={view} />}
          />
        </>
      );
      break;
    case 'tutor':
      body = (
        <>
          {/* Their own teaching only, even for a tutor who also parents (as the carousel). */}
          <ScopedToday scope={{ who: 'student', tutorUserId: view.earnings.user_id }} />
          <TutoringFinanceTabs
            tutoring={<TutorTutoring data={view} mine={mine} lead={lead} full={full} />}
            finance={<TutorFinance data={view} subjectId={subjectId} />}
          />
        </>
      );
      break;
    case 'parent':
      body = <ParentView data={view} />;
      break;
    case 'student':
      body = (
        <StudentView
          data={view}
          studentId={response.subject.user_id}
          studentName={response.subject.full_name}
        />
      );
      break;
  }
  // No wrapping view: every level added deepens the tree iOS UI tests can read (XCUITest's snapshot
  // stops at a depth, and the parent's figures fell past it).
  return body;
}
