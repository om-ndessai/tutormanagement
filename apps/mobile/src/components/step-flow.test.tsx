// StepFlow (UI upgrades U2): steps move forward only when they validate, optional steps skip, the
// Review step edits and comes back, and a server refusal opens the step that owns its field. Design 61
// added the final action's own testID and content after the Review's cards.
import { fireEvent, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Text, TextInput } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { firstMessages, StepFlow, stepForFields, type StepDef } from './step-flow';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true },
  useNavigation: () => ({ isFocused: () => true }),
}));

interface Draft {
  name: string;
  note: string;
}

const STEPS: StepDef<Draft>[] = [
  {
    key: 'name',
    title: 'Who is it?',
    fields: ['full_name'],
    validate: (draft) => (draft.name.trim() ? null : { full_name: 'Enter a name.' }),
    render: ({ errors }) => (errors.full_name ? <Text>{errors.full_name}</Text> : null),
    summary: (draft) => draft.name || null,
  },
  {
    key: 'note',
    title: 'Anything else?',
    optional: true,
    fields: ['notes'],
    render: ({ errors }) => (errors.notes ? <Text>{errors.notes}</Text> : null),
    summary: (draft) => draft.note || null,
  },
];

function Harness({
  onSubmit = jest.fn(),
  refuse = null,
  review = true,
  submitTestID,
  trail,
}: {
  onSubmit?: jest.Mock;
  /** What the "server" answers to a submit, as `details.fieldErrors`. */
  refuse?: Record<string, string[]> | null;
  review?: boolean;
  submitTestID?: string;
  trail?: (draft: Draft) => ReactNode;
}) {
  const [draft, setDraft] = useState<Draft>({ name: '', note: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const steps = STEPS.map((step) => ({
    ...step,
    render: (context: Parameters<StepDef<Draft>['render']>[0]) => (
      <>
        <TextInput
          testID={`input-${step.key}`}
          value={step.key === 'name' ? draft.name : draft.note}
          onChangeText={(text) =>
            setDraft((was) => (step.key === 'name' ? { ...was, name: text } : { ...was, note: text }))
          }
        />
        {step.render(context)}
      </>
    ),
  }));
  return (
    <StepFlow
      title="Add someone"
      steps={steps}
      draft={draft}
      review={review ? { trail } : false}
      submitLabel="Add"
      submitTestID={submitTestID}
      onSubmit={(done) => {
        onSubmit(done);
        if (refuse) setFieldErrors(refuse);
      }}
      fieldErrors={fieldErrors}
      dirty={false}
    />
  );
}

beforeEach(() => mockBack.mockClear());

test('Next is refused until the step validates, and its message goes as it is fixed', async () => {
  await renderWithProviders(<Harness />);
  expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  expect(screen.getByText('Cancel')).toBeTruthy();
  expect(screen.queryByTestId('step-flow-skip')).toBeNull();

  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText('Enter a name.')).toBeTruthy();
  expect(screen.getByText('Step 1 of 3')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  expect(screen.queryByText('Enter a name.')).toBeNull();
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  expect(screen.getByText('Back')).toBeTruthy();
});

test('Cancel on the first step leaves; Back on a later one goes back a step', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-back'));
  expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('step-flow-back'));
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test('an optional step skips to the Review, which edits a step and comes back to it', async () => {
  const onSubmit = jest.fn();
  await renderWithProviders(<Harness onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));

  expect(screen.getByTestId('step-flow-review')).toBeTruthy();
  expect(screen.getByText('Step 3 of 3')).toBeTruthy();
  expect(screen.getByText('Robin')).toBeTruthy();
  expect(screen.getByText('Nothing added')).toBeTruthy();
  expect(screen.getByText('Add')).toBeTruthy();

  // Edit jumps to the step; its primary returns straight to the Review.
  await fireEvent.press(screen.getByTestId('step-flow-edit-name'));
  expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  expect(screen.getByText('Back to review')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin Hale');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByTestId('step-flow-review')).toBeTruthy();
  expect(screen.getByText('Robin Hale')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toEqual({ leave: expect.any(Function) });
});

test('a step edited from the Review is checked again before it goes back', async () => {
  const onSubmit = jest.fn();
  await renderWithProviders(<Harness onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  await fireEvent.press(screen.getByTestId('step-flow-edit-name'));
  await fireEvent.changeText(screen.getByTestId('input-name'), '');
  // "Back to review" is refused on the step itself.
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText('Enter a name.')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a server refusal opens the step that owns the field, with the server's words", async () => {
  await renderWithProviders(<Harness refuse={{ full_name: ['That name is taken.'] }} />);
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  await fireEvent.press(screen.getByTestId('step-flow-next'));

  expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  expect(screen.getByText('That name is taken.')).toBeTruthy();
  // Fixed, it goes straight back to the Review to try again.
  expect(screen.getByText('Back to review')).toBeTruthy();
});

test('without a Review, the last step finishes the flow', async () => {
  const onSubmit = jest.fn();
  await renderWithProviders(<Harness onSubmit={onSubmit} review={false} />);
  expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(screen.getByText('Add')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('stepForFields and firstMessages read the server shape', () => {
  expect(stepForFields(STEPS, ['notes'])).toBe(1);
  expect(stepForFields(STEPS, ['full_name', 'notes'])).toBe(0);
  expect(stepForFields(STEPS, ['email'])).toBe(-1);
  expect(firstMessages({ full_name: ['Taken', 'Too long'], notes: 'No', email: undefined })).toEqual({
    full_name: 'Taken',
    notes: 'No',
  });
  expect(firstMessages(null)).toEqual({});
});

test('the final action takes its own testID, and the Review shows what follows its cards', async () => {
  const onSubmit = jest.fn();
  await renderWithProviders(
    <Harness
      onSubmit={onSubmit}
      submitTestID="game-create"
      trail={(draft) => <Text testID="trail">{`After ${draft.name}`}</Text>}
    />,
  );
  // Not on an earlier step: there the primary is Next as ever.
  expect(screen.queryByTestId('game-create')).toBeNull();
  expect(screen.queryByTestId('trail')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('input-name'), 'Robin');
  await fireEvent.press(screen.getByTestId('step-flow-next'));
  await fireEvent.press(screen.getByTestId('step-flow-skip'));
  expect(screen.getByTestId('step-flow-review')).toBeTruthy();
  expect(screen.getByTestId('trail')).toHaveTextContent('After Robin');
  expect(screen.queryByTestId('step-flow-next')).toBeNull();
  await fireEvent.press(screen.getByTestId('game-create'));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
