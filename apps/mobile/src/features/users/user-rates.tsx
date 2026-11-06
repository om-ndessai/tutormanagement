// The money on a person's record, from apps/web/src/features/users/user-detail-view.tsx @ 1132322:
// a tutor's pay rates and advance level, a student's price. The only file in the record that formats
// an amount (scripts/check-mobile-rules.mjs), and it renders only what the server sent:
//   - pay rates (R5): the caller renders them only for an admin or the tutor themselves, and
//     `scopeTutorPay` has blanked them for anyone else;
//   - the advance level (R6): shown only when present -- `scopeTutorTopup` blanks it;
//   - a student's price (R4): shown only when present -- `scopeStudentCharges` sends it to an admin
//     and the student's own family, never to a tutor, who would learn the margin.
//   - Phase 75 (JF18, R34): a price the office has NOT set reads "No price set" -- per mode when only one is missing --
//     from the server's `price_missing` (never an amount), so a tutor too can tell "not set" from "not yours to see".
import {
  formatCents,
  type SessionMode,
  type StudentProfileView,
  type TutorProfile,
} from '@tmi/shared';

import { Detail, Muted } from './detail-row';

export function TutorPayRates({ tutor }: { tutor: TutorProfile }) {
  return (
    <>
      <Detail testID="person-pay-in-person" icon="wallet-outline" label="In-person pay rate">
        {tutor.default_rate_in_person_cents != null ? (
          `${formatCents(tutor.default_rate_in_person_cents)} / hr`
        ) : (
          <Muted>Not set</Muted>
        )}
      </Detail>
      <Detail testID="person-pay-virtual" icon="wallet-outline" label="Virtual pay rate">
        {tutor.default_rate_virtual_cents != null ? (
          `${formatCents(tutor.default_rate_virtual_cents)} / hr`
        ) : (
          <Muted>Not set</Muted>
        )}
      </Detail>
    </>
  );
}

/** What the office advances this tutor: not the business of the families they teach. */
export function TutorTopup({ tutor }: { tutor: TutorProfile }) {
  if (tutor.topup_amount_cents == null) return null;
  return (
    <Detail testID="person-topup" icon="piggy-bank-outline" label="Top up below">
      {`${formatCents(tutor.topup_amount_cents)} advance`}
    </Detail>
  );
}

export const NO_PRICE_SET = 'No price set';

/** Which price rows a record shows: each mode's amount, its "No price set", or nothing (not the reader's to see). */
export function priceRows(
  student: Pick<StudentProfileView, 'charge_rate_in_person_cents' | 'charge_rate_virtual_cents' | 'price_missing'>,
): { mode: SessionMode | 'both'; cents: number | null }[] {
  const missing = student.price_missing ?? [];
  if (missing.includes('in_person') && missing.includes('virtual')) return [{ mode: 'both', cents: null }];
  const rows: { mode: SessionMode | 'both'; cents: number | null }[] = [];
  const add = (mode: SessionMode, cents: number | null) => {
    if (cents != null) rows.push({ mode, cents });
    else if (missing.includes(mode)) rows.push({ mode, cents: null });
  };
  add('in_person', student.charge_rate_in_person_cents);
  add('virtual', student.charge_rate_virtual_cents);
  return rows;
}

const PRICE_LABEL: Record<SessionMode | 'both', string> = {
  in_person: 'In-person price',
  virtual: 'Virtual price',
  both: 'Price',
};

const PRICE_TEST_ID: Record<SessionMode | 'both', string> = {
  in_person: 'person-price-in-person',
  virtual: 'person-price-virtual',
  both: 'person-price-missing',
};

export function StudentPrices({ student }: { student: StudentProfileView }) {
  return (
    <>
      {priceRows(student).map((row) => (
        <Detail
          key={row.mode}
          testID={PRICE_TEST_ID[row.mode]}
          icon="wallet-outline"
          label={PRICE_LABEL[row.mode]}
        >
          {row.cents != null ? `${formatCents(row.cents)} / hr` : <Muted>{NO_PRICE_SET}</Muted>}
        </Detail>
      ))}
    </>
  );
}
