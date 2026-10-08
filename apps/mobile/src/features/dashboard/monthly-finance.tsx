// Ported from apps/web/src/features/dashboard/monthly-finance.tsx @ 1132322 (the phone layout:
// one line per month with the figure that matters most, plus the year's total line).
import {
  formatMonthShort,
  monthlyNetCents,
  type MonthlyFinanceResponse,
  type MonthlyFinanceRow,
} from '@tmi/shared';
import { View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { hours, moneyOrDash } from './finance-format';

/** Months with nothing in them, dropped so January-to-December does not bury the real figures. */
export function activeMonths(data: MonthlyFinanceResponse | undefined): MonthlyFinanceRow[] {
  return (data?.months ?? []).filter(
    (row) =>
      row.session_count > 0 || row.paid_to_tutors_cents > 0 || (row.received_from_families_cents ?? 0) > 0,
  );
}

/** The year's line: the family columns stay null for anyone not entitled to them. */
export function yearTotals(months: MonthlyFinanceRow[], institute: boolean): MonthlyFinanceRow {
  return months.reduce<MonthlyFinanceRow>(
    (sum, row) => ({
      month: 'total',
      session_count: sum.session_count + row.session_count,
      minutes: sum.minutes + row.minutes,
      billed_cents: row.billed_cents === null ? null : (sum.billed_cents ?? 0) + row.billed_cents,
      received_from_families_cents:
        row.received_from_families_cents === null
          ? null
          : (sum.received_from_families_cents ?? 0) + row.received_from_families_cents,
      earned_cents: sum.earned_cents + row.earned_cents,
      paid_to_tutors_cents: sum.paid_to_tutors_cents + row.paid_to_tutors_cents,
    }),
    {
      month: 'total',
      session_count: 0,
      minutes: 0,
      billed_cents: institute ? 0 : null,
      received_from_families_cents: institute ? 0 : null,
      earned_cents: 0,
      paid_to_tutors_cents: 0,
    },
  );
}

/**
 * The financial year, month by month. Lessons count in the month they were TAUGHT and payments in
 * the month the money MOVED. A tutor sees their own teaching and their own pay: the family side is
 * not theirs, and it is simply absent (the server sends it as null), not blanked.
 */
export function MonthlyFinance({
  data,
  isLoading,
}: {
  data: MonthlyFinanceResponse | undefined;
  isLoading: boolean;
}) {
  const theme = useAppTheme();
  const institute = data?.scope === 'institute';
  const months = activeMonths(data);
  const totals = yearTotals(months, institute);
  // The figure that matters most: the organization's net, or what the tutor earned.
  const headline = (row: MonthlyFinanceRow) =>
    institute ? moneyOrDash(monthlyNetCents(row)) : moneyOrDash(row.earned_cents);
  const second = (row: MonthlyFinanceRow) =>
    institute
      ? `Billed ${moneyOrDash(row.billed_cents)} · Received ${moneyOrDash(row.received_from_families_cents)} · Tutor cost ${moneyOrDash(row.earned_cents)}`
      : `Paid to you ${moneyOrDash(row.paid_to_tutors_cents)}`;

  return (
    <Panel
      testID="monthly-finance"
      title={`${data?.year ?? ''} month by month`}
      action={{ label: 'Billing', to: '/billing' }}
    >
      {isLoading ? (
        <View style={{ gap: space.sm }}>
          <Skeleton width="100%" height={32} />
          <Skeleton width="100%" height={32} />
          <Skeleton width="100%" height={32} />
        </View>
      ) : months.length === 0 ? (
        <Text
          variant="bodyMedium"
          style={{ color: theme.tokens.mutedForeground, textAlign: 'center', paddingVertical: space.xl }}
        >
          Nothing recorded in {data?.year} yet.
        </Text>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground }}>
              Month
            </Text>
            <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground }}>
              {institute ? 'Net' : 'Earned'}
            </Text>
          </View>
          {months.map((row, index) => (
            <View key={row.month}>
              {index > 0 ? <Divider /> : null}
              <MonthLine
                testID={`monthly-finance-${row.month}`}
                label={formatMonthShort(row.month)}
                detail={`${row.session_count} sessions · ${hours(row.minutes)} hrs`}
                second={second(row)}
                figure={headline(row)}
              />
            </View>
          ))}
          <Divider bold />
          <MonthLine
            testID="monthly-finance-year"
            label="Year"
            detail={`${totals.session_count} sessions · ${hours(totals.minutes)} hrs`}
            second={second(totals)}
            figure={headline(totals)}
            strong
          />
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, marginTop: space.md }}>
            {institute
              ? 'Lessons count in the month they were taught; payments in the month the money moved. Net is what was billed for the month’s lessons, less what the tutors earned for them.'
              : 'Lessons count in the month you taught them; payments in the month you were paid.'}
          </Text>
        </View>
      )}
    </Panel>
  );
}

function MonthLine({
  label,
  detail,
  second,
  figure,
  strong = false,
  testID,
}: {
  label: string;
  detail: string;
  second: string;
  figure: string;
  strong?: boolean;
  testID: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${figure}. ${detail}. ${second}.`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
          <Text variant="bodyMedium" style={{ fontWeight: strong ? '600' : '500', minWidth: 36 }}>
            {label}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {detail}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground, fontVariant: ['tabular-nums'] }}
        >
          {second}
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {figure}
      </Text>
    </View>
  );
}
