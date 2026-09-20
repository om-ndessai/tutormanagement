import { useEffect, useMemo, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_FORMS,
  PAYMENT_FORM_LABELS,
  parseCentsInput,
  type PaymentDirection,
  type PaymentForm,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserDetail, useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { useRecordPayment } from './api';

/** `datetime-local` wants "YYYY-MM-DDTHH:MM" in local time. */
function nowLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Records money that moved outside the portal.
 *
 * The direction drives the whole form: money from a family must name a
 * student, because charges attach to students and that is what the balance is
 * computed against. Money to a tutor does not.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  defaultDirection = 'from_parent',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection?: PaymentDirection;
}) {
  const [direction, setDirection] = useState<PaymentDirection>(defaultDirection);
  const [partyId, setPartyId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentForm>('zelle');
  const [paidAt, setPaidAt] = useState(nowLocal);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parents = useUsers({ role: 'parent', limit: 100, sort: 'full_name' });
  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' });
  // A parent's own children are the only students their payment can be for.
  const payer = useUserDetail(direction === 'from_parent' && partyId ? partyId : null);

  const record = useRecordPayment();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDirection(defaultDirection);
    setPartyId('');
    setStudentId('');
    setAmount('');
    setMethod('zelle');
    setPaidAt(nowLocal());
    setReference('');
    setNotes('');
  }, [open, defaultDirection]);

  const parties = direction === 'from_parent' ? parents : tutors;

  const children = useMemo(() => payer.data?.data.dependents ?? [], [payer.data]);

  // With exactly one child there is nothing to choose.
  useEffect(() => {
    if (children.length === 1) setStudentId(children[0]!.user_id);
  }, [children]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const cents = parseCentsInput(amount);
    const problems: Record<string, string> = {};

    if (!partyId) problems.party_user_id = 'Choose a person.';
    if (cents == null || cents <= 0) problems.amount_cents = 'Enter an amount.';
    if (direction === 'from_parent' && !studentId) {
      problems.student_user_id = 'Choose which student this is for.';
    }

    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }

    try {
      await record.mutateAsync({
        direction,
        party_user_id: partyId,
        student_user_id: direction === 'from_parent' ? studentId : null,
        amount_cents: cents!,
        method,
        // Sent as an instant so ordering is unambiguous across timezones.
        paid_at: new Date(paidAt).toISOString(),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      } as never);

      toast.success('Payment recorded.');
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not record the payment.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              No money moves through the portal. This is a record of a payment made elsewhere.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Direction</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAYMENT_DIRECTIONS.map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                      direction === value ? 'border-primary bg-accent/50' : 'hover:bg-accent/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="direction"
                      checked={direction === value}
                      onChange={() => {
                        setDirection(value);
                        setPartyId('');
                        setStudentId('');
                      }}
                      className="accent-primary size-4"
                    />
                    {PAYMENT_DIRECTION_LABELS[value]}
                  </label>
                ))}
              </div>
            </div>

            <Field
              id="party"
              label={direction === 'from_parent' ? 'Parent' : 'Tutor'}
              error={errors.party_user_id}
            >
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger id="party" className="w-full">
                  <SelectValue placeholder={`Choose a ${direction === 'from_parent' ? 'parent' : 'tutor'}`} />
                </SelectTrigger>
                <SelectContent>
                  {(parties.data?.data ?? []).map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {direction === 'from_parent' && (
              <Field id="student" label="For which student" error={errors.student_user_id}>
                <Select value={studentId} onValueChange={setStudentId} disabled={!partyId}>
                  <SelectTrigger id="student" className="w-full">
                    <SelectValue
                      placeholder={partyId ? 'Choose a student' : 'Choose a parent first'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.user_id} value={child.user_id}>
                        {child.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {partyId && children.length === 0 && !payer.isPending && (
                  <p className="text-muted-foreground text-xs">
                    This parent has no students assigned to them.
                  </p>
                )}
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="amount" label="Amount" error={errors.amount_cents}>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="75.00"
                  aria-invalid={Boolean(errors.amount_cents)}
                />
              </Field>

              <Field id="method" label="Paid by" error={errors.method}>
                <Select value={method} onValueChange={(value) => setMethod(value as PaymentForm)}>
                  <SelectTrigger id="method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_FORMS.map((form) => (
                      <SelectItem key={form} value={form}>
                        {PAYMENT_FORM_LABELS[form]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="paid_at" label="When" error={errors.paid_at}>
                <Input
                  id="paid_at"
                  type="datetime-local"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                />
              </Field>

              <Field
                id="reference"
                label="Reference"
                optional
                hint={method === 'check' ? 'Check number.' : undefined}
              >
                <Input
                  id="reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={method === 'check' ? '1042' : 'Confirmation'}
                />
              </Field>
            </div>

            <Field id="pnotes" label="Notes" optional>
              <Input
                id="pnotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="September, first half"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={record.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending && <Loader2Icon className="animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className={error ? 'text-destructive' : undefined}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">(optional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
