// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322 -- HeadlineTile and
// LedgerTable, as the web's phone layout (one stacked row per person, the balance on the right).
// Each ledger holds only the rows the server sent this reader: every tutor and family for the
// office, their own row for a tutor, their children's for a parent. Phase 54 (working tree): the
// "Families and tutors" ledger of a space paid directly, one row per family and tutor.
import { useState, type ReactNode } from 'react';
import {
  formatCents,
  type BalancesResponse,
  type DirectBalance,
  type StudentBalance,
  type TutorBalance,
} from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { AdaptiveRow } from '@/components/adaptive-row';
import { useLargeText } from '@/hooks/use-large-text';
import { EmptyNote, Panel } from '@/components/section';
import { StatCard, StatGrid } from '@/components/stat-card';
import { formatMoneyValue } from '@/features/dashboard/finance-format';
import { walletMinusIcon, walletPlusIcon } from '@/features/dashboard/money-icon';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { directLedgerSummary, familyLedgerSummary, tutorLedgerSummary } from './payment-format';

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

/** Phase 54, a space paid directly: the office's one headline, what families owe their tutors. */
export function BillingDirectTiles({ totals }: { totals: BalancesResponse['totals'] | undefined }) {
  return (
    <StatGrid>
      {[
        <StatCard
          key="owed-directly"
          label="Owed by families to tutors"
          value={totals?.owed_directly_cents}
          formatValue={formatMoneyValue}
          animate={false}
          icon={walletPlusIcon}
          tone={totals?.owed_directly_cents ? 'brand' : 'default'}
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
  onPress,
}: {
  testID: string;
  name: string;
  summary: string;
  balance: number;
  balanceTestID: string;
  /** The office's shortcut to a payment for this party (ux-audit F-21). */
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const large = useLargeText();
  const content = (
    <AdaptiveRow testID={testID} align="center" gap={space.md} style={{ paddingVertical: 10 }}>
      <View style={{ flex: large ? undefined : 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={large ? undefined : 1} style={{ fontWeight: '500' }}>
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
    </AdaptiveRow>
  );
  if (!onPress) return content;
  // Not one accessible element, so its lines are still read (and found by the flows); Record a
  // payment above is the labelled way to the same sheet.
  return (
    <Pressable
      testID={`${testID}-pay`}
      accessible={false}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/** Rows shown before "Show all": the office's ledgers run to dozens of families on a phone. */
export const LEDGER_PREVIEW = 8;

function Ledger({
  testID,
  title,
  caption,
  empty,
  children,
}: {
  testID: string;
  title: string;
  caption: string;
  /** What an empty ledger says, rather than a caption over nothing (ux-audit F-28). */
  empty: string;
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
      {children.length === 0 ? <EmptyNote testID={`${testID}-empty`}>{empty}</EmptyNote> : null}
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

export function TutorLedger({
  tutors,
  isAdmin,
  payable = true,
}: {
  tutors: TutorBalance[];
  isAdmin: boolean;
  /** False in a space paid directly (Phase 54): nobody pays a tutor there. */
  payable?: boolean;
}) {
  return (
    <Ledger
      testID="billing-tutors"
      title={isAdmin ? 'Tutors' : 'Your pay'}
      caption={
        isAdmin
          ? 'What each tutor has earned, and what they have been paid.'
          : 'What you have earned, and what you have been paid. On the right, what is still owed to you; below zero, you were paid ahead.'
      }
      empty={isAdmin ? 'No tutors have taught or been paid yet.' : 'Nothing earned or paid yet.'}
    >
      {tutors.map((tutor) => (
        <LedgerRow
          key={tutor.user_id}
          testID={`billing-tutor-${tutor.user_id}`}
          balanceTestID={`billing-tutor-balance-${tutor.user_id}`}
          name={tutor.full_name}
          summary={tutorLedgerSummary(tutor)}
          balance={tutor.balance_cents}
          onPress={
            isAdmin && payable
              ? () =>
                  router.push({
                    pathname: '/payment-form',
                    params: { direction: 'to_tutor', party: tutor.user_id },
                  })
              : undefined
          }
        />
      ))}
    </Ledger>
  );
}

/** A family's payment: from the primary guardian (or the only one) for this student. */
export function familyPaymentParams(
  student: Pick<StudentBalance, 'guardians' | 'student_user_id'>,
): Record<string, string> {
  const payer =
    student.guardians.find((guardian) => guardian.is_primary) ??
    (student.guardians.length === 1 ? student.guardians[0] : undefined);
  return payer
    ? { direction: 'from_parent', party: payer.user_id, student: student.student_user_id }
    : { direction: 'from_parent' };
}

function openFamilyPayment(student: StudentBalance) {
  router.push({ pathname: '/payment-form', params: familyPaymentParams(student) });
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
      empty={isAdmin ? 'No family has been charged or has paid yet.' : 'Nothing charged or paid yet.'}
    >
      {students.map((student) => (
        <LedgerRow
          key={student.student_user_id}
          testID={`billing-family-${student.student_user_id}`}
          balanceTestID={`billing-family-balance-${student.student_user_id}`}
          name={student.student_name}
          summary={familyLedgerSummary(student)}
          balance={student.balance_cents}
          onPress={isAdmin ? () => openFamilyPayment(student) : undefined}
        />
      ))}
    </Ledger>
  );
}

/** A payment a family made to a tutor directly, from one row of the direct ledger. */
export function directPaymentParams(row: DirectBalance): Record<string, string> {
  return { ...familyPaymentParams(row), payee: row.tutor_user_id };
}

/**
 * Phase 54: each family's balance with each tutor, from lessons paid directly. The office and a tutor
 * may open a payment from a row (a tutor's rows are their own); a parent reads theirs.
 */
export function DirectLedger({
  rows,
  direct,
  mayRecord,
}: {
  rows: DirectBalance[];
  /** Paid directly now; otherwise these rows are from before the space had an organization. */
  direct: boolean;
  mayRecord: boolean;
}) {
  return (
    <Ledger
      testID="billing-direct"
      title={direct ? 'Families and tutors' : 'Paid directly'}
      caption="Each family pays the tutor of each lesson: one balance per family and tutor."
      empty="No lessons paid directly yet."
    >
      {rows.map((row) => {
        const key = `${row.student_user_id}-${row.tutor_user_id}`;
        return (
          <LedgerRow
            key={key}
            testID={`billing-direct-${key}`}
            balanceTestID={`billing-direct-balance-${key}`}
            name={row.student_name}
            summary={directLedgerSummary(row)}
            balance={row.balance_cents}
            onPress={
              mayRecord && direct
                ? () => router.push({ pathname: '/payment-form', params: directPaymentParams(row) })
                : undefined
            }
          />
        );
      })}
    </Ledger>
  );
}
