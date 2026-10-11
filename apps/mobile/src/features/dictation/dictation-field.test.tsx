import AsyncStorage from '@react-native-async-storage/async-storage';
import { SSN_REJECTED_MESSAGE } from '@tmi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Alert, AppState, Linking, type AlertButton } from 'react-native';

import { ExpoSpeechRecognitionModule as m, speechMock } from '@/test/mocks/expo-speech-recognition';
import { renderWithProviders } from '@/test/render';
import { DictationField } from './dictation-field';
import { DictationProvider } from './dictation-provider';
import { commitFinal, tooLongMessage } from './use-dictation';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

const native = m as unknown as Record<keyof typeof m, jest.Mock>;
const changes: Record<string, string[]> = {};

function Field({ id, initial = '', max = 2000 }: { id: string; initial?: string; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <DictationField
      testID={id}
      label={id === 'notes' ? 'Session notes' : 'What was planned'}
      value={value}
      maxLength={max}
      onChange={(next) => {
        (changes[id] ??= []).push(next);
        setValue(next);
      }}
    />
  );
}

async function renderFields(fields: { id: string; initial?: string; max?: number }[] = [{ id: 'notes' }]) {
  return renderWithProviders(
    <DictationProvider>
      {fields.map((f) => (
        <Field key={f.id} {...f} />
      ))}
    </DictationProvider>,
  );
}

const result = (transcript: string, isFinal: boolean) => ({
  isFinal,
  results: [{ transcript, confidence: 1 }],
});

async function startListening(id = 'notes') {
  await fireEvent.press(screen.getByTestId(`dictate-${id}`));
  await waitFor(() => expect(native.start).toHaveBeenCalled());
  await act(async () => speechMock.emit('start'));
}

/** The button of the alert on screen with this title, pressed. */
async function pressAlert(title: string, label: string) {
  const call = (Alert.alert as jest.Mock).mock.calls.find((c) => c[0] === title);
  expect(call).toBeDefined();
  const button = (call![2] as AlertButton[]).find((b) => b.text === label);
  await act(async () => button!.onPress!());
}

beforeEach(async () => {
  speechMock.reset();
  for (const key of Object.keys(changes)) delete changes[key];
  await AsyncStorage.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('commitFinal', () => {
  it('appends, and refuses an SSN, one completed across phrases, and an overlong part', () => {
    expect(commitFinal('Fractions.', 'then decimals', 2000)).toEqual({ next: 'Fractions. Then decimals' });
    expect(commitFinal('', 'her number is 123-45-6789', 2000)).toEqual({ refused: SSN_REJECTED_MESSAGE });
    expect(commitFinal('her number is 123-45', '6789', 2000)).toEqual({ refused: SSN_REJECTED_MESSAGE });
    expect(commitFinal('a'.repeat(1995), 'and more', 2000)).toEqual({ refused: tooLongMessage(2000) });
    expect(tooLongMessage(4000)).toBe('That would make this part longer than 4,000 characters.');
  });
});

describe('DictationField', () => {
  it('starts on this phone, shows interim words under the field, and commits the final once', async () => {
    await renderFields();
    await startListening();
    expect(native.start).toHaveBeenCalledWith(expect.objectContaining({ requiresOnDeviceRecognition: true }));
    expect(screen.getByTestId('dictation-interim-notes')).toBeTruthy();
    expect(screen.getByText('Listening… tap the mic to stop')).toBeTruthy();

    await act(async () => speechMock.emit('result', result('factored the', false)));
    expect(screen.getByText('factored the')).toBeTruthy();
    expect(changes.notes).toBeUndefined();

    await act(async () => speechMock.emit('result', result('factored the quadratic', true)));
    expect(changes.notes).toEqual(['Factored the quadratic']);
    expect(screen.getByTestId('notes').props.value).toBe('Factored the quadratic');
  });

  it('labels the mic and flips its state while listening', async () => {
    await renderFields();
    expect(screen.getByLabelText('Dictate Session notes')).toBeTruthy();
    await startListening();
    const stop = screen.getByLabelText('Stop dictating Session notes');
    expect(stop.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(stop);
    expect(native.stop).toHaveBeenCalled();
    await act(async () => speechMock.emit('end'));
    expect(screen.getByLabelText('Dictate Session notes')).toBeTruthy();
  });

  it('masks SSN-shaped interim words, refuses the final, and stops', async () => {
    await renderFields();
    await startListening();
    await act(async () => speechMock.emit('result', result('her number is 123-45-6789', false)));
    expect(screen.queryByText(/123-45-6789/)).toBeNull();
    expect(screen.getByText(SSN_REJECTED_MESSAGE)).toBeTruthy();

    await act(async () => speechMock.emit('result', result('her number is 123-45-6789', true)));
    expect(changes.notes).toBeUndefined();
    expect(native.abort).toHaveBeenCalled();
    await act(async () => {
      speechMock.emit('error', { error: 'aborted', message: '' });
      speechMock.emit('end');
    });
    expect(screen.getByTestId('dictation-error-notes')).toBeTruthy();
    expect(screen.getByText(SSN_REJECTED_MESSAGE)).toBeTruthy();
  });

  it('refuses an SSN split across two phrases', async () => {
    await renderFields();
    await startListening();
    await act(async () => speechMock.emit('result', result('her number is 123-45', true)));
    await act(async () => speechMock.emit('result', result('6789', true)));
    expect(changes.notes).toEqual(['Her number is 123-45']);
    expect(native.abort).toHaveBeenCalled();
  });

  it('refuses a phrase past the field’s length', async () => {
    await renderFields([{ id: 'notes', initial: 'a'.repeat(1998), max: 2000 }]);
    await startListening();
    await act(async () => speechMock.emit('result', result('more words', true)));
    expect(changes.notes).toBeUndefined();
    await act(async () => speechMock.emit('end'));
    expect(screen.getByText(tooLongMessage(2000))).toBeTruthy();
  });

  it('runs one dictation at a time: a second mic stops the first, whose words land in the first', async () => {
    await renderFields([{ id: 'notes' }, { id: 'planned' }]);
    await startListening('notes');
    native.start.mockClear();
    await fireEvent.press(screen.getByTestId('dictate-planned'));
    expect(native.stop).toHaveBeenCalled();
    await act(async () => {
      speechMock.emit('result', result('last words', true));
      speechMock.emit('end');
    });
    expect(changes.notes).toEqual(['Last words']);
    await waitFor(() => expect(native.start).toHaveBeenCalled());
    await act(async () => {
      speechMock.emit('start');
      speechMock.emit('result', result('planned words', true));
    });
    expect(changes.planned).toEqual(['Planned words']);
    expect(changes.notes).toEqual(['Last words']);
  });

  it('aborts when the field goes away, and stops when the app goes to the background', async () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    const view = await renderFields();
    await startListening();
    await act(async () => listeners.forEach((l) => l('background')));
    expect(native.stop).toHaveBeenCalled();
    await view.unmount();
    expect(native.abort).toHaveBeenCalled();
  });

  it('says what a recognizer error means, under the field', async () => {
    await renderFields();
    await startListening();
    await act(async () => {
      speechMock.emit('error', { error: 'no-speech', message: '' });
      speechMock.emit('end');
    });
    expect(screen.getByText("Didn't catch that. Tap the mic and try again.")).toBeTruthy();
  });
});

describe('permissions and the on-device policy', () => {
  it('explains the microphone before the system asks, then listens', async () => {
    speechMock.microphone = { status: 'undetermined', granted: false, canAskAgain: true };
    await renderFields();
    await fireEvent.press(screen.getByTestId('dictate-notes'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Dictate with the microphone',
        expect.any(String),
        expect.any(Array),
        expect.anything(),
      ),
    );
    speechMock.microphone = { status: 'granted', granted: true, canAskAgain: true };
    await pressAlert('Dictate with the microphone', 'Continue');
    await waitFor(() => expect(native.start).toHaveBeenCalled());
    expect(native.requestSpeechRecognizerPermissionsAsync).not.toHaveBeenCalled();
  });

  it('offers Settings when access is off', async () => {
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    speechMock.microphone = { status: 'denied', granted: false, canAskAgain: false };
    await renderFields();
    await fireEvent.press(screen.getByTestId('dictate-notes'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Microphone access is off',
        expect.any(String),
        expect.any(Array),
        expect.anything(),
      ),
    );
    await pressAlert('Microphone access is off', 'Open Settings');
    await waitFor(() => expect(Linking.openSettings).toHaveBeenCalled());
    expect(native.start).not.toHaveBeenCalled();
  });

  it('says Screen Time turned it off, with no Settings button', async () => {
    speechMock.microphone = { status: 'denied', granted: false, canAskAgain: false, restricted: true };
    await renderFields();
    await fireEvent.press(screen.getByTestId('dictate-notes'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Dictation is turned off',
        expect.any(String),
        [expect.objectContaining({ text: 'OK' })],
        expect.anything(),
      ),
    );
  });

  it('asks consent where the phone cannot recognise by itself, and Not now listens to nothing', async () => {
    speechMock.onDevice = false;
    await renderFields();
    await fireEvent.press(screen.getByTestId('dictate-notes'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Dictate online?',
        expect.stringContaining('Apple'),
        expect.any(Array),
        expect.anything(),
      ),
    );
    await pressAlert('Dictate online?', 'Not now');
    await waitFor(() => expect(screen.getByLabelText('Dictate Session notes')).toBeTruthy());
    expect(native.start).not.toHaveBeenCalled();
  });

  it('with consent, listens online and checks iOS speech recognition too', async () => {
    speechMock.onDevice = false;
    await renderFields();
    await fireEvent.press(screen.getByTestId('dictate-notes'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    await pressAlert('Dictate online?', 'Allow on this phone');
    await waitFor(() => expect(native.start).toHaveBeenCalled());
    expect(native.start).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );
    // Online, iOS's speech-recognition permission is checked as well as the microphone.
    expect(native.getSpeechRecognizerPermissionsAsync).toHaveBeenCalled();
  });
});
