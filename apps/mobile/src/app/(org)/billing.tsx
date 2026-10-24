import { BillingScreen } from '@/features/payments/billing-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Balances, the payment log and the CSV exports; the office also records payments here. */
function BillingRouteContent() {
  return <BillingScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function BillingRoute() {
  return (
    <FeatureGate set="tutoring">
      <BillingRouteContent />
    </FeatureGate>
  );
}
