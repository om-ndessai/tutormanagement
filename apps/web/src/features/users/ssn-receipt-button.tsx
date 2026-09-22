import { toast } from 'sonner';
import { ShieldCheckIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api-client';
import { useSsnReceipt } from './api';

/**
 * Records that the office now holds a tutor's SSN.
 *
 * Lives in its own file because the admin meets this question in three
 * places -- the tutor's record, the chase list on the dashboard, and the
 * year-end documents -- and having to go and find the record from the other
 * two is what made the feature impossible to use.
 *
 * There is no field here, and never will be: the button records the FACT, and
 * the number is collected outside the portal.
 */
export function SsnReceiptButton({
  userId,
  fullName,
  received,
  size = 'sm',
  variant,
}: {
  userId: string;
  fullName: string;
  /** True when the office already holds it; the button then withdraws that. */
  received: boolean;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'ghost';
}) {
  const receipt = useSsnReceipt();

  async function set() {
    try {
      await receipt.mutateAsync({ userId, received: !received });
      toast.success(
        received
          ? `Withdrew the confirmation for ${fullName}.`
          : `Recorded that we have ${fullName}'s SSN.`,
      );
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not record that.');
    }
  }

  return (
    <Button
      size={size}
      variant={variant ?? (received ? 'ghost' : 'default')}
      className={size === 'sm' ? 'h-7 px-2 text-xs' : undefined}
      disabled={receipt.isPending}
      onClick={set}
    >
      {!received && <ShieldCheckIcon />}
      {received ? 'Withdraw' : 'Mark SSN received'}
    </Button>
  );
}
