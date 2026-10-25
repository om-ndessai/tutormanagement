// Add a student, family first (UI upgrades U3; build log #48). The owner: "The parent selection is at
// the very end making it difficult to add a student when parent has not been added. So in the
// student addition move parent selection first and allow user to add a new parent in that workflow
// first." So the Family step leads, with "New parent" inside it (a quick sheet that creates the
// parent and hands them back chosen); the student and their guardians are still ONE request at the
// end. The draft is the person form's `FormState`; each step's checks are the shared schema's.
import {
  featureAllowed,
  studentProfileSchema,
  formatDuration,
  type AvailabilitySlot,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { SearchPicker, type SearchPickerItem } from '@/components/search-picker';
import { EmptyState } from '@/components/state-views';
import { StepFlow, type StepDef } from '@/components/step-flow';
import { useToast } from '@/components/toast';
import { useBalances } from '@/features/payments/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useDirty } from '@/hooks/use-unsaved-changes';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, space } from '@/theme/tokens';
import { RELATIONSHIP_LABELS } from '@tmi/shared';
import {
  CONSENT_LABEL,
  STUDENT_STEP_FIELDS,
  childrenByParent,
  consentIssue,
  consentNeeded,
  familyIssues,
  parentLine,
  reconcileGuardians,
  stepIssues,
} from './add-person-model';
import { AddPersonDone } from './add-person-done';
import { useUsers } from './api';
import { availabilityLines } from './availability-bands';
import { AvailabilityWeek } from './availability-week';
import { FormTextField } from './form-text-field';
import { onGuardianCreated } from './guardian-bridge';
import { GuardianLinkCard } from './guardian-picker';
import { CheckRow } from './person-form';
import { StudentPriceFields } from './person-form-rates';
import { EMPTY, addGuardian, toRequest, updateGuardian, removeGuardian, type FormState } from './person-form-model';
import { SessionLimitField } from './session-limit-field';
import { useAddPerson, type AddedPerson } from './use-add-person';
import { StudentPrices } from './user-rates';

/** Phase 50: the steps that belong to Tutoring, left out where the space has no Tutoring (R23). */
export const TUTORING_STUDENT_STEPS: readonly string[] = ['availability', 'lessons', 'price'];

/** The add-student steps for this space: family, student, school, then (with Tutoring) the rest. */
export function studentSteps<T extends { key: string }>(steps: T[], tutoring: boolean): T[] {
  return tutoring ? steps : steps.filter((step) => !TUTORING_STUDENT_STEPS.includes(step.key));
}

const INITIAL: FormState = { ...EMPTY, roles: ['student'] };

/** Who the flow starts with as the family: nobody, or (`guardian=me`, Phase 52) the reader. */
export interface PresetGuardian {
  id: string;
  name: string;
}

/**
 * The route's body: admins only, as the API (`requireAdmin`). `guardian: 'me'` (Phase 52, "This is
 * my child" in the welcome wizard) chooses the reader on the Family step.
 */
export function AddStudentFlow({ fromWizard, guardian }: { fromWizard: boolean; guardian?: string }) {
  const { user } = useAuth();
  if (!user?.roles.includes('admin')) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <EmptyState
          icon="lock-outline"
          title="Only an admin can add a student."
          body="Ask an administrator to add the family."
          action={
            <Button mode="outlined" onPress={() => router.back()}>
              Close
            </Button>
          }
        />
      </ScrollView>
    );
  }
  const preset = guardian === 'me' ? { id: user.id, name: user.full_name } : null;
  return <AddStudentSteps fromWizard={fromWizard} preset={preset} />;
}

function AddStudentSteps({ fromWizard, preset }: { fromWizard: boolean; preset: PresetGuardian | null }) {
  const toast = useToast();
  const [round, setRound] = useState(0);
  const [added, setAdded] = useState<AddedPerson | null>(null);

  if (added) {
    return (
      <AddPersonDone
        kind="student"
        person={added}
        onAgain={() => {
          setAdded(null);
          setRound((n) => n + 1);
        }}
      />
    );
  }
  return (
    <StudentSteps
      key={round}
      preset={preset}
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

function StudentSteps({
  onAdded,
  preset,
}: {
  onAdded: (person: AddedPerson, leave: (close?: () => void) => void) => void;
  preset: PresetGuardian | null;
}) {
  const [form, setForm] = useState<FormState>(() =>
    preset ? { ...INITIAL, guardians: addGuardian([], preset.id) } : INITIAL,
  );
  // Names of the guardians chosen, so a card can say who they are whatever the list now holds.
  const [names, setNames] = useState<Record<string, string>>(() =>
    preset ? { [preset.id]: preset.name } : {},
  );
  // Phase 52: in a self-serve space the student is added with the adult's consent, ticked on Review.
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const dirty = useDirty(form);
  const { submit, submitting, fieldErrors, formError, clearErrors, today } = useAddPerson();
  // Phase 50: when they learn, their lessons and the price are Tutoring's.
  const { organization } = useAuth();
  const tutoring = featureAllowed(organization, 'tutoring');
  const needsConsent = consentNeeded(form, organization);
  const shownConsentError = consentError ?? fieldErrors?.parent_consent ?? null;

  const update = (patch: Partial<FormState>) => {
    setForm((was) => ({ ...was, ...patch }));
    clearErrors();
  };
  const setStudent = (student: FormState['student']) => update({ student });

  // A parent added in the New parent sheet arrives here, chosen.
  useEffect(
    () =>
      onGuardianCreated((guardian) => {
        setNames((was) => ({ ...was, [guardian.id]: guardian.full_name }));
        setForm((was) => ({ ...was, guardians: addGuardian(was.guardians, guardian.id) }));
        clearErrors();
      }),
    [clearErrors],
  );

  const allSteps: StepDef<FormState>[] = [
    {
      key: 'family',
      title: 'Who is their family?',
      description: 'The parent or guardian who is billed and kept informed. Add them here if they are new.',
      fields: STUDENT_STEP_FIELDS.family,
      scroll: false,
      validate: (draft) => familyIssues(draft, today),
      render: ({ draft, errors }) => (
        <FamilyStep
          guardians={draft.guardians}
          names={names}
          error={errors.guardians}
          onChange={(guardians, known) => {
            setNames((was) => ({ ...was, ...known }));
            update({ guardians });
          }}
        />
      ),
      summary: (draft) =>
        draft.guardians.length === 0 ? null : (
          <View style={{ gap: 2 }}>
            {draft.guardians.map((link) => (
              <Text key={link.guardian_user_id} variant="bodyMedium">
                {`${names[link.guardian_user_id] ?? 'A parent'} — ${RELATIONSHIP_LABELS[link.relationship]}${
                  link.is_primary && draft.guardians.length > 1 ? ', primary contact' : ''
                }`}
              </Text>
            ))}
          </View>
        ),
    },
    {
      key: 'student',
      title: 'Who is the student?',
      fields: STUDENT_STEP_FIELDS.student,
      validate: (draft) => stepIssues(draft, today, STUDENT_STEP_FIELDS.student),
      render: ({ draft, errors }) => (
        <>
          <FormTextField
            testID="add-student-name"
            label="Full name"
            value={draft.full_name}
            onChangeText={(full_name) => update({ full_name })}
            placeholder="Mila Novak"
            autoCapitalize="words"
            error={errors.full_name}
          />
          <FormTextField
            testID="add-student-email"
            label="Email"
            optional
            hint="Only if they will sign in themselves. A child with no address of their own needs none."
            value={draft.email}
            onChangeText={(email) => update({ email })}
            placeholder="No email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
        </>
      ),
      summary: (draft) => (
        <View style={{ gap: 2 }}>
          <Text variant="bodyMedium">{draft.full_name.trim()}</Text>
          <MutedLine>{draft.email.trim() || 'No email'}</MutedLine>
        </View>
      ),
    },
    {
      key: 'school',
      title: 'School and goal',
      description: 'Where they are now and what this year is for. Optional.',
      optional: true,
      onSkip: () =>
        setStudent({ ...form.student, school: '', current_math_course: '', academic_year_goal: '' }),
      fields: STUDENT_STEP_FIELDS.school,
      validate: (draft) => stepIssues(draft, today, STUDENT_STEP_FIELDS.school),
      render: ({ draft, errors }) => (
        <>
          <FormTextField
            testID="add-student-school"
            label="School"
            value={draft.student.school}
            onChangeText={(school) => setStudent({ ...draft.student, school })}
            placeholder="Culbreth Middle"
            error={errors['student_profile.school']}
          />
          <FormTextField
            testID="add-student-course"
            label="Current math course or grade"
            value={draft.student.current_math_course}
            onChangeText={(current_math_course) => setStudent({ ...draft.student, current_math_course })}
            placeholder="Grade 7 Mathematics"
            error={errors['student_profile.current_math_course']}
          />
          <FormTextField
            testID="add-student-goal"
            label="Goal for this academic year"
            hint="Becomes the goal of their learning plan when one is set."
            value={draft.student.academic_year_goal}
            onChangeText={(academic_year_goal) => setStudent({ ...draft.student, academic_year_goal })}
            placeholder="Move up to the accelerated track"
            error={errors['student_profile.academic_year_goal']}
          />
        </>
      ),
      summary: (draft) => {
        const lines = [
          draft.student.school.trim(),
          draft.student.current_math_course.trim(),
          draft.student.academic_year_goal.trim() ? `Goal: ${draft.student.academic_year_goal.trim()}` : '',
        ].filter(Boolean);
        return lines.length === 0 ? null : <Lines lines={lines} />;
      },
    },
    {
      key: 'availability',
      title: 'When can they learn?',
      description: 'Tap the times that usually suit them. Optional.',
      optional: true,
      onSkip: () => update({ availability: [] }),
      fields: STUDENT_STEP_FIELDS.availability,
      validate: (draft) => stepIssues(draft, today, STUDENT_STEP_FIELDS.availability),
      render: ({ draft, errors }) => (
        <>
          <AvailabilityWeek
            testID="add-student"
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
      key: 'lessons',
      title: 'Their lessons',
      description: 'How they meet, and how long a lesson may run.',
      fields: STUDENT_STEP_FIELDS.lessons,
      validate: (draft) => stepIssues(draft, today, STUDENT_STEP_FIELDS.lessons),
      render: ({ draft }) => (
        <>
          <CheckRow
            testID="add-student-online"
            label="Online lessons too (in person is assumed)"
            checked={draft.student.virtual_available}
            onChange={(virtual_available) => setStudent({ ...draft.student, virtual_available })}
          />
          <SessionLimitField
            testID="add-student-limit"
            value={draft.student.max_minutes}
            onChange={(max_minutes) => setStudent({ ...draft.student, max_minutes })}
            hint="The shorter of this and the tutor's limit is the one that applies."
          />
        </>
      ),
      summary: (draft) => <LessonsSummary form={draft} />,
    },
    {
      key: 'price',
      title: 'The price',
      description: 'What the family is charged per hour, whoever teaches them.',
      fields: STUDENT_STEP_FIELDS.price,
      validate: (draft) => stepIssues(draft, today, STUDENT_STEP_FIELDS.price),
      render: ({ draft, errors }) => (
        <StudentPriceFields student={draft.student} onChange={setStudent} errors={errors} />
      ),
      summary: (draft) => <PriceSummary form={draft} today={today} />,
    },
  ];
  const steps = studentSteps(allSteps, tutoring);

  return (
    <StepFlow
      title="Add a student"
      steps={steps}
      draft={form}
      review={{
        description: 'Check the details, then add the student.',
        trail: needsConsent
          ? () => (
              <View style={{ gap: space.xs }}>
                <CheckRow
                  testID="add-student-consent"
                  label={CONSENT_LABEL}
                  checked={consent}
                  onChange={(checked) => {
                    setConsent(checked);
                    setConsentError(null);
                    clearErrors();
                  }}
                />
                {shownConsentError ? (
                  <FieldError testID="add-student-consent-error">{shownConsentError}</FieldError>
                ) : null}
              </View>
            )
          : undefined,
      }}
      submitLabel="Add student"
      dirty={dirty}
      submitting={submitting}
      fieldErrors={fieldErrors}
      formError={formError}
      onSubmit={async ({ leave }) => {
        // Checked before sending: the server would refuse it in the same words.
        const issue = consentIssue(form, organization, consent);
        if (issue) {
          setConsentError(issue);
          haptics.error();
          return;
        }
        const person = await submit(form, needsConsent ? { parent_consent: consent } : {});
        if (person) onAdded(person, leave);
      }}
    />
  );
}

/**
 * The Family step: the parents in the portal (searched on the server), each described by their
 * children where the balances read knows them, a card per chosen guardian, and "New parent".
 */
function FamilyStep({
  guardians,
  names,
  error,
  onChange,
}: {
  guardians: FormState['guardians'];
  names: Record<string, string>;
  error?: string;
  onChange: (guardians: FormState['guardians'], known: Record<string, string>) => void;
}) {
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 250);
  const parents = useUsers({ role: 'parent', ...(search ? { search } : {}), limit: 100, sort: 'full_name' });
  // Names only: the parent rows carry no children, the balances do. No amount is kept or shown.
  const { organization } = useAuth();
  const balances = useBalances({ enabled: featureAllowed(organization, 'tutoring') });
  const children = useMemo(() => childrenByParent(balances.data?.data.students ?? []), [balances.data]);

  const rows = useMemo(() => parents.data?.data ?? [], [parents.data]);
  const items: SearchPickerItem[] = useMemo(
    () =>
      rows.map((parent) => ({
        id: parent.id,
        title: parent.full_name,
        description: parentLine(children[parent.id], parent.email),
        avatarName: parent.full_name,
      })),
    [children, rows],
  );
  const chosen = guardians.map((link) => link.guardian_user_id);

  const openNewParent = () =>
    router.push({ pathname: '/new-parent', params: query.trim() ? { name: query.trim() } : {} });

  return (
    <SearchPicker
      testID="add-student-parents"
      label="Parents"
      placeholder="Search parents"
      multiple
      value={chosen}
      onChange={(ids) => {
        const known: Record<string, string> = {};
        for (const row of rows) if (ids.includes(row.id)) known[row.id] = row.full_name;
        onChange(reconcileGuardians(guardians, ids), known);
      }}
      items={items}
      query={query}
      onQueryChange={setQuery}
      filter={false}
      loading={parents.isPending}
      emptyTitle={search ? 'No parent matches.' : 'No parents in the portal yet.'}
      emptyBody="Add them as a new parent: they are created first, then chosen here."
      emptyAction={
        <Button
          testID="add-student-new-parent-empty"
          mode="contained"
          icon="account-plus-outline"
          onPress={openNewParent}
          contentStyle={{ minHeight: MIN_TARGET }}
        >
          New parent
        </Button>
      }
      header={
        <View style={{ gap: space.sm }}>
          {error ? <FieldError testID="add-student-family-error">{error}</FieldError> : null}
          {guardians.map((link) => (
            <GuardianLinkCard
              key={link.guardian_user_id}
              link={link}
              name={names[link.guardian_user_id] ?? 'A parent'}
              showPrimary={guardians.length > 1}
              onChange={(patch) => onChange(updateGuardian(guardians, link.guardian_user_id, patch), {})}
              onRemove={() => onChange(removeGuardian(guardians, link.guardian_user_id), {})}
            />
          ))}
          <Button
            testID="add-student-new-parent"
            mode="contained-tonal"
            icon="account-plus-outline"
            style={{ alignSelf: 'flex-start' }}
            contentStyle={{ minHeight: MIN_TARGET }}
            onPress={openNewParent}
          >
            New parent
          </Button>
        </View>
      }
    />
  );
}

function LessonsSummary({ form }: { form: FormState }) {
  const minutes = form.student.max_minutes ? Number(form.student.max_minutes) : null;
  return (
    <Lines
      lines={[
        form.student.virtual_available ? 'In person and online' : 'In person',
        minutes ? `Longest lesson: ${formatDuration(minutes)}` : 'Longest lesson: no limit of their own',
      ]}
    />
  );
}

/** The prices as the server would store them, through the record's own money rows; null when none is set. */
function PriceSummary({ form, today }: { form: FormState; today: string }) {
  const parsed = studentProfileSchema.safeParse(toRequest(form, today).student_profile);
  if (!parsed.success) return null;
  const { charge_rate_in_person_cents: inPerson, charge_rate_virtual_cents: virtual } = parsed.data;
  if (inPerson == null && virtual == null) {
    return <MutedLine>Not set yet: a lesson cannot be recorded until it is.</MutedLine>;
  }
  return (
    <View style={{ gap: space.sm }}>
      <StudentPrices student={parsed.data} />
    </View>
  );
}

export function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <View style={{ gap: 2 }}>
      {lines.map((line) => (
        <Text key={line} variant="bodyMedium">
          {line}
        </Text>
      ))}
    </View>
  );
}

function MutedLine({ children }: { children: string }) {
  const theme = useAppTheme();
  return (
    <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
      {children}
    </Text>
  );
}
