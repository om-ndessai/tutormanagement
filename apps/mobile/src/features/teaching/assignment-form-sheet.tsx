// Ported from apps/web/src/features/teaching/assignment-dialog.tsx @ 1132322.
// The dialog becomes a form sheet, `(org)/assignment-form` (`?id=<assignment>` to edit; `?student=` or
// `?tutor=` preset one side of a new pairing, as the welcome wizard's `preset` does).
//
// "Admin, when assigning a student to the tutor can specify the hourly rate." Choosing a tutor
// fills both rate fields with that tutor's current defaults, so the admin adjusts from a real
// number rather than from nothing. A filled field is an OVERRIDE stored on the pairing, captured as
// of now; clearing it restores the inherit-from-tutor behaviour.
import {
  assignmentInputSchema,
  assignmentUpdateSchema,
  centsToInput,
  parseCentsInput,
  type Assignment,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useUserDetail, useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { announceFormSaved } from '@/lib/form-bridge';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useAssignments, useCreateAssignment, useUpdateAssignment } from './api';
import { rateFallbackHint } from './pairing-rates';
import { NoteField } from './session-notes';
import { issuesToErrors } from './session-form/use-session-form';

function close() {
  if (router.canGoBack()) router.back();
}

/** One side of a new pairing, already chosen. */
export interface AssignmentPreset {
  student_user_id?: string;
  tutor_user_id?: string;
}

export function AssignmentFormSheet({
  assignmentId,
  preset,
}: {
  assignmentId: string | undefined;
  preset?: AssignmentPreset;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const list = useAssignments();

  let body;
  if (!isAdmin) {
    // The API refuses anyone else; the sheet says so rather than offering a form that cannot save.
    body = <EmptyState icon="lock-outline" title="Only an admin can change pairings." />;
  } else if (!assignmentId) {
    body = <AssignmentForm existing={null} preset={preset} />;
  } else if (list.isPending) {
    body = <LoadingState label="Loading the pairing…" />;
  } else if (list.isError) {
    body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  } else {
    const existing = list.data.data.find((row) => row.id === assignmentId);
    body = existing ? (
      <AssignmentForm key={existing.id} existing={existing} />
    ) : (
      <ErrorState error={new ApiRequestError(404, 'not_found', 'That assignment does not exist.')} />
    );
  }

  return (
    <Screen testID="screen-assignment-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

/** A rate field's text that is neither blank nor an amount: refused rather than read as "no override". */
function badRate(text: string): boolean {
  return text.trim() !== '' && parseCentsInput(text) == null;
}

export function AssignmentForm({
  existing,
  preset,
}: {
  existing: Assignment | null;
  preset?: AssignmentPreset;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const muted = theme.tokens.mutedForeground;
  const isEdit = existing !== null;

  const [tutorId, setTutorId] = useState(existing?.tutor_user_id ?? preset?.tutor_user_id ?? '');
  const [studentId, setStudentId] = useState(existing?.student_user_id ?? preset?.student_user_id ?? '');
  const [inPerson, setInPerson] = useState(centsToInput(existing?.rate_in_person_cents));
  const [virtual, setVirtual] = useState(centsToInput(existing?.rate_virtual_cents));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Which tutor's defaults have already been written into the fields: once per choice, and never
  // over the admin's typing. An existing pairing already carries its own rates.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(existing ? existing.tutor_user_id : null);

  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const saving = create.isPending || update.isPending;

  // A preset person the first hundred names leave out -- the wizard's new student sorts anywhere --
  // is fetched on their own, so the picker shows them chosen rather than a blank.
  const presetStudentId = preset?.student_user_id;
  const presetTutorId = preset?.tutor_user_id;
  const presetStudent = useUserDetail(
    presetStudentId && students.data && !students.data.data.some((row) => row.id === presetStudentId)
      ? presetStudentId
      : null,
  );
  const presetTutor = useUserDetail(
    presetTutorId && tutors.data && !tutors.data.data.some((row) => row.id === presetTutorId)
      ? presetTutorId
      : null,
  );
  const tutorRows = [...(presetTutor.data ? [presetTutor.data.data] : []), ...(tutors.data?.data ?? [])];
  const studentRows = [
    ...(presetStudent.data ? [presetStudent.data.data] : []),
    ...(students.data?.data ?? []),
  ];

  const selectedTutor = tutorRows.find((candidate) => candidate.id === tutorId);
  // The list rows carry no rates, so the chosen tutor's profile is fetched for them. Skipped while
  // editing, where the pairing's own rates win.
  const tutorDetail = useUserDetail(!isEdit && tutorId ? tutorId : null);
  const tutorDefaults = tutorDetail.data?.data.tutor_profile ?? null;

  // Adjusting state while rendering (not in an effect): the fields take the tutor's defaults the
  // moment they arrive, in the same pass.
  if (!isEdit && tutorId && tutorDefaults && prefilledFor !== tutorId) {
    setPrefilledFor(tutorId);
    setInPerson(centsToInput(tutorDefaults.default_rate_in_person_cents));
    setVirtual(centsToInput(tutorDefaults.default_rate_virtual_cents));
  }

  const hasAnyDefault =
    tutorDefaults != null &&
    (tutorDefaults.default_rate_in_person_cents != null || tutorDefaults.default_rate_virtual_cents != null);
  const rateHint =
    isEdit || !selectedTutor
      ? "Blank uses the tutor's default."
      : hasAnyDefault
        ? `From ${selectedTutor.full_name}'s profile. Clear to follow their default instead.`
        : `${selectedTutor.full_name} has no default rate — set one here, or sessions cannot be priced.`;

  const fallbackInPerson = existing
    ? existing.effective_rate_in_person_cents
    : (tutorDefaults?.default_rate_in_person_cents ?? null);
  const fallbackVirtual = existing
    ? existing.effective_rate_virtual_cents
    : (tutorDefaults?.default_rate_virtual_cents ?? null);

  async function handleSave() {
    setErrors({});

    const local: Record<string, string> = {};
    if (!isEdit && !tutorId) local.tutor_user_id = 'Choose a tutor.';
    if (!isEdit && !studentId) local.student_user_id = 'Choose a student.';
    if (badRate(inPerson)) local.rate_in_person_cents = 'Enter an amount, like 75.00.';
    if (badRate(virtual)) local.rate_virtual_cents = 'Enter an amount, like 65.00.';
    if (Object.keys(local).length > 0) {
      setErrors(local);
      haptics.error();
      return;
    }

    const rates = {
      rate_in_person_cents: parseCentsInput(inPerson),
      rate_virtual_cents: parseCentsInput(virtual),
      notes: notes.trim() || null,
    };

    try {
      if (isEdit) {
        const parsed = assignmentUpdateSchema.safeParse(rates);
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        // The fields as typed, not `parsed.data`: the schema's `is_active` default survives
        // `.partial()`, and would send a pause-undoing `is_active: true` with every edit.
        await update.mutateAsync({ id: existing.id, input: rates });
        toast.success('Pairing updated.');
      } else {
        const parsed = assignmentInputSchema.safeParse({
          tutor_user_id: tutorId,
          student_user_id: studentId,
          is_active: true,
          ...rates,
        });
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        const created = await create.mutateAsync(parsed.data);
        toast.success('Student assigned.');
        announceFormSaved({ form: 'assignment', id: created.data.id });
      }
      close();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the pairing.');
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {isEdit ? 'Edit pairing' : 'Pair a tutor with a student'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {isEdit
            ? `${existing.tutor_name} teaches ${existing.student_name}.`
            : 'Pair a tutor with a student. Only assigned pairs can record sessions.'}
        </Text>
      </View>

      {!isEdit ? (
        <>
          <OptionPicker
            testID="assignment-tutor"
            label="Tutor"
            placeholder="Choose a tutor"
            searchPlaceholder="Search tutors"
            options={tutorRows.map((candidate) => ({
              id: candidate.id,
              label: candidate.full_name,
            }))}
            value={tutorId}
            onChange={setTutorId}
            error={errors.tutor_user_id}
          />
          <OptionPicker
            testID="assignment-student"
            label="Student"
            placeholder="Choose a student"
            searchPlaceholder="Search students"
            options={studentRows
              .filter((candidate) => candidate.id !== tutorId)
              .map((candidate) => ({ id: candidate.id, label: candidate.full_name }))}
            value={studentId}
            onChange={setStudentId}
            error={errors.student_user_id}
          />
        </>
      ) : null}

      <View style={{ gap: space.sm }}>
        <RateField
          testID="assignment-rate-in-person"
          label="In-person rate"
          value={inPerson}
          onChange={setInPerson}
          placeholder={rateFallbackHint(fallbackInPerson, '75.00')}
          error={errors.rate_in_person_cents}
        />
        <RateField
          testID="assignment-rate-virtual"
          label="Virtual rate"
          value={virtual}
          onChange={setVirtual}
          placeholder={rateFallbackHint(fallbackVirtual, '65.00')}
          error={errors.rate_virtual_cents}
        />
        <Text testID="assignment-rate-hint" variant="bodySmall" style={{ color: muted }}>
          {rateHint}
        </Text>
      </View>

      <NoteField
        testID="assignment-notes"
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
        placeholder="Weekly, building towards the accelerated track"
        error={errors.notes}
      />
      {errors.form ? (
        <HelperText type="error" padding="none">
          {errors.form}
        </HelperText>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="assignment-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
        >
          {isEdit ? 'Save changes' : 'Assign'}
        </Button>
        <Button testID="assignment-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

function RateField({
  testID,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  testID: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <View>
      <TextInput
        testID={testID}
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        // iOS's decimal pad has no return key, so it could never be put away: this one has.
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        left={<TextInput.Affix text="$" />}
        error={Boolean(error)}
      />
      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}
