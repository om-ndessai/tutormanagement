// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 -- the Finance halves
// of AdminView and TutorView, with SsnPanel, PaymentList and BalanceRow. Rows that link to a
// person's dashboard on the web (view-as) or to their record are plain until features 16 and 25.
import {
  PAYMENT_FORM_LABELS,
  formatCents,
  needsTopup,
  tutorAdvanceCents,
  type AdminDashboard,
  type Payment,
  type StudentBalance,
  type TutorDashboard,
} from '@tmi/shared';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { StatCard, StatGrid } from '@/components/stat-card';
import { SsnReceiptButton } from '@/features/users/ssn-receipt-button';
import { APP_VARIANT } from '@/lib/variant';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useMonthlyFinance } from './api';
import { formatMoneyValue, formatPaidOn, orgToday, orgYear } from './finance-format';
import { walletMinusIcon, walletPlusIcon } from './money-icon';
import { MonthlyFinance } from './monthly-finance';
import { TutorPayments } from './tutor-payments';
import { YearEndFinance } from './year-end-finance';

/**
 * Android's FLAG_SECURE while money is on screen: blank in recents, no screenshots. Production
 * only -- the development and e2e builds must stay screenshottable for the flows.
 */
function SecureWhileMounted() {
  usePreventScreenCapture('finance');
  return null;
}
const SECURE_FINANCE = Platform.OS === 'android' && APP_VARIANT === 'production';

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function PaymentList({ payments }: { payments: Payment[] }) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const today = orgToday(timeZone);
  if (payments.length === 0) return <EmptyNote>No payments recorded yet.</EmptyNote>;

  return (
    <View>
      {payments.map((payment, index) => (
        <View key={payment.id}>
          {index > 0 ? <Divider /> : null}
          <View
            testID={`payment-${payment.id}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                <Text style={{ fontWeight: '500' }}>{payment.party_name}</Text>
                {payment.student_name ? (
                  <Text style={{ color: theme.tokens.mutedForeground }}> for {payment.student_name}</Text>
                ) : null}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                {formatPaidOn(payment.paid_at, timeZone, today, true)} · {PAYMENT_FORM_LABELS[payment.method]}
              </Text>
            </View>
            <Text variant="bodyMedium" style={{ fontWeight: '500', fontVariant: ['tabular-nums'] }}>
              {formatCents(payment.amount_cents)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A balance, emphasised only when there is something outstanding. */
function BalanceRow({ student }: { student: StudentBalance }) {
  const theme = useAppTheme();
  const owing = student.balance_cents > 0;
  return (
    <View
      testID={`family-balance-${student.student_user_id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
          {student.student_name}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.tokens.mutedForeground }}>
          {student.guardians.map((g) => g.full_name).join(', ') || 'No guardian'}
        </Text>
      </View>
      <Text
        variant="bodyMedium"
        style={{
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          color: owing ? theme.colors.onSurface : theme.tokens.mutedForeground,
        }}
      >
        {formatCents(student.balance_cents)}
      </Text>
    </View>
  );
}

/**
 * Tutors the organization cannot issue a tax document for, because it does not have their SSN.
 * Work to chase, with the receipt button where the admin notices it -- and never anywhere to
 * enter a number: the office collects it outside the portal and records only that it arrived.
 */
function SsnPanel({ tutors }: { tutors: AdminDashboard['tutors_missing_ssn'] }) {
  const theme = useAppTheme();
  if (tutors.length === 0) return null;

  return (
    <Panel testID="ssn-panel" title={`SSN not on file · ${tutors.length}`}>
      <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, marginBottom: space.sm }}>
        A tax document cannot be issued without it. Collect it from each tutor directly — never through the
        portal — then confirm it on their record.
      </Text>
      {tutors.map((tutor, index) => (
        <View key={tutor.user_id}>
          {index > 0 ? <Divider /> : null}
          <View
            testID={`ssn-panel-tutor-${tutor.user_id}`}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.sm,
              paddingVertical: 6,
            }}
          >
            <Text variant="bodyMedium" style={{ fontWeight: '500', flexShrink: 1 }}>
              {tutor.full_name}
            </Text>
            <SsnReceiptButton userId={tutor.user_id} fullName={tutor.full_name} received={false} />
          </View>
        </View>
      ))}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** The admin's Finance tab: the organization's money, tutor payments first. */
export function AdminFinance({ data }: { data: AdminDashboard }) {
  const brand = useBrand();
  const year = orgYear(useOrgTimeZone());
  const monthly = useMonthlyFinance(year);

  return (
    <View testID="dashboard-finance-admin" style={{ gap: space.lg }}>
      {SECURE_FINANCE ? <SecureWhileMounted /> : null}
      <StatGrid>
        {[
          <StatCard
            key="owed-to-tutors"
            label="Owed to tutors"
            value={data.totals.owed_to_tutors_cents}
            formatValue={formatMoneyValue}
            animate={false}
            icon={walletMinusIcon}
            tone="warning"
            to="/billing"
          />,
          <StatCard
            key="owed-by-families"
            label="Owed by families"
            value={data.totals.owed_by_families_cents}
            formatValue={formatMoneyValue}
            animate={false}
            icon={walletPlusIcon}
            tone="brand"
            to="/billing"
          />,
          <StatCard
            key="billed"
            label="Billed all time"
            value={data.totals.billed_all_time_cents}
            formatValue={formatMoneyValue}
            animate={false}
            icon="book-open-variant"
            hint={`${data.totals.session_count} sessions`}
            to="/sessions?tab=finance"
          />,
          <StatCard
            key="kept"
            label={`Kept by ${brand.short}`}
            value={data.totals.margin_all_time_cents}
            formatValue={formatMoneyValue}
            animate={false}
            icon="piggy-bank-outline"
            tone="success"
            hint={`Paid out ${formatCents(data.totals.tutor_cost_all_time_cents)}`}
            to="/sessions?tab=finance"
          />,
        ]}
      </StatGrid>

      <TutorPayments tutors={data.tutor_balances} />

      <MonthlyFinance data={monthly.data?.data} isLoading={monthly.isPending} />

      <YearEndFinance />

      <SsnPanel tutors={data.tutors_missing_ssn} />

      <Panel
        testID="family-balances"
        title="Families with a balance"
        action={{ label: 'Billing', to: '/billing' }}
      >
        {data.student_balances.length === 0 ? (
          <EmptyNote>No students yet.</EmptyNote>
        ) : (
          data.student_balances.slice(0, 5).map((student, index) => (
            <View key={student.student_user_id}>
              {index > 0 ? <Divider /> : null}
              <BalanceRow student={student} />
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

/** The hint under "Advance held": whether a top-up is due, against their level. */
export function advanceHint(advance: TutorDashboard['earnings']): string {
  const level = formatCents(advance.topup_amount_cents ?? 0);
  return needsTopup(advance) ? `Below your ${level} level — a top-up is due` : `Topped up below ${level}`;
}

/** A tutor's own Finance tab: their earnings, from their side, and nothing of the organization's. */
export function TutorFinance({ data }: { data: TutorDashboard }) {
  const brand = useBrand();
  const theme = useAppTheme();
  // Only shown to a tutor the organization actually pays in advance.
  const advance = data.earnings.topup_amount_cents == null ? null : data.earnings;
  const year = orgYear(useOrgTimeZone());
  const monthly = useMonthlyFinance(year);

  const cards = [
    <StatCard
      key="earned"
      label="Earned"
      value={data.earnings.earned_cents}
      formatValue={formatMoneyValue}
      animate={false}
      icon="wallet-outline"
      to="/sessions?tab=finance"
    />,
    <StatCard
      key="paid"
      label="Paid to you"
      value={data.earnings.paid_cents}
      formatValue={formatMoneyValue}
      animate={false}
      icon={walletMinusIcon}
      to="/billing"
    />,
    <StatCard
      key="owed"
      label="Owed to you"
      // A tutor on an advance is usually in credit, and "owed to you -$167.50" is not a thing
      // anybody is owed: they hold money they have not worked off, which the next card says.
      value={advance ? Math.max(0, data.earnings.balance_cents) : data.earnings.balance_cents}
      formatValue={formatMoneyValue}
      animate={false}
      icon={walletPlusIcon}
      tone={data.earnings.balance_cents > 0 ? 'warning' : 'default'}
      hint={advance && data.earnings.balance_cents <= 0 ? 'Paid up front' : undefined}
      to="/billing"
    />,
  ];
  if (advance) {
    cards.push(
      <StatCard
        key="advance"
        label="Advance held"
        value={tutorAdvanceCents(advance)}
        formatValue={formatMoneyValue}
        animate={false}
        icon="piggy-bank-outline"
        tone={needsTopup(advance) ? 'warning' : 'success'}
        hint={advanceHint(advance)}
        to="/billing"
      />,
    );
  }

  return (
    <View testID="dashboard-finance-tutor" style={{ gap: space.lg }}>
      {SECURE_FINANCE ? <SecureWhileMounted /> : null}
      {/* The tax notice leads, because it is the one thing here the tutor has to act on. */}
      {!data.ssn_received_on ? (
        <Panel testID="tutor-ssn-notice" title="Action needed: your SSN">
          <Text variant="bodyMedium">
            {brand.short} does not have your Social Security number, and needs it to issue your tax document
            at the end of the year.
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground, marginTop: space.sm }}>
            Give it to the office directly — in person, or however you normally reach them.{' '}
            <Text style={{ fontWeight: '600', color: theme.colors.onSurface }}>
              Never send it through this portal
            </Text>
            , which does not store it and has nowhere to put it. They will mark it received once they have it.
          </Text>
        </Panel>
      ) : null}

      <StatGrid>{cards}</StatGrid>

      <MonthlyFinance data={monthly.data?.data} isLoading={monthly.isPending} />

      <Panel
        testID="tutor-payments-to-you"
        title="Payments to you"
        action={{ label: 'Billing', to: '/billing' }}
      >
        <PaymentList payments={data.recent_payments} />
      </Panel>
    </View>
  );
}
