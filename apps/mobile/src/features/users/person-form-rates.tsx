// The money fields of the person form, from apps/web/src/features/users/user-form-dialog.tsx @
// 1132322: what a tutor is PAID (their default rates and the level their advance is kept above) and
// what a student's family is CHARGED. Two different numbers -- conflating them erases the margin --
// typed in dollars and converted to cents by the shared parseCentsInput on submit. Only an admin
// opens this form, and the amounts never reach a toast or the log.
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
        hint="Used unless an assignment overrides it."
        keyboardType="decimal-pad"
        value={tutor.rate_in_person}
        onChangeText={(rate_in_person) => onChange({ ...tutor, rate_in_person })}
        placeholder="75.00"
        error={errors['tutor_profile.default_rate_in_person_cents']}
      />
      <FormTextField
        testID="person-tutor-rate-virtual"
        label="Virtual rate / hr"
        optional
        keyboardType="decimal-pad"
        value={tutor.rate_virtual}
        onChangeText={(rate_virtual) => onChange({ ...tutor, rate_virtual })}
        placeholder="65.00"
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
      hint="Blank means this tutor is paid for work already done, never in advance."
      keyboardType="decimal-pad"
      value={tutor.topup}
      onChangeText={(topup) => onChange({ ...tutor, topup })}
      placeholder="100.00"
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
        hint="Charged to the family. A session cannot be recorded without it."
        keyboardType="decimal-pad"
        value={student.charge_in_person}
        onChangeText={(charge_in_person) => onChange({ ...student, charge_in_person })}
        placeholder="95.00"
        error={errors['student_profile.charge_rate_in_person_cents']}
      />
      <FormTextField
        testID="person-student-price-virtual"
        label="Virtual price / hr"
        optional
        keyboardType="decimal-pad"
        value={student.charge_virtual}
        onChangeText={(charge_virtual) => onChange({ ...student, charge_virtual })}
        placeholder="85.00"
        error={errors['student_profile.charge_rate_virtual_cents']}
      />
    </View>
  );
}
