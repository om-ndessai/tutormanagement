// Ported from apps/web/src/features/users/ssn-receipt-button.tsx @ 1132322
import { Button } from 'react-native-paper';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useSsnReceipt } from './api';

/**
 * Records that the office now holds a tutor's SSN.
 *
 * Lives in its own file because the admin meets this question in three places -- the tutor's
 * record, the chase list on the dashboard, and the year-end documents -- and having to go and
 * find the record from the other two is what made the feature impossible to use.
 *
 * There is no field here, and never will be: the button records the FACT, and the number is
 * collected outside the portal.
 */
export function SsnReceiptButton({
  userId,
  fullName,
  received,
  mode,
  testID,
}: {
  userId: string;
  fullName: string;
  /** True when the office already holds it; the button then withdraws that. */
  received: boolean;
  mode?: 'contained' | 'outlined' | 'text' | 'contained-tonal';
  testID?: string;
}) {
  const receipt = useSsnReceipt();
  const toast = useToast();

  async function set() {
    try {
      await receipt.mutateAsync({ userId, received: !received });
      toast.success(
        received ? `Withdrew the confirmation for ${fullName}.` : `Recorded that we have ${fullName}'s SSN.`,
      );
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not record that.');
    }
  }

  return (
    <Button
      testID={testID ?? `ssn-receipt-${userId}`}
      compact
      mode={mode ?? (received ? 'text' : 'contained-tonal')}
      icon={received ? undefined : 'shield-check-outline'}
      disabled={receipt.isPending}
      loading={receipt.isPending}
      accessibilityLabel={
        received ? `Withdraw the SSN confirmation for ${fullName}` : `Mark ${fullName}'s SSN received`
      }
      onPress={() => void set()}
    >
      {received ? 'Withdraw' : 'Mark SSN received'}
    </Button>
  );
}
