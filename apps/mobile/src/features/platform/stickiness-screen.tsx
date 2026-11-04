// Ported from apps/web/src/features/platform/stickiness-page.tsx @ 755021b (working tree, Phase 69,
// docs/member-home-plan.md H12, R30): whether people come back -- totals only, never one person's days.
// The figures are computed once a day (or by Recompute); groups under 5 people are not shown.
// Mobile: pushed over the console's tabs from the chart in its header (the tabs are full); the tiles two to
// a row; a bar's value shows under its chart on a press (and is each bar's spoken label); retention is a
// list of rows with Week 1/4/8 rather than a wide table.
import { RETENTION_WEEKS, STICKINESS_MIN_GROUP, formatRelativeTime, type RetentionRow, type StickyShare } from '@tmi/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { DetailSkeleton } from '@/components/skeletons';
import { StatCard, StatGrid, type StatIcon } from '@/components/stat-card';
import { ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useRefreshStickiness, useSaveVisitSettings, useStickiness, useVisitSettings } from './api';
import {
  cohortLabel,
  dayBars,
  percent,
  rowKey,
  rowName,
  shareHint,
  shownRows,
  visitsLine,
  visitsToggleEnabled,
  weeklyBars,
  weeklyEmpty,
  type Bar,
} from './stickiness-model';

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiRequestError && caught.status !== 0 ? caught.message : fallback;
}

export function StickinessScreen() {
  const theme = useAppTheme();
  const toast = useToast();
  const report = useStickiness();
  const visits = useVisitSettings();
  const refresh = useRefreshStickiness();
  const data = report.data?.data ?? null;
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([report.refetch(), visits.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function recompute() {
    try {
      await refresh.mutateAsync();
      toast.success('Figures recomputed.');
    } catch (caught) {
      toast.error(failure(caught, 'The figures could not be recomputed.'));
    }
  }

  const muted = { color: theme.tokens.mutedForeground };

  return (
    <Screen testID="screen-platform-stickiness" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <View testID="stickiness-page" style={{ gap: space.lg }}>
        <PageIntro>{`Whether people come back, as totals. Groups under ${STICKINESS_MIN_GROUP} people are not shown.`}</PageIntro>
        <Button
          testID="stickiness-refresh"
          mode="outlined"
          icon="refresh"
          loading={refresh.isPending}
          disabled={refresh.isPending}
          onPress={() => {
            haptics.selection();
            void recompute();
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          Recompute
        </Button>
        <VisitSwitch />
        {report.isPending ? (
          <DetailSkeleton label="Loading the figures…" />
        ) : report.isError ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : !data ? (
          <Panel testID="stickiness-empty">
            <Text variant="bodyMedium" style={[muted, { paddingVertical: space.sm }]}>
              No figures yet. They are computed once a day; Recompute makes them now.
            </Text>
          </Panel>
        ) : (
          <>
            <Text testID="stickiness-computed" variant="bodySmall" style={muted}>
              {`To ${data.day} · computed ${formatRelativeTime(data.computed_at) || '—'} · ${
                data.recording ? 'visits and days played' : 'days played only (visits are not recorded)'
              }`}
            </Text>
            <StatGrid>
              <Tile testID="stickiness-wau" label="Active this week" icon="account-group-outline" value={data.weekly_active} />
              <Tile testID="stickiness-mau" label="Active in 28 days" icon="calendar-month-outline" value={data.monthly_active} />
              <Tile testID="stickiness-ratio" label="Weekly over monthly" icon="percent-outline" share={data.wau_over_mau} />
              <ShareTile
                testID="stickiness-rhythm"
                label="Kept 3 days a week"
                hint="of those with 3+ days two weeks ago"
                icon="repeat"
                value={data.rhythm_kept}
              />
              <ShareTile
                testID="stickiness-return"
                label="Back after a missed week"
                hint="came the week after"
                icon="keyboard-return"
                value={data.return_after_miss}
              />
              <ShareTile
                testID="stickiness-daily"
                label="Daily played"
                hint="learner days, last 7"
                icon="calendar-check-outline"
                value={data.daily_completion}
              />
            </StatGrid>
            <BarCard testID="stickiness-days" title="Days active last week" empty={data.days_per_week === null} bars={dayBars(data)} />
            <BarCard testID="stickiness-weekly" title="Active people each week" empty={weeklyEmpty(data)} bars={weeklyBars(data)} />
            <RetentionList rows={data.retention} />
          </>
        )}
      </View>
    </Screen>
  );
}

function VisitSwitch() {
  const theme = useAppTheme();
  const toast = useToast();
  const settings = useVisitSettings();
  const save = useSaveVisitSettings();
  const data = settings.data?.data;
  if (!data) return null;
  const on = data.settings.record;

  async function toggle() {
    try {
      await save.mutateAsync({ record: !on });
      toast.success(on ? 'Visit recording off.' : 'Visit recording on.');
    } catch (caught) {
      toast.error(failure(caught, 'Could not change visit recording.'));
    }
  }

  return (
    <Panel testID="stickiness-visits">
      <View style={{ gap: space.md, paddingVertical: space.sm }}>
        <View style={{ gap: 2 }}>
          <Text testID="stickiness-visits-state" variant="titleSmall" style={{ fontWeight: '600' }}>
            Record visits: {on ? 'on' : 'off'}
          </Text>
          <Text testID="stickiness-visits-line" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {visitsLine(data)}
          </Text>
        </View>
        <Button
          testID="stickiness-visits-toggle"
          mode={on ? 'outlined' : 'contained'}
          disabled={save.isPending || !visitsToggleEnabled(data)}
          loading={save.isPending}
          onPress={() => {
            haptics.selection();
            void toggle();
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          {on ? 'Switch off' : 'Switch on'}
        </Button>
      </View>
    </Panel>
  );
}

/** A count, or a share as a percent ("—" while suppressed), in the app's StatCard. */
function Tile({
  testID,
  label,
  icon,
  value,
  share,
  hint,
}: {
  testID: string;
  label: string;
  icon: StatIcon;
  value?: number;
  share?: number | null;
  hint?: string;
}) {
  const isShare = share !== undefined;
  const figure = isShare ? (share === null ? undefined : Math.round(share * 100)) : value;
  return (
    <View testID={testID} style={{ flex: 1 }}>
      <StatCard
        label={label}
        icon={icon}
        value={figure}
        formatValue={isShare ? (n) => `${n}%` : undefined}
        hint={hint}
        animate={false}
      />
    </View>
  );
}

function ShareTile({ testID, label, hint, icon, value }: { testID: string; label: string; hint: string; icon: StatIcon; value: StickyShare }) {
  return <Tile testID={testID} label={label} icon={icon} share={value.share} hint={shareHint(hint, value)} />;
}

/** One series in the brand's colour: a press shows the bar's value under the chart; each bar says it aloud. */
function BarCard({ testID, title, bars, empty }: { testID: string; title: string; bars: Bar[]; empty: boolean }) {
  const theme = useAppTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const muted = { color: theme.tokens.mutedForeground };
  return (
    <Panel testID={testID} title={title}>
      {empty ? (
        <Text testID={`${testID}-empty`} variant="bodyMedium" style={muted}>
          Fewer than {STICKINESS_MIN_GROUP} people.
        </Text>
      ) : (
        <View style={{ gap: space.xs }}>
          <View
            accessibilityRole="list"
            style={{
              height: 128,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 2,
              borderBottomWidth: 1,
              borderBottomColor: theme.tokens.border,
            }}
          >
            {bars.map((bar, index) => (
              <Pressable
                key={bar.label}
                testID={`${testID}-bar-${index}`}
                accessibilityRole="button"
                accessibilityLabel={bar.tip}
                onPress={() => {
                  haptics.selection();
                  setPicked(picked === index ? null : index);
                }}
                style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
              >
                <View
                  style={{
                    width: '100%',
                    maxWidth: 40,
                    height: `${(bar.value / max) * 100}%`,
                    minHeight: bar.value > 0 ? 2 : 0,
                    borderTopLeftRadius: radius.sm,
                    borderTopRightRadius: radius.sm,
                    backgroundColor: theme.colors.primary,
                    opacity: picked === null || picked === index ? 1 : 0.45,
                  }}
                />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 2 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {bars.map((bar) => (
              <Text key={bar.label} numberOfLines={1} style={[muted, { flex: 1, fontSize: 10, textAlign: 'center' }]}>
                {bar.label}
              </Text>
            ))}
          </View>
          <Text testID={`${testID}-picked`} variant="bodySmall" style={muted}>
            {picked !== null && bars[picked] ? bars[picked].tip : 'Press a bar for its value.'}
          </Text>
        </View>
      )}
    </Panel>
  );
}

function RetentionList({ rows }: { rows: RetentionRow[] }) {
  const theme = useAppTheme();
  const muted = { color: theme.tokens.mutedForeground };
  const shown = shownRows(rows);
  return (
    <Panel testID="stickiness-retention" title="Coming back, by week since their first day">
      <View style={{ gap: space.sm }}>
        <Text variant="bodySmall" style={muted}>
          {`Of the people who started in the last 13 weeks, the share who came again in week 1, 4 and 8. Rows with fewer than ${STICKINESS_MIN_GROUP} people are left out.`}
        </Text>
        {shown.map((row, index) => {
          const everyone = row.hat === 'all' && row.space_kind === 'all' && row.arrival === 'all';
          const weeks = RETENTION_WEEKS.map((k) => ({ k, value: percent(row.weeks[String(k) as '1' | '4' | '8'].share) }));
          return (
            <View key={rowKey(row)}>
              {index > 0 ? <Divider /> : null}
              <View
                testID={`stickiness-row-${rowKey(row)}`}
                accessible
                accessibilityLabel={`${rowName(row)}: ${cohortLabel(row)} people. ${weeks.map((w) => `Week ${w.k}: ${w.value}`).join(', ')}`}
                style={{ gap: space.xs, paddingVertical: space.sm }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="bodyMedium" style={{ flexShrink: 1, fontWeight: everyone ? '700' : '400' }}>
                    {rowName(row)}
                  </Text>
                  <Text variant="bodyMedium" style={[muted, { fontVariant: ['tabular-nums'] }]}>
                    {cohortLabel(row)} people
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  {weeks.map((w) => (
                    <Text key={w.k} variant="bodySmall" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
                      <Text variant="bodySmall" style={muted}>{`Week ${w.k} `}</Text>
                      {w.value}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}
