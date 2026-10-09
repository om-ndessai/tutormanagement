// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322 -- the Payments list (the
// phone's stacked cards) and the delete AlertDialog, as a native confirmation. The office may open
// a payment to correct it and delete it; everybody else reads the payments the server scoped to
// them (the party, or one of their children).
import { PAYMENT_FORM_LABELS, formatCents, type Payment } from '@tmi/shared';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { Divider, IconButton, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { formatPaidOn, orgToday } from '@/features/dashboard/finance-format';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useDeletePayment } from './api';
import { paymentDirectionText } from './payment-format';

function openEdit(payment: Payment) {
  router.push({ pathname: '/payment-form', params: { id: payment.id } });
}

function useConfirmDeletePayment() {
  const toast = useToast();
  const remove = useDeletePayment();

  return (payment: Payment) => {
    haptics.warning();
    Alert.alert(
      'Delete this payment?',
      `The ${formatCents(payment.amount_cents)} record involving ${payment.party_name} will be removed and the balances will change accordingly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(payment.id, {
              onSuccess: () => {
                haptics.success();
                toast.success('Payment deleted.');
              },
              onError: (error) => {
                haptics.error();
                toast.error(
                  error instanceof ApiRequestError ? error.message : 'Could not delete the payment.',
                );
              },
            }),
        },
      ],
    );
  };
}

export function PaymentLog({
  payments,
  total,
  isLoading,
}: {
  payments: Payment[];
  total: number | undefined;
  isLoading: boolean;
}) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const timeZone = useOrgTimeZone();
  const today = orgToday(timeZone);
  const confirmDelete = useConfirmDeletePayment();
  const muted = theme.tokens.mutedForeground;

  return (
    <Panel testID="billing-payments" title="Payments">
      {isLoading ? (
        <View
          style={{ gap: space.sm }}
          accessibilityLabel="Loading payments"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="100%" height={44} />
          ))}
        </View>
      ) : null}
      {!isLoading && payments.length === 0 ? (
        <EmptyNote testID="billing-payments-empty">No payments recorded yet.</EmptyNote>
      ) : null}
      {payments.map((payment, index) => {
        const direction = paymentDirectionText(payment, user?.id, isAdmin);
        const row = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
                {payment.party_name}
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={{ color: muted }}>
                {direction}
                {payment.student_name ? ` · for ${payment.student_name}` : ''}
              </Text>
              <Text variant="bodySmall" style={{ color: muted }}>
                {formatPaidOn(payment.paid_at, timeZone, today, true)} · {PAYMENT_FORM_LABELS[payment.method]}
              </Text>
            </View>
            <Text
              testID={`billing-payment-amount-${payment.id}`}
              variant="bodyMedium"
              style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}
            >
              {formatCents(payment.amount_cents)}
            </Text>
          </View>
        );
        return (
          <View key={payment.id}>
            {index > 0 ? <Divider /> : null}
            {isAdmin ? (
              <View
                testID={`billing-payment-${payment.id}`}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                {/* Not one accessible element: that would hide its lines from VoiceOver (and the
                    flows). The pencil is the labelled way in; the row is a bigger target for it. */}
                <Pressable
                  accessible={false}
                  onPress={() => openEdit(payment)}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}
                >
                  {row}
                </Pressable>
                <IconButton
                  testID={`billing-payment-edit-${payment.id}`}
                  icon="pencil-outline"
                  accessibilityLabel={`Edit the payment involving ${payment.party_name}`}
                  onPress={() => openEdit(payment)}
                  style={{ margin: 0 }}
                />
                <IconButton
                  testID={`billing-payment-delete-${payment.id}`}
                  icon="trash-can-outline"
                  accessibilityLabel={`Delete the payment involving ${payment.party_name}`}
                  onPress={() => confirmDelete(payment)}
                  style={{ margin: 0 }}
                />
              </View>
            ) : (
              <View testID={`billing-payment-${payment.id}`}>{row}</View>
            )}
          </View>
        );
      })}
      {total !== undefined && total > payments.length ? (
        <Text
          testID="billing-payments-footer"
          variant="bodySmall"
          style={{ color: muted, marginTop: space.sm }}
        >
          Latest {payments.length} of {total}. The CSV has them all.
        </Text>
      ) : null}
    </Panel>
  );
}
