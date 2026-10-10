// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322.
//
// Balances and the payment log on one screen, because the log is only meaningful as the
// explanation of the balances above it. Everything here is the server's, scoped to the reader:
// the office sees every tutor and family and the organization's totals; a tutor sees their own
// pay; a parent sees their children's balances and the family's payments.
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { PageIntro } from '@/components/page-intro';
import { IconButton } from '@/components/icon-button';
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
import { BillingHeadlineTiles, FamilyLedger, TutorLedger } from './billing-ledgers';
import { PaymentLog } from './payment-log';

function openRecord() {
  router.push('/payment-form');
}

export function BillingScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const year = orgYear(useOrgTimeZone());
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes('admin');
  const isParent = roles.includes('parent');
  const isTutor = roles.includes('tutor');
  const isStudent = roles.includes('student');

  const balances = useBalances();
  const payments = usePayments({ limit: 50 });
  const data = balances.data?.data;

  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<'payments' | 'tax' | null>(null);

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

  async function download(which: 'payments' | 'tax') {
    setDownloading(which);
    try {
      haptics.impact();
      if (which === 'payments') await downloadAndShare('/payments/export.csv', 'payments.csv');
      // What each tutor was PAID in the year, and whether the office holds their SSN -- the two
      // things a year-end tax document needs. The number itself is in neither this file nor the
      // database it comes from.
      else await downloadAndShare(`/payments/tax-summary.csv?year=${year}`, `tax-summary-${year}.csv`);
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
          headerRight: isAdmin
            ? () => (
                <IconButton
                  testID="billing-add"
                  icon="plus"
                  size={24}
                  accessibilityLabel="Record a payment"
                  style={{ margin: 0 }}
                  onPress={openRecord}
                />
              )
            : undefined,
        }}
      />
      <PageIntro testID="billing-description">
        No money moves through the portal. This tracks what is owed and what has been paid.
      </PageIntro>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {isAdmin ? (
          <Button testID="billing-record" mode="contained" icon="plus" onPress={openRecord}>
            Record a payment
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
        {isAdmin ? (
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

      {isAdmin ? <BillingHeadlineTiles totals={data?.totals} /> : null}

      {balances.isPending ? <ListSkeleton label="Loading balances" count={2} height={120} /> : null}

      {/* Each ledger shows for the roles it is about, and says so when it is empty (ux-audit F-28),
          rather than vanishing and leaving the reader to wonder. */}
      {data && (isAdmin || isTutor || data.tutors.length > 0) ? (
        <TutorLedger tutors={data.tutors} isAdmin={isAdmin} />
      ) : null}

      {data && (isAdmin || isParent || isStudent || data.students.length > 0) ? (
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
