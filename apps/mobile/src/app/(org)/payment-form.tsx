import { useLocalSearchParams } from 'expo-router';

import { PaymentFormSheet } from '@/features/payments/payment-form-sheet';

/** Record a payment, or correct one (`?id=<payment>`), as a form sheet. Admins only. */
export default function PaymentFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PaymentFormSheet paymentId={id} />;
}
