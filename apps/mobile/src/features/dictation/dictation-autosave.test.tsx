// Dictation with the record sheet's 3-second autosave and its submit (P3): only settled text is ever
// in the body a tick sends, and a submit pressed mid-dictation waits for the last words.
import type { SessionDraftInput } from '@tmi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { useDraftAutosave } from '@/features/teaching/session-form/use-draft-autosave';
import { emptyForm, formBody, useSessionForm } from '@/features/teaching/session-form/use-session-form';
import { ExpoSpeechRecognitionModule as m, speechMock } from '@/test/mocks/expo-speech-recognition';
import { renderWithProviders } from '@/test/render';
import { DictationField } from './dictation-field';
import { DictationProvider, useDictationSession } from './dictation-provider';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

const native = m as unknown as Record<keyof typeof m, jest.Mock>;
const pair = {
  tutor_user_id: '00000000-0000-4000-8000-000000000003',
  student_user_id: '00000000-0000-4000-8000-000000000009',
};
const saved: SessionDraftInput[] = [];
const submitted: SessionDraftInput[] = [];

/** The record sheet's wiring, cut down: one dictated field, the autosave, and Record. */
function Sheet() {
  const { values, set, current } = useSessionForm(() => emptyForm('2026-10-08', []));
  const dictation = useDictationSession();
  useDraftAutosave({
    enabled: true,
    getBody: () => (current().notes ? (formBody(current(), pair) as SessionDraftInput) : null),
    save: async (id, input) => {
      saved.push(input);
      return { data: { id: id ?? 'draft-1' } };
    },
    onInvalid: () => undefined,
    onValid: () => undefined,
  });
  async function record() {
    await dictation.stopAndFlush();
    submitted.push(formBody(current(), pair) as SessionDraftInput);
  }
  return (
    <>
      <DictationField
        testID="record-notes"
        label="Session notes"
        value={values.notes}
        onChange={(text) => set('notes', text)}
        maxLength={4000}
      />
      <Pressable testID="record-submit" onPress={() => void record()}>
        <Text>Record session</Text>
      </Pressable>
    </>
  );
}

const result = (transcript: string, isFinal: boolean) => ({
  isFinal,
  results: [{ transcript, confidence: 1 }],
});

beforeEach(() => {
  speechMock.reset();
  saved.length = 0;
  submitted.length = 0;
  jest.useFakeTimers();
});

afterEach(() => jest.useRealTimers());

async function listen() {
  await renderWithProviders(
    <DictationProvider>
      <Sheet />
    </DictationProvider>,
  );
  await fireEvent.press(screen.getByTestId('dictate-record-notes'));
  await waitFor(() => expect(native.start).toHaveBeenCalled());
  await act(async () => speechMock.emit('start'));
}

it('autosaves settled words only: a tick during interim words sends nothing of them', async () => {
  await listen();
  await act(async () => speechMock.emit('result', result('long division', true)));
  await act(async () => speechMock.emit('result', result('then frac', false)));
  await act(async () => jest.advanceTimersByTime(3000));
  expect(saved.map((b) => b.notes)).toEqual(['Long division']);

  await act(async () => speechMock.emit('result', result('then fractions', true)));
  await act(async () => jest.advanceTimersByTime(3000));
  expect(saved.map((b) => b.notes)).toEqual(['Long division', 'Long division then fractions']);
});

it('Record pressed while listening waits for the last words', async () => {
  await listen();
  await act(async () => speechMock.emit('result', result('factored by', false)));
  await fireEvent.press(screen.getByTestId('record-submit'));
  expect(native.stop).toHaveBeenCalled();
  expect(submitted).toEqual([]);
  await act(async () => {
    speechMock.emit('result', result('factored by grouping', true));
    speechMock.emit('end');
  });
  await waitFor(() => expect(submitted).toHaveLength(1));
  expect(submitted[0]!.notes).toBe('Factored by grouping');
});

it('an SSN never reaches a tick', async () => {
  await listen();
  await act(async () => speechMock.emit('result', result('her number is 123-45-6789', true)));
  await act(async () => jest.advanceTimersByTime(3000));
  expect(saved).toEqual([]);
});
