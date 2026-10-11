import { useLocalSearchParams } from 'expo-router';

import { PaymentFormSheet, paymentPrefill } from '@/features/payments/payment-form-sheet';

/**
 * Record a payment, or correct one (`?id=<payment>`), as a form sheet. Admins only. A new one may
 * arrive prefilled from a ledger row (`?direction=&party=&student=`).
 */
export default function PaymentFormRoute() {
  const { id, direction, party, student } = useLocalSearchParams<{
    id?: string;
    direction?: string;
    party?: string;
    student?: string;
  }>();
  return <PaymentFormSheet paymentId={id} prefill={paymentPrefill({ direction, party, student })} />;
}
