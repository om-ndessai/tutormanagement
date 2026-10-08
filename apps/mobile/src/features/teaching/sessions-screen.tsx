// Ported from apps/web/src/features/teaching/sessions-page.tsx @ 1132322.
//
// The tutor's worklist and the admin's billing view are the same screen: what differs is how much
// of it the API returns, which is decided server-side. It is split into Tutoring and Finance
// (Phase 19). A tutor keeps this open during a lesson to read the last session's notes, with the
// student beside them, so Tutoring -- the default -- carries no money at all: no totals, no
// amounts on the lessons, no export, none in the screens it opens.
import { formatDuration, type TutoringSession } from '@tmi/shared';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';

import { FocusNotice } from '@/components/focus-notice';
import { useLiveBannerInset } from '@/components/live-banner-inset';
import { Skeleton } from '@/components/skeleton';
import { StatCard, StatGrid } from '@/components/stat-card';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { TutoringFinanceSwitch, useTutoringFinanceTab } from '@/components/tutoring-finance-tabs';
import { ApiRequestError } from '@/lib/api-client';
import { downloadAndShare } from '@/lib/download';
import { haptics } from '@/lib/haptics';
import { toQueryString } from '@/lib/query-string';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { AccountButton } from '@/features/shell/account-button';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useActiveSession, useSession } from './api';
import { DraftsPanel } from './drafts-panel';
import { SessionCard } from './session-card';
import { SessionFilters } from './session-filters';
import { SessionMoney } from './session-money';
import { organizationToday, type DateBounds, type SessionRange } from './session-ranges';
import { sessionMoneyTiles } from './sessions-finance-summary';
import { SESSIONS_PAGE_SIZE, useSessionPages } from './use-session-pages';

export function SessionsScreen() {
  const { user } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = organizationToday(useOrgTimeZone());
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;

  const [tab] = useTutoringFinanceTab();
  const money = tab === 'finance';

  const [range, setRange] = useState<SessionRange>('all');
  const [bounds, setBounds] = useState<DateBounds>({ from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pages = useSessionPages({ from: bounds.from || undefined, to: bounds.to || undefined });

  /**
   * A link names one session (the dashboard's carousel, later the comments feed). It may sit on
   * any page of any filter, so it is fetched on its own and shown alone until the reader asks for
   * the rest.
   */
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusId = params.focus || null;
  const focused = useSession(focusId);
  const clearFocus = () => router.setParams({ focus: undefined });

  const listSessions = pages.data?.pages.flatMap((page) => page.data) ?? [];
  const sessions = focusId ? (focused.data ? [focused.data.data] : []) : listSessions;
  const isPending = focusId ? focused.isPending : pages.isPending;
  const error = focusId
    ? focused.isError && !isNotFound(focused.error)
      ? focused.error
      : null
    : pages.error;
  const totals = pages.data?.pages[0]?.totals;
  const total = totals?.session_count ?? 0;

  const openSession = useCallback(
    (session: TutoringSession) =>
      router.push({ pathname: '/sessions/[id]', params: { id: session.id, tab } }),
    [tab],
  );

  // Recording is for tutors and the office. The sheet shows money only when opened from Finance.
  const mayRecord = isTutor || isAdmin;
  const openRecord = () => router.push({ pathname: '/record-session', params: { tab } });
  // A live lesson is a tutor's, one at a time: hidden while one is running (the banner has it).
  const active = useActiveSession();
  const mayStart = isTutor && active.isSuccess && !active.data.data.mine;
  const bannerInset = useLiveBannerInset();

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        pages.refetch(),
        focusId ? focused.refetch() : null,
        queryClient.invalidateQueries({ queryKey: ['session-drafts'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // Mirrors the on-screen filter so the export matches the view.
  async function exportCsv() {
    setExporting(true);
    try {
      haptics.impact();
      await downloadAndShare(
        `/sessions/export.csv${toQueryString({ from: bounds.from, to: bounds.to })}`,
        'sessions.csv',
      );
    } catch (failure) {
      toast.error(failure instanceof ApiRequestError ? failure.message : 'Could not download the file.');
    } finally {
      setExporting(false);
    }
  }

  const description = isAdmin
    ? 'Every lesson taught, and what it earned.'
    : isTutor
      ? 'Lessons you have taught, and what you have earned.'
      : 'Lessons taught, and what they cost.';

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {mayRecord ? (
                <IconButton
                  testID="sessions-record"
                  icon="plus"
                  size={24}
                  accessibilityLabel="Record a session"
                  style={{ margin: 0 }}
                  onPress={openRecord}
                />
              ) : null}
              <AccountButton />
            </View>
          ),
        }}
      />
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {description}
      </Text>
      {mayRecord ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {mayStart ? (
            <Button
              testID="sessions-start"
              mode="outlined"
              icon="play"
              onPress={() => router.push('/start-lesson')}
            >
              Start a lesson
            </Button>
          ) : null}
          <Button testID="sessions-record-button" mode="contained" icon="plus" onPress={openRecord}>
            Record a session
          </Button>
        </View>
      ) : null}
      <TutoringFinanceSwitch />
      {/* A draft is the author's alone (R10), so it sits above the list rather than in it -- the
          totals do not count it and never should. Tutoring only: a draft is a write-up. */}
      {!money && !focusId ? (
        <DraftsPanel
          today={today}
          onEdit={(draft) =>
            router.push({ pathname: '/record-session', params: { draft: draft.id, tab: 'tutoring' } })
          }
        />
      ) : null}
      {/* The running totals lead. Only Finance adds the money tiles. */}
      <StatGrid>
        {[
          <StatCard
            key="sessions"
            label="Sessions"
            icon="calendar-check-outline"
            value={totals?.session_count}
          />,
          <StatCard
            key="time"
            label="Time taught"
            icon="clock-outline"
            value={totals?.total_minutes}
            formatValue={formatDuration}
            animate={false}
          />,
          ...(money ? sessionMoneyTiles({ totals, isAdmin, isTutor, brandShort: brand.short }) : []),
        ]}
      </StatGrid>

      <FocusNotice
        active={Boolean(focusId)}
        found={sessions.length > 0}
        what="session"
        onClear={clearFocus}
      />

      {/* TODO(#23): the cancelled lessons panel (Phase 24) belongs here, Tutoring only and not
          while one session is in focus: why a week has no entry below. It lands with the
          Schedule tab, which ports the cancellations API and the restore dialog. */}

      {focusId ? null : (
        <SessionFilters
          range={range}
          bounds={bounds}
          today={today}
          onChange={(nextRange, nextBounds) => {
            setRange(nextRange);
            setBounds(nextBounds);
          }}
        />
      )}

      {/* The export carries every amount, so it lives with the money, and takes the current
          date filter: what you download is what you are looking at. */}
      {money && !focusId ? (
        <Button
          testID="sessions-export"
          mode="outlined"
          icon="download"
          onPress={() => void exportCsv()}
          loading={exporting}
          disabled={exporting}
          style={{ alignSelf: 'flex-start' }}
        >
          CSV
        </Button>
      ) : null}

      {error ? <ErrorState error={error} onRetry={() => void onRefresh()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading sessions"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="100%" height={112} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : null}
    </View>
  );

  const loaded = listSessions.length;
  const footer =
    !focusId && total > 0 ? (
      <View
        testID="sessions-list-footer"
        style={{ alignItems: 'center', gap: space.sm, paddingTop: space.sm }}
      >
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Showing 1–{loaded} of {total}
        </Text>
        {pages.hasNextPage ? (
          <Button
            testID="sessions-load-more"
            mode="outlined"
            onPress={() => void pages.fetchNextPage()}
            loading={pages.isFetchingNextPage}
            disabled={pages.isFetchingNextPage}
          >
            Load {Math.min(SESSIONS_PAGE_SIZE, total - loaded)} more
          </Button>
        ) : null}
      </View>
    ) : null;

  return (
    <FlashList
      testID="screen-sessions"
      data={sessions}
      keyExtractor={(session) => session.id}
      renderItem={({ item }) => (
        <View style={{ paddingBottom: space.md }}>
          <SessionCard
            session={item}
            today={today}
            onPress={openSession}
            money={money ? <SessionMoney session={item} /> : undefined}
          />
        </View>
      )}
      extraData={money}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        // In focus, a lesson that is not there is the FocusNotice's sentence.
        isPending || error || focusId ? null : (
          <EmptyState
            testID="sessions-empty"
            icon="book-open-variant"
            title={`No sessions recorded${bounds.from || bounds.to ? ' in this period' : ' yet'}.`}
          />
        )
      }
      // A lesson just recorded arrives at the top, and a reader at the top should see it: FlashList
      // otherwise keeps the old first card in place and scrolls the header away under the bar.
      maintainVisibleContentPosition={{ disabled: true }}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + bannerInset }}
    />
  );
}

/** A lesson that is not there (or not the reader's to see) is the FocusNotice's case, not an error. */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}
