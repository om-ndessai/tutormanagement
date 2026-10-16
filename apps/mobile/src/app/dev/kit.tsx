// Developer-only: the surface kit's StepFlow, with a SearchPicker step and a Review, so the kit can
// be seen and flowed on both platforms before a real flow uses it (UI upgrades U2).
//   aimtrue://dev/kit  -- full-screen modal. A note of "server" makes the finish fail the way the
//   server does, naming the first step's field, so the jump back can be checked.
// Static, made-up rows: no request, no organization. Absent from production (DEV_TOOLS).
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { SearchPicker, type SearchPickerItem } from '@/components/search-picker';
import { StepFlow, type StepDef } from '@/components/step-flow';
import { useDirty } from '@/hooks/use-unsaved-changes';
import { DEV_TOOLS } from '@/lib/variant';

const PEOPLE: SearchPickerItem[] = [
  { id: 'a', title: 'Avery Example', description: 'Parent of two', avatarName: 'Avery Example' },
  { id: 'b', title: 'Blake Sample', description: 'Parent of one', avatarName: 'Blake Sample' },
  { id: 'c', title: 'Casey Demo', description: 'Guardian', avatarName: 'Casey Demo' },
  { id: 'd', title: 'Drew Placeholder', description: 'Parent of one', avatarName: 'Drew Placeholder' },
  { id: 'e', title: 'Emery Specimen', description: 'Parent of three', avatarName: 'Emery Specimen' },
];

interface Draft {
  person: string | null;
  name: string;
  note: string;
}

const INITIAL: Draft = { person: null, name: '', note: '' };

export default function DevKit() {
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useDirty(draft);
  if (!DEV_TOOLS) return <Redirect href="/" />;

  const set = (patch: Partial<Draft>) => {
    setDraft((was) => ({ ...was, ...patch }));
    setFieldErrors(null);
  };

  const steps: StepDef<Draft>[] = [
    {
      key: 'person',
      title: 'Who is it for?',
      description: 'Choose one person.',
      fields: ['person'],
      scroll: false,
      validate: (value) => (value.person ? null : { person: 'Choose someone to carry on.' }),
      render: ({ draft: value, errors }) => (
        <SearchPicker
          items={PEOPLE}
          value={value.person}
          onChange={(person) => set({ person })}
          placeholder="Search people"
          label="People"
          emptyTitle="Nobody matches."
          header={errors.person ? <FieldError testID="kit-person-error">{errors.person}</FieldError> : null}
        />
      ),
      summary: (value) => PEOPLE.find((person) => person.id === value.person)?.title ?? null,
    },
    {
      key: 'name',
      title: 'A few details',
      fields: ['name'],
      validate: (value) => (value.name.trim() ? null : { name: 'Enter a name.' }),
      render: ({ draft: value, errors }) => (
        <>
          <TextInput
            testID="kit-name"
            mode="outlined"
            label="Name"
            value={value.name}
            onChangeText={(name) => set({ name })}
            error={Boolean(errors.name)}
          />
          {errors.name ? <FieldError testID="kit-name-error">{errors.name}</FieldError> : null}
        </>
      ),
      summary: (value) => value.name || null,
    },
    {
      key: 'note',
      title: 'Anything else?',
      description: 'Optional.',
      optional: true,
      onSkip: () => set({ note: '' }),
      render: ({ draft: value }) => (
        <TextInput
          testID="kit-note"
          mode="outlined"
          label="Note"
          value={value.note}
          onChangeText={(note) => set({ note })}
          multiline
        />
      ),
      summary: (value) => value.note || null,
    },
  ];

  return (
    <StepFlow
      title="Surface kit"
      steps={steps}
      draft={draft}
      review={{}}
      submitLabel="Finish"
      dirty={dirty}
      submitting={submitting}
      fieldErrors={fieldErrors}
      onSubmit={async ({ leave }) => {
        setSubmitting(true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSubmitting(false);
        if (draft.note.trim() === 'server') {
          setFieldErrors({ person: ['The server refused this person.'] });
          return;
        }
        leave(() => router.back());
      }}
    />
  );
}
