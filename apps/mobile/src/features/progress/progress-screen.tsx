// Ported from apps/web/src/features/progress/{progress-page.tsx, progress-list.tsx} @ 1132322.
//
// Every student the reader may follow, and where each stands against their plan. An admin sees the
// organization; a tutor their students; a parent their children; a student themselves -- all
// decided by the server. The filters only narrow what it sent.
import { PROGRESS_STATUS_LABELS, type ProgressOverview, type ProgressStatus } from '@tmi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, Chip, Divider, Menu, Searchbar, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { useAssignments } from '@/features/teaching/api';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useProgressOverview } from './api';
import { ProgressMeter } from './progress-meter';
import {
  STATUS_ORDER,
  filterOverview,
  overviewLine,
  statusCounts,
  tutorsFromPairings,
} from './progress-model';
import { ProgressStatusBadge } from './rating';

export function ProgressScreen() {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const { data, isPending, error, refetch } = useProgressOverview();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProgressStatus | 'all'>('all');
  const [tutorMenu, setTutorMenu] = useState(false);

  // One student, or one tutor's students (Phase 21). Kept in the route, so a link keeps the view.
  const params = useLocalSearchParams<{ student?: string; tutor?: string }>();
  const studentFilter = params.student || 'all';
  const tutorFilter = params.tutor || 'all';

  // Who teaches whom, from the pairings this reader can see.
  const { data: assignmentData } = useAssignments({});
  const tutors = useMemo(() => tutorsFromPairings(assignmentData?.data ?? []), [assignmentData]);
  const tutor = tutors.find((candidate) => candidate.id === tutorFilter) ?? null;

  const all = useMemo(() => data?.data ?? [], [data]);
  const rows = useMemo(
    () =>
      filterOverview(all, {
        search,
        status,
        student: studentFilter,
        tutorStudents: tutorFilter === 'all' ? null : (tutor?.students ?? new Set()),
      }),
    [all, search, status, studentFilter, tutorFilter, tutor],
  );
  const counts = useMemo(() => statusCounts(all), [all]);
  const studentName = all.find((row) => row.student_user_id === studentFilter)?.student_name;
  const filtered = Boolean(search) || status !== 'all' || studentFilter !== 'all' || tutorFilter !== 'all';

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function chooseStatus(next: ProgressStatus | 'all') {
    if (next === status) return;
    haptics.selection();
    setStatus(next);
  }

  return (
    <Screen testID="screen-progress" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Text variant="bodyMedium" style={{ color: muted }}>
        {isAdmin
          ? 'Every student against their learning plan. Open one to assess them or set a plan.'
          : 'Where each student stands against the plan agreed for them.'}
      </Text>

      <View style={{ gap: space.sm }}>
        <Searchbar
          testID="progress-search"
          placeholder="Find a student"
          accessibilityLabel="Find a student"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />

        {/* The narrowing a link or a menu made, each with its own way out. */}
        {studentFilter !== 'all' || tutors.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {studentFilter !== 'all' ? (
              <Chip
                testID="progress-student-chip"
                icon="account"
                onClose={() => router.setParams({ student: undefined })}
                closeIconAccessibilityLabel="Show every student"
              >
                {studentName ?? 'One student'}
              </Chip>
            ) : null}
            {tutors.length > 1 ? (
              <Menu
                visible={tutorMenu}
                onDismiss={() => setTutorMenu(false)}
                anchor={
                  <Chip
                    testID="progress-tutor-filter"
                    icon="account-school-outline"
                    selected={tutor !== null}
                    showSelectedCheck={false}
                    mode={tutor ? 'flat' : 'outlined'}
                    onPress={() => setTutorMenu(true)}
                    accessibilityHint="Choose whose students to show"
                  >
                    {tutor ? `${tutor.name}’s students` : 'All tutors'}
                  </Chip>
                }
              >
                <Menu.Item
                  testID="progress-tutor-all"
                  title="All tutors"
                  onPress={() => {
                    haptics.selection();
                    setTutorMenu(false);
                    router.setParams({ tutor: undefined });
                  }}
                />
                {tutors.map((candidate) => (
                  <Menu.Item
                    key={candidate.id}
                    testID={`progress-tutor-${candidate.id}`}
                    title={`${candidate.name}’s students`}
                    onPress={() => {
                      haptics.selection();
                      setTutorMenu(false);
                      router.setParams({ tutor: candidate.id });
                    }}
                  />
                ))}
              </Menu>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
          accessibilityRole="radiogroup"
          accessibilityLabel="Where they stand"
        >
          <Chip
            testID="progress-filter-all"
            selected={status === 'all'}
            showSelectedCheck={false}
            mode={status === 'all' ? 'flat' : 'outlined'}
            accessibilityRole="radio"
            accessibilityState={{ checked: status === 'all' }}
            onPress={() => chooseStatus('all')}
          >
            All
          </Chip>
          {STATUS_ORDER.filter((value) => counts.has(value)).map((value) => (
            <Chip
              key={value}
              testID={`progress-filter-${value}`}
              selected={status === value}
              showSelectedCheck={false}
              mode={status === value ? 'flat' : 'outlined'}
              accessibilityRole="radio"
              accessibilityState={{ checked: status === value }}
              accessibilityLabel={`${PROGRESS_STATUS_LABELS[value]}, ${counts.get(value)}`}
              onPress={() => chooseStatus(value)}
            >
              {`${PROGRESS_STATUS_LABELS[value]} · ${counts.get(value)}`}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading progress"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} width="100%" height={64} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : null}

      {data ? (
        rows.length === 0 ? (
          <Text
            testID="progress-empty"
            variant="bodyMedium"
            style={{ color: muted, textAlign: 'center', paddingVertical: space.xl }}
          >
            {filtered ? 'No student matches.' : 'There are no students for you to follow yet.'}
          </Text>
        ) : (
          <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
            {rows.map((row, index) => (
              <View key={row.student_user_id}>
                {index > 0 ? <Divider /> : null}
                <ProgressRow row={row} />
              </View>
            ))}
          </Card>
        )
      ) : null}
    </Screen>
  );
}

/** One line per student: goal, status, and how far along. Opens their page. */
export function ProgressRow({ row }: { row: ProgressOverview }) {
  const theme = useAppTheme();
  const { summary } = row;
  return (
    <Pressable
      testID={`progress-row-${row.student_user_id}`}
      accessibilityRole="link"
      accessibilityLabel={
        `${row.student_name}. ${overviewLine(row)}. ` +
        (summary.topic_count > 0 ? `${summary.percent}% mastered. ` : '') +
        PROGRESS_STATUS_LABELS[summary.status]
      }
      onPress={() =>
        router.push({ pathname: '/progress/[studentId]', params: { studentId: row.student_user_id } })
      }
      style={({ pressed }) => ({
        minHeight: MIN_TARGET,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        gap: space.sm,
        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyLarge" numberOfLines={1} style={{ fontWeight: '500' }}>
            {row.student_name}
          </Text>
          <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.tokens.mutedForeground }}>
            {overviewLine(row)}
          </Text>
        </View>
        <ProgressStatusBadge status={summary.status} />
      </View>
      {summary.topic_count > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <ProgressMeter
              testID={`progress-meter-${row.student_user_id}`}
              percent={summary.percent}
              expected={summary.expected_percent}
            />
          </View>
          <Text
            variant="labelMedium"
            style={{ width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}
          >
            {summary.percent}%
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
