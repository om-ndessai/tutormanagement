// The money fields of the person form, from apps/web/src/features/users/user-form-dialog.tsx @
// 1132322: what a tutor is PAID (their default rates and the level their advance is kept above) and
// what a student's family is CHARGED. Two different numbers -- conflating them erases the margin --
// typed in dollars and converted to cents by the shared parseCentsInput on submit. Only an admin
// opens this form, and the amounts never reach a toast or the log.
//
// Phase 75 (docs/journey-fixes-plan.md JF18): an empty field LOOKS empty -- no realistic number as its placeholder,
// which read as a price already set -- and the example is the helper text ("For example 95.00"). A price stays
// optional; a lesson without one is refused at Start, and the record says "No price set".
import { View } from 'react-native';

import { space } from '@/theme/tokens';
import { FormTextField } from './form-text-field';
import type { FormState } from './person-form-model';

type Tutor = FormState['tutor'];
type Student = FormState['student'];

export function TutorPayRateFields({
  tutor,
  onChange,
  errors,
}: {
  tutor: Tutor;
  onChange: (tutor: Tutor) => void;
  errors: Record<string, string>;
}) {
  return (
    <View style={{ gap: space.md }}>
      {/* What the tutor is PAID. A per-student override on the pairing beats these. */}
      <FormTextField
        testID="person-tutor-rate-in-person"
        label="In-person rate / hr"
        hint="For example 75.00. Used unless a pairing overrides it."
        keyboardType="decimal-pad"
        value={tutor.rate_in_person}
        onChangeText={(rate_in_person) => onChange({ ...tutor, rate_in_person })}
        error={errors['tutor_profile.default_rate_in_person_cents']}
      />
      <FormTextField
        testID="person-tutor-rate-virtual"
        label="Virtual rate / hr"
        optional
        hint="For example 65.00."
        keyboardType="decimal-pad"
        value={tutor.rate_virtual}
        onChangeText={(rate_virtual) => onChange({ ...tutor, rate_virtual })}
        error={errors['tutor_profile.default_rate_virtual_cents']}
      />
    </View>
  );
}

/**
 * Most tutors are paid up front. This is the level their unworked balance is kept above, not a
 * payment: recording the payment itself is a separate act, on the billing page.
 */
export function TutorTopupField({
  tutor,
  onChange,
  errors,
}: {
  tutor: Tutor;
  onChange: (tutor: Tutor) => void;
  errors: Record<string, string>;
}) {
  return (
    <FormTextField
      testID="person-tutor-topup"
      label="Top up below"
      optional
      hint="For example 100.00. Blank means this tutor is paid for work already done, never in advance."
      keyboardType="decimal-pad"
      value={tutor.topup}
      onChangeText={(topup) => onChange({ ...tutor, topup })}
      error={errors['tutor_profile.topup_amount_cents']}
    />
  );
}

/** What the FAMILY is charged: priced on the student, whoever teaches them. */
export function StudentPriceFields({
  student,
  onChange,
  errors,
}: {
  student: Student;
  onChange: (student: Student) => void;
  errors: Record<string, string>;
}) {
  return (
    <View style={{ gap: space.md }}>
      <FormTextField
        testID="person-student-price-in-person"
        label="In-person price / hr"
        hint="For example 95.00. Charged to the family: a lesson in person cannot be started or recorded without it."
        keyboardType="decimal-pad"
        value={student.charge_in_person}
        onChangeText={(charge_in_person) => onChange({ ...student, charge_in_person })}
        error={errors['student_profile.charge_rate_in_person_cents']}
      />
      <FormTextField
        testID="person-student-price-virtual"
        label="Virtual price / hr"
        optional
        hint="For example 85.00. A virtual lesson cannot be started or recorded without it."
        keyboardType="decimal-pad"
        value={student.charge_virtual}
        onChangeText={(charge_virtual) => onChange({ ...student, charge_virtual })}
        error={errors['student_profile.charge_rate_virtual_cents']}
      />
    </View>
  );
}
