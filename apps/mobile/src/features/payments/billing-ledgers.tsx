// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322 -- HeadlineTile and
// LedgerTable, as the web's phone layout (one stacked row per person, the balance on the right).
// Each ledger holds only the rows the server sent this reader: every tutor and family for the
// office, their own row for a tutor, their children's for a parent.
import { useState, type ReactNode } from 'react';
import { formatCents, type BalancesResponse, type StudentBalance, type TutorBalance } from '@tmi/shared';
import { View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { StatCard, StatGrid } from '@/components/stat-card';
import { formatMoneyValue } from '@/features/dashboard/finance-format';
import { walletMinusIcon, walletPlusIcon } from '@/features/dashboard/money-icon';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { familyLedgerSummary, tutorLedgerSummary } from './payment-format';

/** The office's three headline figures. Zero is the resting state and reads muted. */
export function BillingHeadlineTiles({ totals }: { totals: BalancesResponse['totals'] | undefined }) {
  const topups = totals ? (totals.topups_due_cents ?? 0) : undefined;
  return (
    <StatGrid>
      {[
        <StatCard
          key="owed-to-tutors"
          label="Owed to tutors"
          value={totals?.owed_to_tutors_cents}
          formatValue={formatMoneyValue}
          animate={false}
          icon={walletMinusIcon}
          tone={totals?.owed_to_tutors_cents ? 'warning' : 'default'}
        />,
        <StatCard
          key="owed-by-families"
          label="Owed by families"
          value={totals?.owed_by_families_cents}
          formatValue={formatMoneyValue}
          animate={false}
          icon={walletPlusIcon}
          tone={totals?.owed_by_families_cents ? 'brand' : 'default'}
        />,
        // What it would take to put every tutor on an advance back at their agreed level. Zero
        // says the advances have been kept up, not that nobody is on one.
        <StatCard
          key="top-ups-due"
          label="Top-ups due"
          value={topups}
          formatValue={formatMoneyValue}
          animate={false}
          icon="piggy-bank-outline"
          tone={topups ? 'warning' : 'default'}
        />,
      ]}
    </StatGrid>
  );
}

function LedgerRow({
  testID,
  name,
  summary,
  balance,
  balanceTestID,
}: {
  testID: string;
  name: string;
  summary: string;
  balance: number;
  balanceTestID: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
          {name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {summary}
        </Text>
      </View>
      <Text
        testID={balanceTestID}
        variant="bodyMedium"
        style={{
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          color: balance > 0 ? theme.colors.onSurface : theme.tokens.mutedForeground,
        }}
      >
        {formatCents(balance)}
      </Text>
    </View>
  );
}

/** Rows shown before "Show all": the office's ledgers run to dozens of families on a phone. */
export const LEDGER_PREVIEW = 8;

function Ledger({
  testID,
  title,
  caption,
  children,
}: {
  testID: string;
  title: string;
  caption: string;
  children: ReactNode[];
}) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? children : children.slice(0, LEDGER_PREVIEW);
  return (
    <Panel testID={testID} title={title}>
      <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, marginBottom: space.xs }}>
        {caption}
      </Text>
      {shown.map((child, index) => (
        <View key={index}>
          {index > 0 ? <Divider /> : null}
          {child}
        </View>
      ))}
      {children.length > LEDGER_PREVIEW ? (
        <Button
          testID={`${testID}-more`}
          mode="text"
          compact
          onPress={() => setExpanded((was) => !was)}
          style={{ alignSelf: 'flex-start', marginTop: space.xs }}
        >
          {expanded ? 'Show fewer' : `Show all ${children.length}`}
        </Button>
      ) : null}
    </Panel>
  );
}

export function TutorLedger({ tutors, isAdmin }: { tutors: TutorBalance[]; isAdmin: boolean }) {
  return (
    <Ledger
      testID="billing-tutors"
      title={isAdmin ? 'Tutors' : 'Your pay'}
      caption={
        isAdmin
          ? 'What each tutor has earned, and what they have been paid.'
          : 'What you have earned, and what you have been paid. On the right, what is still owed to you; below zero, you were paid ahead.'
      }
    >
      {tutors.map((tutor) => (
        <LedgerRow
          key={tutor.user_id}
          testID={`billing-tutor-${tutor.user_id}`}
          balanceTestID={`billing-tutor-balance-${tutor.user_id}`}
          name={tutor.full_name}
          summary={tutorLedgerSummary(tutor)}
          balance={tutor.balance_cents}
        />
      ))}
    </Ledger>
  );
}

export function FamilyLedger({
  students,
  isAdmin,
  isParent,
}: {
  students: StudentBalance[];
  isAdmin: boolean;
  isParent: boolean;
}) {
  return (
    <Ledger
      testID="billing-families"
      title={isAdmin ? 'Families' : isParent ? "Your family's balance" : 'Your balance'}
      caption={
        isAdmin
          ? 'Charges follow the student; any of their guardians may pay.'
          : 'What lessons have been charged, and what has been paid. The amount on the right is outstanding.'
      }
    >
      {students.map((student) => (
        <LedgerRow
          key={student.student_user_id}
          testID={`billing-family-${student.student_user_id}`}
          balanceTestID={`billing-family-balance-${student.student_user_id}`}
          name={student.student_name}
          summary={familyLedgerSummary(student)}
          balance={student.balance_cents}
        />
      ))}
    </Ledger>
  );
}
