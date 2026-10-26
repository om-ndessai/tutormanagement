// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322 (Phase 54's space paid
// directly @ 24066d9, working tree: families pay each tutor, a tutor records what they received, the
// "Families and tutors" ledger, the year-end summary instead of the tax summary).
//
// Balances and the payment log on one screen, because the log is only meaningful as the
// explanation of the balances above it. Everything here is the server's, scoped to the reader:
// the office sees every tutor and family and the organization's totals; a tutor sees their own
// pay; a parent sees their children's balances and the family's payments.
import { useQueryClient } from '@tanstack/react-query';
import { paidDirectly } from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { SecureMoney } from '@/components/secure-money';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { orgYear } from '@/features/dashboard/finance-format';
import { ApiRequestError } from '@/lib/api-client';
import { downloadAndShare } from '@/lib/download';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { useBalances, usePayments } from './api';
import {
  BillingDirectTiles,
  BillingHeadlineTiles,
  DirectLedger,
  FamilyLedger,
  TutorLedger,
} from './billing-ledgers';
import { PaymentLog } from './payment-log';

function openRecord() {
  router.push('/payment-form');
}

export function BillingScreen() {
  const { user, organization } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const year = orgYear(useOrgTimeZone());
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes('admin');
  const isParent = roles.includes('parent');
  const isTutor = roles.includes('tutor');
  const isStudent = roles.includes('student');
  // Phase 54: families pay each tutor directly here; no organization in between.
  const direct = organization ? paidDirectly(organization) : false;
  const mayRecord = isAdmin || (direct && isTutor);

  const balances = useBalances();
  const payments = usePayments({ limit: 50 });
  const data = balances.data?.data;

  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<'payments' | 'tax' | 'direct' | null>(null);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['balances'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function download(which: 'payments' | 'tax' | 'direct') {
    setDownloading(which);
    try {
      haptics.impact();
      if (which === 'payments') await downloadAndShare('/payments/export.csv', 'payments.csv');
      // What each tutor was PAID in the year, and whether the office holds their SSN -- the two
      // things a year-end tax document needs. The number itself is in neither this file nor the
      // database it comes from.
      else if (which === 'tax')
        await downloadAndShare(`/payments/tax-summary.csv?year=${year}`, `tax-summary-${year}.csv`);
      // Phase 54: no 1099 for money families paid a tutor directly -- the tutor's own year-end
      // summary of it (every tutor's, for an admin).
      else await downloadAndShare(`/payments/direct-summary.csv?year=${year}`, `paid-directly-${year}.csv`);
    } catch (failure) {
      toast.error(failure instanceof ApiRequestError ? failure.message : 'Could not download the file.');
    } finally {
      setDownloading(null);
    }
  }

  const error = balances.error ?? payments.error;

  return (
    <Screen testID="screen-billing" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <SecureMoney tag="billing" />
      <Stack.Screen
        options={{
          title: 'Billing',
        }}
      />
      <PageIntro testID="billing-description">
        {direct
          ? 'Families pay each tutor directly. No money moves through the portal: this tracks what each family owes each tutor, and what has been paid.'
          : 'No money moves through the portal. This tracks what is owed and what has been paid.'}
      </PageIntro>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {mayRecord ? (
          <Button testID="billing-record" mode="contained" icon="plus" onPress={openRecord}>
            {direct && !isAdmin ? 'Record a payment you received' : 'Record a payment'}
          </Button>
        ) : null}
        <Button
          testID="billing-export"
          mode="outlined"
          icon="download"
          onPress={() => void download('payments')}
          loading={downloading === 'payments'}
          disabled={downloading !== null}
        >
          CSV
        </Button>
        {isAdmin && !direct ? (
          <Button
            testID="billing-tax-summary"
            mode="outlined"
            icon="download"
            onPress={() => void download('tax')}
            loading={downloading === 'tax'}
            disabled={downloading !== null}
          >
            Tax summary
          </Button>
        ) : null}
        {direct && (isAdmin || isTutor) ? (
          <Button
            testID="billing-year-end"
            mode="outlined"
            icon="download"
            onPress={() => void download('direct')}
            loading={downloading === 'direct'}
            disabled={downloading !== null}
          >
            Year-end summary
          </Button>
        ) : null}
      </View>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void balances.refetch();
            void payments.refetch();
          }}
        />
      ) : null}

      {isAdmin ? (
        direct ? (
          <BillingDirectTiles totals={data?.totals} />
        ) : (
          <BillingHeadlineTiles totals={data?.totals} />
        )
      ) : null}

      {balances.isPending ? <ListSkeleton label="Loading balances" count={2} height={120} /> : null}

      {/* Phase 54: each family's balance with each tutor -- the whole ledger in a space paid directly,
          and lessons from before a switch in one run by an organization. */}
      {data && (direct || data.direct.length > 0) ? (
        <DirectLedger rows={data.direct} direct={direct} mayRecord={mayRecord} />
      ) : null}

      {/* Each ledger shows for the roles it is about, and says so when it is empty (ux-audit F-28),
          rather than vanishing and leaving the reader to wonder. Paid directly, the organization's
          ledgers show only rows from before the switch (the web's `some(...)`). */}
      {data &&
      (direct
        ? data.tutors.some((t) => t.session_count > 0 || t.paid_cents > 0)
        : isAdmin || isTutor || data.tutors.length > 0) ? (
        <TutorLedger tutors={data.tutors} isAdmin={isAdmin} payable={!direct} />
      ) : null}

      {data &&
      (direct
        ? data.students.some((st) => st.session_count > 0 || st.paid_cents > 0)
        : isAdmin || isParent || isStudent || data.students.length > 0) ? (
        <FamilyLedger students={data.students} isAdmin={isAdmin} isParent={isParent} />
      ) : null}

      <PaymentLog
        payments={payments.data?.data ?? []}
        total={payments.data?.meta.total}
        isLoading={payments.isPending}
      />
    </Screen>
  );
}
