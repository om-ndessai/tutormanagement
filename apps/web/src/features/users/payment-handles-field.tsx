import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentHandle,
  type PaymentMethod,
} from '@tmi/shared';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Tutors are paid through these and parents are billed through them, which is
 * why they belong to the person rather than to either role's profile. At most
 * one id per method, matching the table's composite key.
 */
export function PaymentHandlesField({
  value,
  onChange,
  hint,
}: {
  value: PaymentHandle[];
  onChange: (handles: PaymentHandle[]) => void;
  hint: string;
}) {
  function setHandle(method: PaymentMethod, handle: string) {
    const rest = value.filter((entry) => entry.method !== method);
    const trimmed = handle.trim();

    onChange(trimmed ? [...rest, { method, handle: trimmed }] : rest);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Payment</span>
      <p className="text-muted-foreground -mt-1 text-xs">{hint}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_METHODS.map((method) => (
          <div key={method} className="grid gap-1.5">
            <Label htmlFor={`pay-${method}`} className="text-muted-foreground text-xs">
              {PAYMENT_METHOD_LABELS[method]}
            </Label>
            <Input
              id={`pay-${method}`}
              value={value.find((entry) => entry.method === method)?.handle ?? ''}
              onChange={(event) => setHandle(method, event.target.value)}
              placeholder={method === 'venmo' ? '@username' : 'Email or phone'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
