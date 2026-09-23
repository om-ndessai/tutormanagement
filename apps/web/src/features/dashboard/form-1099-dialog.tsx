import { useState } from 'react';
import { PrinterIcon } from 'lucide-react';
import { formatCents } from '@tmi/shared';

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
import { TEXTAREA } from '@/features/progress/assessment-dialog';

const INSTITUTE_NAME = 'Mathematics Institute of the Triangle';

/** "123-45-6789" from whatever the admin typed, or null if it is not nine digits. */
function normaliseSsn(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Produces a tutor's year-end 1099-NEC.
 *
 * The number is typed here and goes NOWHERE ELSE. The document is written in
 * the browser, from figures the portal already holds plus the digits in this
 * form, and handed straight to the print dialog: nothing is sent to the
 * server, so there is no request body, no log line and no row that could ever
 * carry it. Closing this dialog is the end of the number's life in the portal.
 *
 * What it prints is the recipient's copy and the payer's record. Copy A -- the
 * red scannable sheet the IRS keeps -- cannot be printed on a home printer by
 * anybody, and is filed electronically or on official stock.
 */
export function Form1099Dialog({
  open,
  onOpenChange,
  tutorName,
  year,
  amountCents,
  instituteTin,
  recipientAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutorName: string;
  year: number;
  amountCents: number;
  /** From the signed-in admin's record, so it is typed once and not per form. */
  instituteTin?: string | null;
  /** From the tutor's record (formatMailingAddress), editable for this print only. */
  recipientAddress?: string | null;
}) {
  const [ssn, setSsn] = useState('');
  // Prefilled from the tutor's profile. A change here is for this printout
  // only; the record is corrected on the tutor's page.
  const [address, setAddress] = useState(recipientAddress ?? '');
  // Prefilled from the admin's own record: the institute files under one
  // number all year, and retyping it on every form is how a digit goes wrong.
  const [payerTin, setPayerTin] = useState(instituteTin ?? '');

  const formatted = normaliseSsn(ssn);

  function close(next: boolean) {
    // Cleared on the way out, so a reopened dialog never shows the last
    // tutor's number.
    if (!next) {
      // The SSN is cleared; the institute's own number is not a secret from
      // the person who recorded it, and clearing it would just be retyping.
      setSsn('');
      setAddress(recipientAddress ?? '');
      setPayerTin(instituteTin ?? '');
    }
    onOpenChange(next);
  }

  function print() {
    if (!formatted) return;

    const sheet = window.open('', '_blank', 'width=900,height=1100');
    if (!sheet) return;

    sheet.document.write(documentHtml({
      tutorName,
      year,
      amountCents,
      ssn: formatted,
      address,
      payerTin,
    }));
    sheet.document.close();
    sheet.focus();
    sheet.print();

    // The window keeps the number only as long as it is open; the portal has
    // already forgotten it.
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {year} 1099-NEC for {tutorName}
          </DialogTitle>
          <DialogDescription>
            {formatCents(amountCents)} was paid to {tutorName} in {year}. Their Social Security
            number is needed to print the form.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ssn">Recipient’s SSN</Label>
            <Input
              id="ssn"
              inputMode="numeric"
              autoComplete="off"
              value={ssn}
              onChange={(event) => setSsn(event.target.value)}
              placeholder="123-45-6789"
            />
            {/* Said plainly, because an admin typing an SSN into a web form is
                entitled to know where it goes. */}
            <p className="text-muted-foreground text-xs">
              Typed here and used only to print this form.{' '}
              <span className="font-medium">
                It is never sent to the server, never saved, and is gone when this dialog
                closes.
              </span>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="addr">
              Recipient’s address{' '}
              <span className="text-muted-foreground">
                {recipientAddress ? '(from their record)' : '(optional)'}
              </span>
            </Label>
            <textarea
              id="addr"
              rows={3}
              className={TEXTAREA}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={'Street\nCity, State ZIP'}
            />
            <p className="text-muted-foreground text-xs">
              {recipientAddress
                ? 'A change here is for this printout only. Correct it on the tutor’s record to keep it.'
                : 'No address is on the tutor’s record. Add it there so next year’s form fills itself.'}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ein">
              Payer’s TIN{' '}
              {instituteTin ? (
                <span className="text-muted-foreground">(from your record)</span>
              ) : (
                <span className="text-muted-foreground">(optional)</span>
              )}
            </Label>
            <Input
              id="ein"
              value={payerTin}
              onChange={(event) => setPayerTin(event.target.value)}
              placeholder="The institute’s EIN"
            />
            {!instituteTin && (
              <p className="text-muted-foreground text-xs">
                Save it on your own record under Admin details and it will fill itself in
                next time.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={print} disabled={!formatted}>
            <PrinterIcon />
            {formatted ? 'Print 1099-NEC' : 'Enter nine digits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The printable sheet: plain HTML, written into a window that is never saved. */
function documentHtml({
  tutorName,
  year,
  amountCents,
  ssn,
  address,
  payerTin,
}: {
  tutorName: string;
  year: number;
  amountCents: number;
  ssn: string;
  address: string;
  payerTin: string;
}): string {
  const escape = (value: string) =>
    value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${year} Form 1099-NEC — ${escape(tutorName)}</title>
<style>
  body { font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 40px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #555; margin: 0 0 24px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
  th, td { border: 1px solid #999; padding: 8px 10px; vertical-align: top; text-align: left; }
  th { width: 38%; background: #f4f4f5; font-weight: 600; }
  .amount { font-size: 20px; font-weight: 700; }
  .note { color: #555; font-size: 11px; border-top: 1px solid #ddd; padding-top: 12px; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <h1>Form 1099-NEC — Nonemployee Compensation</h1>
  <p class="sub">Tax year ${year} · recipient copy and payer’s record</p>

  <table>
    <tr><th>Payer</th><td>${INSTITUTE_NAME}${payerTin ? `<br>TIN ${escape(payerTin)}` : ''}</td></tr>
    <tr><th>Recipient</th><td>${escape(tutorName)}${address.trim() ? `<br>${escape(address.trim()).replace(/\r?\n/g, '<br>')}` : ''}</td></tr>
    <tr><th>Recipient’s TIN</th><td>${escape(ssn)}</td></tr>
    <tr><th>Box 1 — Nonemployee compensation</th><td class="amount">${formatCents(amountCents)}</td></tr>
    <tr><th>Box 4 — Federal income tax withheld</th><td>$0.00</td></tr>
  </table>

  <p class="note">
    Box 1 is the total paid to this person by ${INSTITUTE_NAME} between 1 January and
    31 December ${year}, as recorded in the portal. Copy A is filed with the IRS
    electronically or on official scannable stock — it cannot be printed from this page.
    This sheet carries a Social Security number: treat it as you would the paper it
    replaces.
  </p>
</body></html>`;
}
