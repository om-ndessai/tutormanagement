// Ported from apps/web/src/features/dashboard/form-1099-dialog.tsx @ 1132322 (normaliseSsn and
// documentHtml), as a pure module so it can be tested without a device.
//
// The printable 1099-NEC, written ON THE DEVICE from figures the portal already holds plus what the
// admin typed into the sheet. The result is handed straight to Print.printAsync({ html }) and never
// to anything else: no request, no file, no log. The colours below are print styling inside a CSS
// string, not app colours (those come from the theme).
import { formatCents, formatMailingAddress, type OrganizationSettings } from '@tmi/shared';

/** "123-45-6789" from whatever the admin typed, or null if it is not nine digits. */
export function normaliseSsn(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** The organization's payer address as lines, for the payer box. */
export function formatPayerAddress(
  settings: Pick<
    OrganizationSettings,
    'payer_address_line1' | 'payer_address_line2' | 'payer_city' | 'payer_state' | 'payer_postal_code'
  > | null,
): string | null {
  if (!settings) return null;
  return formatMailingAddress({
    address_line1: settings.payer_address_line1,
    address_line2: settings.payer_address_line2,
    city: settings.payer_city,
    state: settings.payer_state,
    postal_code: settings.payer_postal_code,
  });
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

/** Escaped, with its line breaks kept. */
function lines(value: string): string {
  return escapeHtml(value.trim()).replace(/\r?\n/g, '<br>');
}

export interface Form1099Input {
  payerName: string;
  payerTin: string;
  payerAddress: string;
  tutorName: string;
  address: string;
  year: number;
  amountCents: number;
  /** Already normalised ("123-45-6789"). */
  ssn: string;
}

/**
 * The printable sheet. Its <title> is generic -- it becomes the print job's name on some
 * printers and spoolers -- so neither the person nor the number appears outside the page itself.
 */
export function buildForm1099Html({
  payerName,
  payerTin,
  payerAddress,
  tutorName,
  address,
  year,
  amountCents,
  ssn,
}: Form1099Input): string {
  const payer =
    escapeHtml(payerName) +
    (payerAddress.trim() ? `<br>${lines(payerAddress)}` : '') +
    (payerTin.trim() ? `<br>TIN ${escapeHtml(payerTin.trim())}` : '');
  const recipient = escapeHtml(tutorName) + (address.trim() ? `<br>${lines(address)}` : '');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Form 1099-NEC</title>
<style>
  body { font: 13px/1.5 -apple-system, system-ui, Roboto, sans-serif; margin: 40px; color: #111; }
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
    <tr><th>Payer</th><td>${payer}</td></tr>
    <tr><th>Recipient</th><td>${recipient}</td></tr>
    <tr><th>Recipient’s TIN</th><td>${escapeHtml(ssn)}</td></tr>
    <tr><th>Box 1 — Nonemployee compensation</th><td class="amount">${escapeHtml(formatCents(amountCents))}</td></tr>
    <tr><th>Box 4 — Federal income tax withheld</th><td>$0.00</td></tr>
  </table>

  <p class="note">
    Box 1 is the total paid to this person by ${escapeHtml(payerName)} between 1 January and
    31 December ${year}, as recorded in the portal. Copy A is filed with the IRS
    electronically or on official scannable stock — it cannot be printed from this page.
    This sheet carries a Social Security number: treat it as you would the paper it
    replaces.
  </p>
</body></html>`;
}
