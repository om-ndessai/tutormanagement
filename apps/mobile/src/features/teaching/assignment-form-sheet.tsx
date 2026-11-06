// Ported from apps/web/src/features/teaching/assignment-dialog.tsx @ 1132322.
// The dialog becomes a form sheet, `(org)/assignment-form` (`?id=<assignment>` to edit; `?student=` or
// `?tutor=` preset one side of a new pairing, as the welcome wizard's `preset` does).
//
// "Admin, when assigning a student to the tutor can specify the hourly rate." A filled field is an
// OVERRIDE stored on the pairing; an empty one follows the tutor's default.
//
// Phase 75 (docs/journey-fixes-plan.md JF27; owner 2026-11-05): choosing a tutor no longer COPIES their default into
// the override (which froze it: a later change to the default never reached the pairing). The fields start empty
// and say what they follow ("Alex's default, $75.00"); an override equal to the current default says so; the labels
// say whose pay it is ("Tutor pay, in person" / "Tutor pay, virtual").
import {
  assignmentInputSchema,
  assignmentUpdateSchema,
  centsToInput,
  parseCentsInput,
  LOCATION_KIND_LABELS,
  type Assignment,
  type Location,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';

import { OfflineSaveNote, useOffline } from '@/components/connectivity';
import { useDirty, useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { FieldError } from '@/components/field-error';
import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { useLocations, useSetPairingLocations } from '@/features/locations/api';
import { useUserDetail, useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { announceFormSaved } from '@/lib/form-bridge';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useAssignments, useCreateAssignment, useUpdateAssignment } from './api';
import { overrideShown, rateFallbackHint } from './pairing-rates';
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
    body = <FormSkeleton label="Loading the pairing…" fields={4} />;
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
  // Phase 33: where this pair may have lessons, from the tutor's and the student's own places.
  const [locationIds, setLocationIds] = useState<string[]>(
    existing?.locations.map((location) => location.id) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  // JF27: a saved override equal to the tutor's current default, shown as the default (empty) once that default is
  // known -- and left as stored unless the admin types a rate (no data change).
  const [shownAsDefault, setShownAsDefault] = useState<{ in_person: boolean; virtual: boolean } | null>(null);
  const inPersonAsStored = shownAsDefault?.in_person && inPerson === '' ? centsToInput(existing?.rate_in_person_cents) : inPerson;
  const virtualAsStored = shownAsDefault?.virtual && virtual === '' ? centsToInput(existing?.rate_virtual_cents) : virtual;

  // What was typed is not lost to a swipe or Back (ux-audit F-3); offline, Save waits (F-16).
  const dirty = useDirty({
    tutorId,
    studentId,
    inPerson: inPersonAsStored,
    virtual: virtualAsStored,
    notes,
    locationIds,
  });
  const { leave } = useUnsavedChangesGuard(dirty);
  const offline = useOffline();

  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const setLocations = useSetPairingLocations();
  const saving = create.isPending || update.isPending || setLocations.isPending;
  const tutorLocationsQuery = useLocations(tutorId || null);
  const studentLocationsQuery = useLocations(studentId || null);
  const offered = [...(tutorLocationsQuery.data?.data ?? []), ...(studentLocationsQuery.data?.data ?? [])];
  // Until both lists arrive, "still offered" cannot be judged: saving then would drop every place.
  const locationsLoading =
    (Boolean(tutorId) && tutorLocationsQuery.isPending) ||
    (Boolean(studentId) && studentLocationsQuery.isPending);

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
  // The list rows carry no rates, so the tutor's profile is read for their CURRENT defaults -- what an empty field
  // follows, new pairing or old. Never copied into the fields (JF27).
  const tutorDetail = useUserDetail(tutorId || null);
  const tutorDefaults = tutorDetail.data?.data.tutor_profile ?? null;
  const tutorName = selectedTutor?.full_name ?? existing?.tutor_name ?? null;
  const rateHint = rateHintFor(tutorName, tutorDefaults);
  const fallbackInPerson = tutorDefaults?.default_rate_in_person_cents ?? null;
  const fallbackVirtual = tutorDefaults?.default_rate_virtual_cents ?? null;

  // Adjusting state while rendering (not in an effect), once, when an edited pairing's tutor's defaults arrive.
  if (existing && tutorDefaults && shownAsDefault === null) {
    const inPersonFollows = overrideShown(existing.rate_in_person_cents, fallbackInPerson) === null && existing.rate_in_person_cents != null;
    const virtualFollows = overrideShown(existing.rate_virtual_cents, fallbackVirtual) === null && existing.rate_virtual_cents != null;
    setShownAsDefault({ in_person: inPersonFollows, virtual: virtualFollows });
    if (inPersonFollows && inPerson === centsToInput(existing.rate_in_person_cents)) setInPerson('');
    if (virtualFollows && virtual === centsToInput(existing.rate_virtual_cents)) setVirtual('');
  }

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

    // A field shown as the default it equals, and left so, keeps what is stored (JF27: no data change).
    const rates = {
      ...(shownAsDefault?.in_person && inPerson === '' ? {} : { rate_in_person_cents: parseCentsInput(inPerson) }),
      ...(shownAsDefault?.virtual && virtual === '' ? {} : { rate_virtual_cents: parseCentsInput(virtual) }),
      notes: notes.trim() || null,
    };

    try {
      // Only places still offered: one of a person no longer chosen falls away.
      const chosenLocations = locationIds.filter((id) => offered.some((location) => location.id === id));
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
        const before = existing.locations
          .map((location) => location.id)
          .sort()
          .join();
        if (before !== [...chosenLocations].sort().join()) {
          await setLocations.mutateAsync({ assignmentId: existing.id, locationIds: chosenLocations });
        }
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
        if (chosenLocations.length > 0) {
          await setLocations.mutateAsync({ assignmentId: created.data.id, locationIds: chosenLocations });
        }
        toast.success('Student assigned.');
        announceFormSaved({ form: 'assignment', id: created.data.id });
      }
      leave(close);
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
            : 'Pair a tutor with a student. Only assigned pairs can record lessons.'}
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
          label="Tutor pay, in person"
          value={inPerson}
          onChange={setInPerson}
          placeholder={tutorDetail.isPending && tutorId ? '' : rateFallbackHint(fallbackInPerson, tutorName)}
          error={errors.rate_in_person_cents}
        />
        <RateField
          testID="assignment-rate-virtual"
          label="Tutor pay, virtual"
          value={virtual}
          onChange={setVirtual}
          placeholder={tutorDetail.isPending && tutorId ? '' : rateFallbackHint(fallbackVirtual, tutorName)}
          error={errors.rate_virtual_cents}
        />
        <Text testID="assignment-rate-hint" variant="bodySmall" style={{ color: muted }}>
          {rateHint}
        </Text>
      </View>

      <PairingLocations
        ready={Boolean(tutorId && studentId)}
        offered={offered}
        value={locationIds}
        onChange={setLocationIds}
        error={errors.location_ids}
      />

      <NoteField
        testID="assignment-notes"
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
        placeholder="Weekly, building towards the accelerated track"
        error={errors.notes}
      />
      {errors.form ? <FieldError>{errors.form}</FieldError> : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="assignment-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving || offline || locationsLoading}
        >
          {isEdit ? 'Save changes' : 'Assign'}
        </Button>
        <OfflineSaveNote offline={offline} />
        <Button testID="assignment-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

/**
 * What the rate fields follow, said once under them: the tutor's default (named), or that there is none -- then a
 * lesson cannot be priced until one is set, here or on their record.
 */
export function rateHintFor(
  tutorName: string | null,
  defaults: { default_rate_in_person_cents: number | null; default_rate_virtual_cents: number | null } | null,
): string {
  if (!tutorName) return "Blank follows the tutor's default.";
  const first = tutorName.trim().split(/\s+/)[0] || tutorName;
  if (defaults && defaults.default_rate_in_person_cents == null && defaults.default_rate_virtual_cents == null) {
    return `${tutorName} has no default rate — set one here, or lessons cannot be priced.`;
  }
  return `Blank follows ${first}'s default. Type a rate only for a different one.`;
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
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

/** Where this pair may meet: each of the tutor's and the student's own places, ticked or not. */
function PairingLocations({
  ready,
  offered,
  value,
  onChange,
  error,
}: {
  ready: boolean;
  offered: Location[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <View testID="assignment-locations" style={{ gap: space.xs }}>
      <Text variant="bodyMedium" style={{ color: error ? theme.colors.error : muted }}>
        Locations (where this pair may meet)
      </Text>
      {!ready ? (
        <Text variant="bodySmall" style={{ color: muted }}>
          Choose the tutor and the student first.
        </Text>
      ) : offered.length === 0 ? (
        <Text variant="bodySmall" style={{ color: muted }}>
          Neither has a location yet. Add them on each person’s record.
        </Text>
      ) : (
        offered.map((location) => {
          const checked = value.includes(location.id);
          return (
            <Checkbox.Item
              key={location.id}
              testID={`assignment-location-${location.id}`}
              label={`${location.name} · ${LOCATION_KIND_LABELS[location.kind]} · ${location.owner_name}`}
              status={checked ? 'checked' : 'unchecked'}
              onPress={() => {
                haptics.selection();
                onChange(checked ? value.filter((id) => id !== location.id) : [...value, location.id]);
              }}
              position="leading"
              mode="android"
              labelStyle={{ textAlign: 'left' }}
              style={{ paddingHorizontal: 0 }}
            />
          );
        })
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}
