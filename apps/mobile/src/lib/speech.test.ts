import AsyncStorage from '@react-native-async-storage/async-storage';
// The mapped mock (jest.config.js): the same module the app's `require('expo-speech-recognition')` gets.
import { ExpoSpeechRecognitionModule as m, speechMock } from '@/test/mocks/expo-speech-recognition';
import { Platform } from 'react-native';

import { MATH_VOCABULARY } from '@/features/dictation/math-vocabulary';
import {
  chooseLang,
  decide,
  DictationRefused,
  permission,
  plan,
  requestPermission,
  setNetworkConsent,
  start,
  startOptions,
  subscribe,
  toPermissionState,
  type SpeechCapabilities,
  type SpeechEvent,
} from './speech';
import { fakeEngine } from './speech-fake';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));

const mock = speechMock;
const native = m as unknown as Record<keyof typeof m, jest.Mock>;

function onPlatform(os: 'ios' | 'android', version: number | string = 35) {
  jest.replaceProperty(Platform, 'OS', os);
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version as never);
}

beforeEach(async () => {
  mock.reset();
  fakeEngine.disarm();
  await AsyncStorage.clear();
  onPlatform('ios', '27.0');
});

afterEach(() => jest.restoreAllMocks());

const caps = (over: Partial<SpeechCapabilities> = {}): SpeechCapabilities => ({
  available: true,
  onDevice: true,
  modelInstalled: true,
  canDownloadModel: false,
  service: 'apple',
  lang: 'en-US',
  ...over,
});

describe('start options', () => {
  it('asks for on-device recognition, maths words, and never any audio', () => {
    const options = startOptions('on-device', 'en-US');
    expect(options).toEqual({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
      maxAlternatives: 1,
      contextualStrings: [...MATH_VOCABULARY],
    });
    expect(options).not.toHaveProperty('recordingOptions');
    expect(options).not.toHaveProperty('audioSource');
    expect(startOptions('network', 'en-GB').requiresOnDeviceRecognition).toBe(false);
  });

  it('keeps the vocabulary within Apple’s 100 short phrases', () => {
    expect(MATH_VOCABULARY.length).toBeLessThanOrEqual(100);
    expect(new Set(MATH_VOCABULARY).size).toBe(MATH_VOCABULARY.length);
    for (const phrase of MATH_VOCABULARY) expect(phrase.split(/\s+/).length).toBeLessThanOrEqual(4);
  });

  it('starts the native module with exactly those options on a capable iPhone', async () => {
    await start('on-device');
    expect(native.start).toHaveBeenCalledWith(startOptions('on-device', 'en-US'));
  });
});

describe('the on-device policy', () => {
  it('refuses to start on-device where the phone cannot (the library would go online)', async () => {
    mock.onDevice = false;
    await expect(start('on-device')).rejects.toEqual(new DictationRefused('needs-consent'));
    expect(native.start).not.toHaveBeenCalled();
  });

  it('refuses to start online without consent', async () => {
    mock.onDevice = false;
    await expect(start('network')).rejects.toBeInstanceOf(DictationRefused);
    expect(native.start).not.toHaveBeenCalled();
  });

  it('with consent, starts online and says so', async () => {
    mock.onDevice = false;
    await setNetworkConsent(true);
    expect(await plan()).toMatchObject({ kind: 'ready', mode: 'network' });
    await start('network');
    expect(native.start).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );
  });

  it('decides on-device first, then the model, then consent', () => {
    expect(decide(caps(), false)).toMatchObject({ kind: 'ready', mode: 'on-device' });
    expect(decide(caps({ onDevice: false, modelInstalled: false }), false)).toMatchObject({
      kind: 'needs-consent',
    });
    expect(decide(caps({ modelInstalled: false, canDownloadModel: true }), true)).toMatchObject({
      kind: 'needs-model',
      consent: true,
    });
    expect(decide(caps({ available: false }), true)).toEqual({ kind: 'unavailable' });
  });

  it('on Android, needs the language model installed, and offers it', async () => {
    onPlatform('android', 35);
    mock.installedLocales = [];
    expect(await plan()).toMatchObject({ kind: 'needs-model', consent: false });
    await expect(start('on-device')).rejects.toEqual(new DictationRefused('needs-model'));
    mock.installedLocales = ['en_US'];
    expect(await plan()).toMatchObject({ kind: 'ready', mode: 'on-device' });
  });

  it('on Android 12, has no on-device path at all', async () => {
    onPlatform('android', 32);
    expect(await plan()).toMatchObject({ kind: 'needs-consent' });
  });

  it('names Google only when the default service is Google’s', async () => {
    onPlatform('android', 32);
    expect(await plan()).toMatchObject({ capabilities: { service: 'google' } });
    mock.defaultService = 'com.samsung.android.bixby';
    expect(await plan()).toMatchObject({ capabilities: { service: 'other' } });
  });
});

describe('permissions', () => {
  it('asks for the microphone only, on this phone', async () => {
    mock.microphone = { status: 'undetermined', granted: false, canAskAgain: true };
    expect(await permission('on-device')).toBe('undetermined');
    mock.microphone = { status: 'granted', granted: true, canAskAgain: true };
    expect(await requestPermission('on-device')).toBe('granted');
    expect(native.requestMicrophonePermissionsAsync).toHaveBeenCalled();
    expect(native.requestSpeechRecognizerPermissionsAsync).not.toHaveBeenCalled();
  });

  it('online on iOS, also asks for speech recognition', async () => {
    mock.recognizer = { status: 'denied', granted: false, canAskAgain: false };
    expect(await requestPermission('network')).toBe('blocked');
    expect(native.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalled();
  });

  it('maps every answer to the dialog it needs', () => {
    expect(toPermissionState({ status: 'granted', granted: true, canAskAgain: true })).toBe('granted');
    expect(toPermissionState({ status: 'undetermined', granted: false, canAskAgain: true })).toBe(
      'undetermined',
    );
    expect(toPermissionState({ status: 'denied', granted: false, canAskAgain: true })).toBe('denied');
    expect(toPermissionState({ status: 'denied', granted: false, canAskAgain: false })).toBe('blocked');
    expect(
      toPermissionState({ status: 'denied', granted: false, canAskAgain: false, restricted: true }),
    ).toBe('restricted');
  });
});

describe('events', () => {
  it('normalises the recognizer events, interim and final apart', () => {
    const seen: SpeechEvent[] = [];
    const unsubscribe = subscribe((event) => seen.push(event));
    mock.emit('start');
    mock.emit('result', { isFinal: false, results: [{ transcript: 'factor the', confidence: 0 }] });
    mock.emit('result', { isFinal: true, results: [{ transcript: 'factor the quadratic', confidence: 1 }] });
    mock.emit('error', { error: 'no-speech', message: '' });
    mock.emit('end');
    unsubscribe();
    mock.emit('end');
    expect(seen).toEqual([
      { type: 'start' },
      { type: 'interim', text: 'factor the' },
      { type: 'final', text: 'factor the quadratic' },
      { type: 'error', code: 'no-speech' },
      { type: 'end' },
    ]);
  });
});

describe('the locale', () => {
  it('prefers an installed English locale, then a supported one, then en-US', () => {
    expect(chooseLang(['fr-FR', 'en-GB', 'en-US'], ['en-US'], ['en-GB', 'en-US'])).toBe('en-US');
    expect(chooseLang(['en-GB'], [], ['en-GB'])).toBe('en-GB');
    expect(chooseLang(['fr-FR'], [], [])).toBe('en-US');
  });
});

describe('the fake recognizer (dev builds)', () => {
  it('replaces the native module while armed, and its options are the same', async () => {
    fakeEngine.arm({
      segments: ['hello'],
      permission: 'granted',
      onDevice: true,
      modelInstalled: true,
      error: null,
      interimMs: 400,
    });
    await start('on-device');
    expect(native.start).not.toHaveBeenCalled();
    expect(fakeEngine.lastOptions()).toEqual(startOptions('on-device', 'en-US'));
    fakeEngine.disarm();
  });

  it('refuses on-device where the script says the phone cannot', async () => {
    fakeEngine.arm({
      segments: [],
      permission: 'granted',
      onDevice: false,
      modelInstalled: true,
      error: null,
      interimMs: 400,
    });
    await expect(start('on-device')).rejects.toBeInstanceOf(DictationRefused);
    fakeEngine.disarm();
  });
});
