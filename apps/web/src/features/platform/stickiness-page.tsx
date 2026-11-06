import { toast } from 'sonner';
import { Loader2Icon, RefreshCwIcon } from 'lucide-react';
import {
  RETENTION_WEEKS,
  SPACE_KIND_LABELS,
  STICKINESS_MIN_GROUP,
  STICKY_ARRIVAL_LABELS,
  STICKY_HAT_LABELS,
  formatDay,
  todayIn,
  type RetentionRow,
  type StickyShare,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { browserTimeZone, cn, formatTimestamp } from '@/lib/utils';
import { useRefreshStickiness, useSaveVisitSettings, useStickiness, useVisitSettings } from './api';

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

/**
 * Phase 69 (docs/member-home-plan.md H12, R30): whether people come back -- totals only, never one person's
 * days. The figures are computed once a day (or by Recompute); groups under 5 people are not shown.
 */
export function StickinessPage() {
  const report = useStickiness();
  const refresh = useRefreshStickiness();
  const data = report.data?.data ?? null;

  async function recompute() {
    try {
      await refresh.mutateAsync();
      toast.success('Figures recomputed.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'The figures could not be recomputed.');
    }
  }

  return (
    <div className="grid gap-6" data-testid="stickiness-page">
      <PageHeader
        title="Stickiness"
        description={`Whether people come back, as totals. Groups under ${STICKINESS_MIN_GROUP} people are not shown.`}
        actions={
          <Button variant="outline" onClick={() => void recompute()} disabled={refresh.isPending} data-testid="stickiness-refresh">
            {refresh.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Recompute
          </Button>
        }
      />
      <VisitSwitch />
      {report.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !data ? (
        <Card className="py-0" data-testid="stickiness-empty">
          <CardContent className="text-muted-foreground p-6 text-sm">
            No figures yet. They are computed once a day; Recompute makes them now.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-xs" data-testid="stickiness-computed">
            To {formatDay(data.day, todayIn(browserTimeZone()), { year: 'always' })} · computed {formatTimestamp(data.computed_at, '—')} ·{' '}
            {data.recording ? 'visits and days played' : 'days played only (visits are not recorded)'}
          </p>
          <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3" data-testid="stickiness-tiles">
            <Tile label="Active this week" value={String(data.weekly_active)} testId="stickiness-wau" />
            <Tile label="Active in 28 days" value={String(data.monthly_active)} testId="stickiness-mau" />
            <Tile label="Weekly over monthly" value={percent(data.wau_over_mau)} testId="stickiness-ratio" />
            <ShareTile label="Kept 3 days a week" hint="of those with 3+ days two weeks ago" value={data.rhythm_kept} testId="stickiness-rhythm" />
            <ShareTile label="Back after a missed week" hint="came the week after" value={data.return_after_miss} testId="stickiness-return" />
            <ShareTile label="Daily played" hint="learner days, last 7" value={data.daily_completion} testId="stickiness-daily" />
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <BarCard
              title="Days active last week"
              testId="stickiness-days"
              empty={data.days_per_week === null}
              bars={(data.days_per_week ?? []).slice(1).map((n, i) => ({ label: String(i + 1), value: n, tip: `${i + 1} ${i ? 'days' : 'day'}: ${n} people` }))}
            />
            <BarCard
              title="Active people each week"
              testId="stickiness-weekly"
              empty={data.weekly.every((w) => w.active <= 0)}
              bars={data.weekly.map((w) => ({
                label: w.week.slice(5),
                value: Math.max(w.active, 0),
                tip: w.active < 0 ? `Week of ${w.week}: fewer than ${STICKINESS_MIN_GROUP}` : `Week of ${w.week}: ${w.active} people`,
              }))}
            />
          </div>
          <RetentionTable rows={data.retention} />
        </>
      )}
    </div>
  );
}

function VisitSwitch() {
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
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change visit recording.');
    }
  }

  return (
    <Card className="py-0" data-testid="stickiness-visits">
      <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium">Record visits: {on ? 'on' : 'off'}</span>
          <span className="text-muted-foreground text-xs">
            {data.may_record
              ? 'One line per person, space and day they open it -- nothing about what they did. Kept 120 days.'
              : `Waiting for the privacy notice of ${data.needs_privacy_version} (published: ${data.privacy_version}). Until then only days played are counted.`}
          </span>
        </div>
        <Button
          variant={on ? 'outline' : 'default'}
          disabled={save.isPending || (!on && !data.may_record)}
          onClick={() => void toggle()}
          data-testid="stickiness-visits-toggle"
        >
          {on ? 'Switch off' : 'Switch on'}
        </Button>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <Card className="py-0" data-testid={testId}>
      <CardContent className="grid gap-0.5 p-4">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function ShareTile({ label, hint, value, testId }: { label: string; hint: string; value: StickyShare; testId: string }) {
  return (
    <Tile
      label={label}
      value={percent(value.share)}
      hint={value.share === null ? `${hint} · fewer than ${STICKINESS_MIN_GROUP}` : `${hint} · ${value.count} of ${value.base}`}
      testId={testId}
    />
  );
}

/** One series, in the brand's colour: the value on hover and in each bar's label for screen readers. */
function BarCard({ title, bars, empty, testId }: { title: string; bars: { label: string; value: number; tip: string }[]; empty: boolean; testId: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <Card className="py-0" data-testid={testId}>
      <CardContent className="grid gap-3 p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {empty ? (
          <p className="text-muted-foreground text-sm">Fewer than {STICKINESS_MIN_GROUP} people.</p>
        ) : (
          <div className="flex h-32 items-end gap-[2px] border-b" role="list">
            {bars.map((bar) => (
              <div key={bar.label} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" role="listitem" aria-label={bar.tip}>
                <div
                  className="bg-primary w-full max-w-10 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                  style={{ height: `${(bar.value / max) * 100}%`, minHeight: bar.value > 0 ? 2 : 0 }}
                />
                <span className="bg-popover text-popover-foreground pointer-events-none absolute -top-7 z-10 hidden rounded-md border px-2 py-0.5 text-xs whitespace-nowrap shadow-[var(--elevation-1)] group-hover:block">
                  {bar.tip}
                </span>
              </div>
            ))}
          </div>
        )}
        {!empty && (
          <div className="text-muted-foreground flex gap-[2px] text-xs">
            {bars.map((bar) => (
              <span key={bar.label} className="min-w-0 flex-1 truncate text-center">
                {bar.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function rowName(row: RetentionRow): string {
  const parts = [
    row.hat !== 'all' ? STICKY_HAT_LABELS[row.hat] : null,
    row.space_kind !== 'all' ? SPACE_KIND_LABELS[row.space_kind] : null,
    row.arrival !== 'all' ? STICKY_ARRIVAL_LABELS[row.arrival] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Everyone';
}

function RetentionTable({ rows }: { rows: RetentionRow[] }) {
  const shown = rows.filter((row) => row.cohort > 0 || (row.hat === 'all' && row.space_kind === 'all' && row.arrival === 'all'));
  return (
    <Card className="py-0" data-testid="stickiness-retention">
      <CardContent className="grid gap-2 p-4">
        <h2 className="text-sm font-semibold">Coming back, by week since their first day</h2>
        <p className="text-muted-foreground text-xs">
          Of the people who started in the last 13 weeks, the share who came again in week 1, 4 and 8. Rows with fewer than{' '}
          {STICKINESS_MIN_GROUP} people are left out.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-2 pr-3 font-medium">Group</th>
                <th className="py-2 pr-3 text-right font-medium">People</th>
                {RETENTION_WEEKS.map((k) => (
                  <th key={k} className="py-2 pr-3 text-right font-medium">
                    Week {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((row) => (
                <tr key={`${row.hat}.${row.space_kind}.${row.arrival}`} data-testid={`stickiness-row-${row.hat}-${row.space_kind}-${row.arrival}`}>
                  <td className={cn('py-2 pr-3', row.hat === 'all' && row.space_kind === 'all' && row.arrival === 'all' && 'font-semibold')}>{rowName(row)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.cohort || `<${STICKINESS_MIN_GROUP}`}</td>
                  {RETENTION_WEEKS.map((k) => (
                    <td key={k} className="py-2 pr-3 text-right tabular-nums">
                      {percent(row.weeks[String(k) as '1' | '4' | '8'].share)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
