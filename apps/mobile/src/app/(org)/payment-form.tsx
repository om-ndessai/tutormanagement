import { useLocalSearchParams } from 'expo-router';

import { PaymentFormSheet, paymentPrefill } from '@/features/payments/payment-form-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Record a payment, or correct one (`?id=<payment>`), as a form sheet. Admins only. A new one may
 * arrive prefilled from a ledger row (`?direction=&party=&student=`).
 */
function PaymentFormRouteContent() {
  const { id, direction, party, student } = useLocalSearchParams<{
    id?: string;
    direction?: string;
    party?: string;
    student?: string;
  }>();
  return <PaymentFormSheet paymentId={id} prefill={paymentPrefill({ direction, party, student })} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function PaymentFormRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <PaymentFormRouteContent />
    </FeatureGate>
  );
}
