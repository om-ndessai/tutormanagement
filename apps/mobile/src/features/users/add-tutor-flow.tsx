// Add a tutor (UI upgrades U3; build log #48): Basics -> Background -> Teaching -> Availability -> Pay
// -> Review (the spec's Teaching is two steps, so no step needs scrolling at the default text size).
// The mailing address and "SSN on file" are not asked here: the tutor's record carries a Finish tax
// setup card until both are set, and only the received-on fact is ever recorded, never a number.
import { formatDuration, tutorProfileSchema, type AvailabilitySlot } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { EmptyState } from '@/components/state-views';
import { StepFlow, type StepDef } from '@/components/step-flow';
import { useToast } from '@/components/toast';
import { useDirty } from '@/hooks/use-unsaved-changes';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { TUTOR_STEP_FIELDS, stepIssues } from './add-person-model';
import { AddPersonDone } from './add-person-done';
import { Lines } from './add-student-flow';
import { availabilityLines } from './availability-bands';
import { AvailabilityWeek } from './availability-week';
import { FormTextField } from './form-text-field';
import { CheckRow } from './person-form';
import { TutorPayRateFields, TutorTopupField } from './person-form-rates';
import { EMPTY, toRequest, type FormState } from './person-form-model';
import { SessionLimitField } from './session-limit-field';
import { useAddPerson, type AddedPerson } from './use-add-person';
import { TutorPayRates, TutorTopup } from './user-rates';

const INITIAL: FormState = { ...EMPTY, roles: ['tutor'] };

/** The route's body: admins only, as the API (`requireAdmin`). */
export function AddTutorFlow({ fromWizard }: { fromWizard: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [round, setRound] = useState(0);
  const [added, setAdded] = useState<AddedPerson | null>(null);

  if (!user?.roles.includes('admin')) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <EmptyState
          icon="lock-outline"
          title="Only an admin can add a tutor."
          action={
            <Button mode="outlined" onPress={() => router.back()}>
              Close
            </Button>
          }
        />
      </ScrollView>
    );
  }
  if (added) {
    return (
      <AddPersonDone
        kind="tutor"
        person={added}
        onAgain={() => {
          setAdded(null);
          setRound((n) => n + 1);
        }}
      />
    );
  }
  return (
    <TutorSteps
      key={round}
      onAdded={(person, leave) => {
        // Back in the wizard, a toast says so; otherwise the next screen says it, in its title (a
        // toast there would sit over its buttons).
        if (fromWizard) {
          toast.success(`${person.name} added.`);
          leave();
        } else {
          haptics.success();
          setAdded(person);
        }
      }}
    />
  );
}

function TutorSteps({
  onAdded,
}: {
  onAdded: (person: AddedPerson, leave: (close?: () => void) => void) => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const dirty = useDirty(form);
  const { submit, submitting, fieldErrors, formError, clearErrors, today } = useAddPerson();

  const update = (patch: Partial<FormState>) => {
    setForm((was) => ({ ...was, ...patch }));
    clearErrors();
  };
  const setTutor = (tutor: FormState['tutor']) => update({ tutor });

  const steps: StepDef<FormState>[] = [
    {
      key: 'basics',
      title: 'Who is the tutor?',
      description: 'They sign in with this Google address.',
      fields: TUTOR_STEP_FIELDS.basics,
      validate: (draft) => stepIssues(draft, today, TUTOR_STEP_FIELDS.basics),
      render: ({ draft, errors }) => (
        <>
          <FormTextField
            testID="add-tutor-name"
            label="Full name"
            value={draft.full_name}
            onChangeText={(full_name) => update({ full_name })}
            placeholder="Alex Chen"
            autoCapitalize="words"
            error={errors.full_name}
          />
          <FormTextField
            testID="add-tutor-email"
            label="Email"
            value={draft.email}
            onChangeText={(email) => update({ email })}
            placeholder="alex@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <FormTextField
            testID="add-tutor-phone"
            label="Phone"
            optional
            value={draft.phone}
            onChangeText={(phone) => update({ phone })}
            placeholder="(919) 555-0142"
            keyboardType="phone-pad"
            error={errors.phone}
          />
        </>
      ),
      summary: (draft) => <Lines lines={[draft.full_name.trim(), draft.email.trim(), draft.phone.trim()].filter(Boolean)} />,
    },
    {
      key: 'background',
      title: 'Their background',
      description: 'For matching them with families. Optional, each of them.',
      fields: TUTOR_STEP_FIELDS.background,
      validate: (draft) => stepIssues(draft, today, TUTOR_STEP_FIELDS.background),
      render: ({ draft, errors }) => (
        <>
          <FormTextField
            testID="add-tutor-education"
            label="Highest education"
            optional
            hint="Or their current grade / math course."
            value={draft.tutor.highest_education}
            onChangeText={(highest_education) => setTutor({ ...draft.tutor, highest_education })}
            placeholder="MS, Applied Mathematics"
            error={errors['tutor_profile.highest_education']}
          />
          <FormTextField
            testID="add-tutor-school"
            label="School"
            optional
            value={draft.tutor.school}
            onChangeText={(school) => setTutor({ ...draft.tutor, school })}
            placeholder="NC State"
            error={errors['tutor_profile.school']}
          />
          <FormTextField
            testID="add-tutor-area"
            label="Area"
            optional
            hint="The neighbourhood, for matching families."
            value={draft.tutor.area}
            onChangeText={(area) => setTutor({ ...draft.tutor, area })}
            placeholder="Carrboro"
            error={errors['tutor_profile.area']}
          />
        </>
      ),
      summary: (draft) => {
        const lines = [draft.tutor.highest_education.trim(), draft.tutor.school.trim(), draft.tutor.area.trim()].filter(
          Boolean,
        );
        return lines.length === 0 ? null : <Lines lines={lines} />;
      },
    },
    {
      key: 'teaching',
      title: 'Their teaching',
      description: 'How they meet students, and how long a lesson may run.',
      fields: TUTOR_STEP_FIELDS.teaching,
      validate: (draft) => stepIssues(draft, today, TUTOR_STEP_FIELDS.teaching),
      render: ({ draft }) => (
        <>
          <CheckRow
            testID="add-tutor-online"
            label="Teaches online too (in person is assumed)"
            checked={draft.tutor.virtual_available}
            onChange={(virtual_available) => setTutor({ ...draft.tutor, virtual_available })}
          />
          <SessionLimitField
            testID="add-tutor-limit"
            value={draft.tutor.max_minutes}
            onChange={(max_minutes) => setTutor({ ...draft.tutor, max_minutes })}
            hint="A running session that reaches this is recorded at it and flagged, so a timer left on does not bill the rest of the night."
          />
        </>
      ),
      summary: (draft) => {
        const minutes = draft.tutor.max_minutes ? Number(draft.tutor.max_minutes) : null;
        return (
          <Lines
            lines={[
              draft.tutor.virtual_available ? 'In person and online' : 'In person',
              minutes ? `Longest lesson: ${formatDuration(minutes)}` : 'Longest lesson: no limit of their own',
            ]}
          />
        );
      },
    },
    {
      key: 'availability',
      title: 'When can they teach?',
      description: 'Tap the times that usually suit them. Optional.',
      optional: true,
      onSkip: () => update({ availability: [] }),
      fields: TUTOR_STEP_FIELDS.availability,
      validate: (draft) => stepIssues(draft, today, TUTOR_STEP_FIELDS.availability),
      render: ({ draft, errors }) => (
        <>
          <AvailabilityWeek
            testID="add-tutor"
            value={draft.availability}
            onChange={(availability: AvailabilitySlot[]) => update({ availability })}
          />
          {errors.availability ? <FieldError>{errors.availability}</FieldError> : null}
        </>
      ),
      summary: (draft) => {
        const lines = availabilityLines(draft.availability);
        return lines.length === 0 ? null : <Lines lines={lines} />;
      },
    },
    {
      key: 'pay',
      title: 'Their pay',
      description: 'What they are paid per hour, and whether they are paid in advance.',
      fields: TUTOR_STEP_FIELDS.pay,
      validate: (draft) => stepIssues(draft, today, TUTOR_STEP_FIELDS.pay),
      render: ({ draft, errors }) => (
        <>
          <TutorPayRateFields tutor={draft.tutor} onChange={setTutor} errors={errors} />
          <TutorTopupField tutor={draft.tutor} onChange={setTutor} errors={errors} />
        </>
      ),
      summary: (draft) => {
        // The rates as the server would store them, through the record's own money rows.
        const parsed = tutorProfileSchema.safeParse(toRequest(draft, today).tutor_profile);
        return parsed.success ? (
          <View style={{ gap: space.sm }}>
            <TutorPayRates tutor={parsed.data} />
            <TutorTopup tutor={parsed.data} />
          </View>
        ) : null;
      },
    },
  ];

  return (
    <StepFlow
      title="Add a tutor"
      steps={steps}
      draft={form}
      review={{
        description: 'Check the details, then add the tutor. Their tax details come after, from their record.',
      }}
      submitLabel="Add tutor"
      dirty={dirty}
      submitting={submitting}
      fieldErrors={fieldErrors}
      formError={formError}
      onSubmit={async ({ leave }) => {
        const person = await submit(form);
        if (person) onAdded(person, leave);
      }}
    />
  );
}
