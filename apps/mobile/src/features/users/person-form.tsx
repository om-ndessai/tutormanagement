// Ported from apps/web/src/features/users/user-form-dialog.tsx @ 1132322.
//
// One form for both create and edit: one person, one record, every role they hold. The blocks
// follow the roles, and a caller may show only some of them (`sections`, for the welcome wizard);
// hidden blocks keep their values, because the request is always built from the whole form.
// Validation is the shared schema's, run here first so an SSN in a note never leaves the phone.
import {
  USER_STATUSES,
  USER_STATUS_LABELS,
  createUserRequestSchema,
  requiresEmail,
  updateUserRequestSchema,
  type UserDetail,
  type UserRole,
} from '@tmi/shared';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Divider, Icon, Text } from 'react-native-paper';

import { DismissKeyboard } from '@/components/dismiss-keyboard';
import { Choice } from '@/components/form-choice';
import { useToast } from '@/components/toast';
import { useStudentProgress } from '@/features/progress/api';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCreateUser, useUpdateUser } from './api';
import { AvailabilityPicker } from './availability-picker';
import { FormTextField } from './form-text-field';
import { GuardianPicker } from './guardian-picker';
import { PaymentHandlesField } from './payment-handles-field';
import {
  EMPTY,
  fromDetail,
  handlesHint,
  todayIso,
  toRequest,
  type FormState,
  type GuardianValue,
  type UserFormSection,
} from './person-form-model';
import { StudentPriceFields, TutorPayRateFields, TutorTopupField } from './person-form-rates';
import { RoleSelector } from './role-selector';
import { SessionLimitField } from './session-limit-field';

const DEFAULT_DESCRIPTION =
  'One person, one record. Check every role they hold — the rest of the form follows.';

export function PersonForm({
  detail,
  preset,
  sections,
  title,
  description,
  onSaved,
  onCancel,
}: {
  /** The record being edited; absent to add someone. */
  detail?: UserDetail;
  /** A new person's roles and guardians, chosen already. Create mode only. */
  preset?: { roles: UserRole[]; guardians?: GuardianValue[] };
  /** Show only these blocks; every block when absent. */
  sections?: UserFormSection[];
  title?: string;
  description?: string;
  /** Called with the saved record. */
  onSaved: (user: UserDetail) => void;
  onCancel: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const isEdit = Boolean(detail);
  const sharedLocked = Boolean(detail?.shared_fields_locked);
  // A student's goal is also their active learning plan's goal, kept in step by the API.
  const isStudentRecord = detail?.roles.includes('student') ?? false;
  const { data: progress } = useStudentProgress(isStudentRecord ? detail?.id : undefined);
  const activePlan = progress?.data.plan ?? null;

  const [form, setForm] = useState<FormState>(() =>
    detail
      ? fromDetail(detail)
      : { ...EMPTY, roles: preset?.roles ?? [], guardians: preset?.guardians ?? [] },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const saving = createUser.isPending || updateUser.isPending;

  const show = (section: UserFormSection) => !sections || sections.includes(section);
  const anyTutorBlock = show('tutor-background') || show('tutor-financials') || show('tutor-availability');
  const isTutor = form.roles.includes('tutor');
  const isStudent = form.roles.includes('student');
  const isParent = form.roles.includes('parent');
  // Everyone but a student-only person signs in, and sign-in needs an address.
  const emailRequired = requiresEmail(form.roles);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const { [key as string]: _removed, ...rest } = previous;
      return rest;
    });
  };
  const setTutor = (tutor: FormState['tutor']) => set('tutor', tutor);
  const setStudent = (student: FormState['student']) => set('student', student);

  async function handleSave() {
    setFormError(null);
    const request = toRequest(form, todayIso(timeZone));
    const schema = isEdit ? updateUserRequestSchema : createUserRequestSchema;
    const parsed = schema.safeParse(request);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      haptics.error();
      return;
    }

    try {
      const saved = detail
        ? await updateUser.mutateAsync({ id: detail.id, input: parsed.data as never })
        : await createUser.mutateAsync(parsed.data as never);
      toast.success(`${form.full_name.trim()} ${isEdit ? 'updated' : 'added'}.`);
      onSaved(saved.data);
    } catch (error) {
      haptics.error();
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
        toast.error(error.message);
        return;
      }
      setFormError('Could not save the user.');
      toast.error('Could not save the user.');
    }
  }

  // A sheet covers the app's toasts, and on a phone the field at fault is usually off-screen when
  // Save is pressed (the web lists them only for a scoped form, which can fail on a field it does
  // not show): every message is said here too, beside the button.
  const footErrors = [...(formError ? [formError] : []), ...Object.values(errors)].filter(
    (message, index, all) => all.indexOf(message) === index,
  );

  return (
    <DismissKeyboard style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text testID="person-form-title" variant="titleLarge" accessibilityRole="header">
          {title ?? (isEdit ? 'Edit user' : 'Add user')}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {description ?? DEFAULT_DESCRIPTION}
        </Text>
      </View>

      {show('identity') ? (
        <View style={{ gap: space.md }}>
          {/* Someone who belongs to another organization too shares their name, email and phone
              with it; only the platform changes those. */}
          {sharedLocked ? (
            <Text
              testID="person-form-locked"
              variant="bodySmall"
              style={{
                color: muted,
                backgroundColor: theme.tokens.muted,
                borderRadius: radius.md,
                padding: space.md,
              }}
            >
              This person belongs to another organization too, so their name, email and phone are shared. A
              platform administrator changes them.
            </Text>
          ) : null}
          <FormTextField
            testID="person-form-name"
            label="Full name"
            disabled={sharedLocked}
            value={form.full_name}
            onChangeText={(value) => set('full_name', value)}
            placeholder="Alex Chen"
            autoCapitalize="words"
            error={errors.full_name}
          />
          {/* Optional only for a student who holds no other role: they never sign in. */}
          <FormTextField
            testID="person-form-email"
            label="Email"
            optional={!emailRequired}
            hint={
              emailRequired
                ? 'They sign in with this Google address.'
                : 'Leave blank if this child has no address of their own.'
            }
            disabled={sharedLocked}
            value={form.email}
            onChangeText={(value) => set('email', value)}
            placeholder={emailRequired ? 'alex@gmail.com' : 'No email'}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <FormTextField
            testID="person-form-phone"
            label="Phone"
            optional
            disabled={sharedLocked}
            value={form.phone}
            onChangeText={(value) => set('phone', value)}
            placeholder="(919) 555-0142"
            keyboardType="phone-pad"
            error={errors.phone}
          />
          <View style={{ gap: space.xs }}>
            <Text variant="bodyMedium" style={{ color: muted }}>
              Status
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {USER_STATUSES.map((status) => (
                <Choice
                  key={status}
                  testID={`person-status-${status}`}
                  label={USER_STATUS_LABELS[status]}
                  selected={form.status === status}
                  onPress={() => set('status', status)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {show('roles') ? (
        <>
          <Divider />
          <RoleSelector value={form.roles} onChange={(roles) => set('roles', roles)} error={errors.roles} />
        </>
      ) : null}

      {isTutor && anyTutorBlock ? (
        <Block title="Tutor details">
          {show('tutor-background') ? (
            <>
              <FormTextField
                testID="person-tutor-education"
                label="Highest education"
                hint="Or their current grade / math course."
                value={form.tutor.highest_education}
                onChangeText={(value) => setTutor({ ...form.tutor, highest_education: value })}
                placeholder="MS, Applied Mathematics"
                error={errors['tutor_profile.highest_education']}
              />
              <FormTextField
                testID="person-tutor-school"
                label="School"
                value={form.tutor.school}
                onChangeText={(value) => setTutor({ ...form.tutor, school: value })}
                placeholder="NC State"
                error={errors['tutor_profile.school']}
              />
              <FormTextField
                testID="person-tutor-area"
                label="Area"
                hint="The neighbourhood, for matching families."
                value={form.tutor.area}
                onChangeText={(value) => setTutor({ ...form.tutor, area: value })}
                placeholder="Carrboro"
                error={errors['tutor_profile.area']}
              />
            </>
          ) : null}
          {show('tutor-availability') ? (
            <FormTextField
              testID="person-tutor-notes"
              label="Availability notes"
              optional
              value={form.tutor.availability_notes}
              onChangeText={(value) => setTutor({ ...form.tutor, availability_notes: value })}
              placeholder="Term-time only"
              error={errors['tutor_profile.availability_notes']}
            />
          ) : null}

          {/* The recipient's address on their 1099-NEC. Only the office and the tutor read it. */}
          {show('tutor-financials') ? (
            <>
              <FormTextField
                testID="person-tutor-address1"
                label="Mailing address"
                optional
                hint="Printed on their 1099. Seen only by the office and the tutor."
                autoComplete="off"
                value={form.tutor.address_line1}
                onChangeText={(value) => setTutor({ ...form.tutor, address_line1: value })}
                placeholder="120 Maple Street"
                error={errors['tutor_profile.address_line1']}
              />
              <FormTextField
                testID="person-tutor-address2"
                label="Address line 2"
                optional
                autoComplete="off"
                value={form.tutor.address_line2}
                onChangeText={(value) => setTutor({ ...form.tutor, address_line2: value })}
                placeholder="Apt 4"
                error={errors['tutor_profile.address_line2']}
              />
              <FormTextField
                testID="person-tutor-city"
                label="City"
                optional
                autoComplete="off"
                value={form.tutor.city}
                onChangeText={(value) => setTutor({ ...form.tutor, city: value })}
                placeholder="Cary"
                error={errors['tutor_profile.city']}
              />
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <FormTextField
                    testID="person-tutor-state"
                    label="State"
                    optional
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={2}
                    value={form.tutor.state}
                    onChangeText={(value) => setTutor({ ...form.tutor, state: value.toUpperCase() })}
                    placeholder="NC"
                    error={errors['tutor_profile.state']}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormTextField
                    testID="person-tutor-zip"
                    label="ZIP"
                    optional
                    autoComplete="off"
                    keyboardType="number-pad"
                    value={form.tutor.postal_code}
                    onChangeText={(value) => setTutor({ ...form.tutor, postal_code: value })}
                    placeholder="27513"
                    error={errors['tutor_profile.postal_code']}
                  />
                </View>
              </View>
            </>
          ) : null}

          {show('tutor-availability') ? (
            <CheckRow
              testID="person-tutor-virtual"
              label="Available for virtual tutoring"
              checked={form.tutor.virtual_available}
              onChange={(checked) => setTutor({ ...form.tutor, virtual_available: checked })}
            />
          ) : null}

          {show('tutor-financials') ? (
            <>
              <TutorPayRateFields tutor={form.tutor} onChange={setTutor} errors={errors} />
              {/* The fact, never the number: ticking this records today, and the number itself
                  is collected outside the portal and has nowhere to go in it. */}
              <CheckRow
                testID="person-tutor-ssn"
                label="We have this tutor’s SSN on file"
                checked={form.tutor.ssn_received}
                onChange={(checked) => setTutor({ ...form.tutor, ssn_received: checked })}
              />
              {form.tutor.ssn_received && form.tutor.ssn_received_on ? (
                <Text variant="bodySmall" style={{ color: muted, marginTop: -space.sm }}>
                  {`Confirmed on ${form.tutor.ssn_received_on}.`}
                </Text>
              ) : null}
            </>
          ) : null}

          {show('tutor-availability') ? (
            <SessionLimitField
              testID="person-tutor-limit"
              value={form.tutor.max_minutes}
              onChange={(value) => setTutor({ ...form.tutor, max_minutes: value })}
              hint="A running session that reaches this is recorded at it and flagged, so a timer left on does not bill the rest of the night."
            />
          ) : null}
          {show('tutor-financials') ? (
            <TutorTopupField tutor={form.tutor} onChange={setTutor} errors={errors} />
          ) : null}
        </Block>
      ) : null}

      {isStudent && show('student') ? (
        <Block title="Student details">
          <FormTextField
            testID="person-student-school"
            label="School"
            value={form.student.school}
            onChangeText={(value) => setStudent({ ...form.student, school: value })}
            placeholder="Culbreth Middle"
            error={errors['student_profile.school']}
          />
          <FormTextField
            testID="person-student-course"
            label="Current math course / grade"
            value={form.student.current_math_course}
            onChangeText={(value) => setStudent({ ...form.student, current_math_course: value })}
            placeholder="Grade 7 Mathematics"
            error={errors['student_profile.current_math_course']}
          />
          <FormTextField
            testID="person-student-goal"
            label="Goal for this academic year"
            hint={
              activePlan
                ? 'This is also the goal of their learning plan — changing it here changes the plan.'
                : 'Becomes the goal of their learning plan when one is set.'
            }
            value={form.student.academic_year_goal}
            onChangeText={(value) => setStudent({ ...form.student, academic_year_goal: value })}
            placeholder="Move up to the accelerated track"
            error={errors['student_profile.academic_year_goal']}
          />
          <CheckRow
            testID="person-student-virtual"
            label="Available for virtual tutoring"
            checked={form.student.virtual_available}
            onChange={(checked) => setStudent({ ...form.student, virtual_available: checked })}
          />
          <StudentPriceFields student={form.student} onChange={setStudent} errors={errors} />
          <SessionLimitField
            testID="person-student-limit"
            value={form.student.max_minutes}
            onChange={(value) => setStudent({ ...form.student, max_minutes: value })}
            hint="The shorter of this and the tutor's limit is the one that applies."
          />
        </Block>
      ) : null}

      {(isTutor || isStudent) && (show('availability') || show('tutor-availability')) ? (
        <>
          <Divider />
          <AvailabilityPicker value={form.availability} onChange={(slots) => set('availability', slots)} />
        </>
      ) : null}

      {(isTutor || isParent) && show('payment-handles') ? (
        <>
          <Divider />
          <PaymentHandlesField
            value={form.payment_handles}
            onChange={(handles) => set('payment_handles', handles)}
            hint={handlesHint(form.roles)}
          />
        </>
      ) : null}

      {(isStudent || isTutor) && show('guardians') ? (
        <>
          <Divider />
          <GuardianPicker
            value={form.guardians}
            onChange={(links) => set('guardians', links)}
            excludeUserId={detail?.id}
            knownNames={Object.fromEntries(
              (detail?.guardians ?? []).map((link) => [link.user_id, link.full_name]),
            )}
            error={errors.guardians}
            required={isStudent}
          />
        </>
      ) : null}

      {footErrors.length > 0 ? (
        <View testID="person-form-error" accessibilityRole="alert" style={{ gap: 2 }}>
          {footErrors.map((message) => (
            <Text key={message} variant="bodyMedium" style={{ color: theme.colors.error }}>
              {message}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="person-form-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
        >
          {isEdit ? 'Save changes' : 'Add user'}
        </Button>
        <Button testID="person-form-cancel" mode="outlined" onPress={onCancel} disabled={saving}>
          Cancel
        </Button>
      </View>
    </DismissKeyboard>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <>
      <Divider />
      <View style={{ gap: space.md }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: theme.tokens.mutedForeground,
          }}
        >
          {title}
        </Text>
        {children}
      </View>
    </>
  );
}

function CheckRow({
  testID,
  label,
  checked,
  onChange,
}: {
  testID: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onChange(!checked);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET }}
    >
      <Icon
        source={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={22}
        color={checked ? theme.colors.primary : theme.tokens.mutedForeground}
      />
      <Text variant="bodyMedium">{label}</Text>
    </Pressable>
  );
}
