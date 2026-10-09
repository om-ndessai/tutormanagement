// The money on a person's record, from apps/web/src/features/users/user-detail-view.tsx @ 1132322:
// a tutor's pay rates and advance level, a student's price. The only file in the record that formats
// an amount (scripts/check-mobile-rules.mjs), and it renders only what the server sent:
//   - pay rates (R5): the caller renders them only for an admin or the tutor themselves, and
//     `scopeTutorPay` has blanked them for anyone else;
//   - the advance level (R6): shown only when present -- `scopeTutorTopup` blanks it;
//   - a student's price (R4): shown only when present -- `scopeStudentCharges` sends it to an admin
//     and the student's own family, never to a tutor, who would learn the margin.
import { formatCents, type StudentProfile, type TutorProfile } from '@tmi/shared';

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

export function StudentPrices({ student }: { student: StudentProfile }) {
  return (
    <>
      {student.charge_rate_in_person_cents != null ? (
        <Detail testID="person-price-in-person" icon="wallet-outline" label="In-person price">
          {`${formatCents(student.charge_rate_in_person_cents)} / hr`}
        </Detail>
      ) : null}
      {student.charge_rate_virtual_cents != null ? (
        <Detail testID="person-price-virtual" icon="wallet-outline" label="Virtual price">
          {`${formatCents(student.charge_rate_virtual_cents)} / hr`}
        </Detail>
      ) : null}
    </>
  );
}
