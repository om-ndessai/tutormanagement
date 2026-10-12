// An emitter-backed stand-in for expo-speech-recognition under Jest (mapped in jest.config.js).
// Tests set what the device reports through `speechMock`, then fire recognizer events with `emit`.
type Listener = (event: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };

export const speechMock = {
  available: true,
  onDevice: true,
  installedLocales: ['en-US'] as string[],
  locales: ['en-US', 'en-GB'] as string[],
  defaultService: 'com.google.android.as',
  microphone: { ...granted } as Record<string, unknown>,
  recognizer: { ...granted } as Record<string, unknown>,
  reset() {
    this.available = true;
    this.onDevice = true;
    this.installedLocales = ['en-US'];
    this.locales = ['en-US', 'en-GB'];
    this.defaultService = 'com.google.android.as';
    this.microphone = { ...granted };
    this.recognizer = { ...granted };
    listeners.clear();
    Object.values(ExpoSpeechRecognitionModule).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) (fn as jest.Mock).mockClear();
    });
  },
  emit(name: string, event: unknown = null) {
    for (const listener of [...(listeners.get(name) ?? [])]) listener(event);
  },
};

export const ExpoSpeechRecognitionModule = {
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  isRecognitionAvailable: jest.fn(() => speechMock.available),
  supportsOnDeviceRecognition: jest.fn(() => speechMock.onDevice),
  getSupportedLocales: jest.fn(async () => ({
    locales: speechMock.locales,
    installedLocales: speechMock.installedLocales,
  })),
  getDefaultRecognitionService: jest.fn(() => ({ packageName: speechMock.defaultService })),
  getMicrophonePermissionsAsync: jest.fn(async () => speechMock.microphone),
  requestMicrophonePermissionsAsync: jest.fn(async () => speechMock.microphone),
  getSpeechRecognizerPermissionsAsync: jest.fn(async () => speechMock.recognizer),
  requestSpeechRecognizerPermissionsAsync: jest.fn(async () => speechMock.recognizer),
  getPermissionsAsync: jest.fn(async () => speechMock.recognizer),
  requestPermissionsAsync: jest.fn(async () => speechMock.recognizer),
  androidTriggerOfflineModelDownload: jest.fn(async () => ({ status: 'download_success', message: '' })),
  addListener: jest.fn((name: string, listener: Listener) => {
    const set = listeners.get(name) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(name, set);
    return { remove: () => set.delete(listener) };
  }),
};
