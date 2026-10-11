// Dictation's engine (P3, docs/mobile/build-log.md "P3. Dictation — design"). The ONLY file that
// touches `expo-speech-recognition` (scripts/check-mobile-rules.mjs enforces it), so the rules that
// keep a student's lesson on the phone live in one place:
//
// - On this phone first. `requiresOnDeviceRecognition` is always asked for, and `start` REFUSES
//   unless the device itself says it can recognise on-device (and, on Android, has the language's
//   model installed). The library applies the flag on iOS only when the recognizer supports it --
//   otherwise it silently sends the audio to Apple -- so this check is the guard, not the flag.
// - The phone's online speech service only with the person's own consent, kept on this device
//   (`STORAGE_KEYS.dictationNetwork`, the Profile switch), never by default.
// - No audio is ever kept or sent by the app: no recording options and no audio source are ever
//   passed (the library persists nothing unless told to). No transcript is ever logged here.
// - The words the recognizer is nudged towards are a fixed maths list, never people's names.
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { MATH_VOCABULARY } from '@/features/dictation/math-vocabulary';
import { readPref, STORAGE_KEYS, writePref } from './storage';
import { fakeEngine } from './speech-fake';
import { DEV_TOOLS } from './variant';

type SpeechModule = typeof import('expo-speech-recognition');

// Required defensively, as google-sign-in.ts does: a development client built before dictation
// was added has no native module, and the import would throw at load. Dictation is then hidden.
let native: SpeechModule | null = null;
try {
  native = require('expo-speech-recognition') as SpeechModule;
} catch {
  native = null;
}

/** On this phone, or (with consent) through the phone's online speech service. */
export type SpeechMode = 'on-device' | 'network';

/** Whose online service a network dictation would use, for wording the consent. */
export type SpeechService = 'apple' | 'google' | 'other';

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked' | 'restricted';

export type DownloadOutcome = 'download_success' | 'opened_dialog' | 'download_scheduled' | 'failed';

export interface SpeechCapabilities {
  /** A recognizer exists and is switched on. */
  available: boolean;
  /** The device can recognise without the network (iOS on-device; Android 13+ on-device service). */
  onDevice: boolean;
  /** The language's on-device model is there (always true on iOS when `onDevice`). */
  modelInstalled: boolean;
  /** Android: the model can be fetched (`androidTriggerOfflineModelDownload`). */
  canDownloadModel: boolean;
  service: SpeechService;
  /** The locale dictation listens in. */
  lang: string;
}

/** What the recognizer said, normalised. Final text is the only text that ever reaches a field. */
export type SpeechEvent =
  | { type: 'start' }
  | { type: 'interim'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; code: string }
  | { type: 'end' };

export type SpeechListener = (event: SpeechEvent) => void;

/** The fixed options every dictation starts with. Nothing else is ever passed. */
export interface SpeechStartOptions {
  lang: string;
  interimResults: true;
  continuous: true;
  requiresOnDeviceRecognition: boolean;
  addsPunctuation: true;
  iosTaskHint: 'dictation';
  maxAlternatives: 1;
  contextualStrings: string[];
}

/** The engine `speech.ts` drives: the native module, or the scripted fake in dev/e2e builds. */
export interface SpeechEngine {
  capabilities(): Promise<SpeechCapabilities>;
  permission(mode: SpeechMode): Promise<PermissionState>;
  requestPermission(mode: SpeechMode): Promise<PermissionState>;
  downloadModel(lang: string): Promise<DownloadOutcome>;
  start(options: SpeechStartOptions): void;
  stop(): void;
  abort(): void;
  subscribe(listener: SpeechListener): () => void;
}

const DEFAULT_LANG = 'en-US';

/** Every dictation's options: on-device unless consented otherwise, maths words, no audio kept. */
export function startOptions(mode: SpeechMode, lang: string): SpeechStartOptions {
  return {
    lang,
    interimResults: true,
    continuous: true,
    requiresOnDeviceRecognition: mode === 'on-device',
    addsPunctuation: true,
    iosTaskHint: 'dictation',
    maxAlternatives: 1,
    contextualStrings: [...MATH_VOCABULARY],
  };
}

const sameLocale = (a: string, b: string) =>
  a.replace('_', '-').toLowerCase() === b.replace('_', '-').toLowerCase();

/**
 * The locale to listen in: the device's first English locale that is installed (else supported),
 * else en-US. Dictation is English-only for now -- the vocabulary is.
 */
export function chooseLang(deviceTags: string[], installed: string[], supported: string[]): string {
  const english = deviceTags.filter((tag) => /^en([-_]|$)/i.test(tag));
  for (const pool of [installed, supported]) {
    const hit = english.find((tag) => pool.some((p) => sameLocale(p, tag)));
    if (hit) return hit;
  }
  return english.find((tag) => tag.includes('-')) ?? DEFAULT_LANG;
}

/** A permission answer as the dialogs need it. iOS reports a refusal as never askable again. */
export function toPermissionState(response: {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  restricted?: boolean;
}): PermissionState {
  if (response.restricted) return 'restricted';
  if (response.granted) return 'granted';
  if (response.status === 'undetermined') return 'undetermined';
  return response.canAskAgain ? 'denied' : 'blocked';
}

function deviceLocaleTags(): string[] {
  try {
    return getLocales().map((locale) => locale.languageTag);
  } catch {
    return [];
  }
}

function createNativeEngine(module: SpeechModule): SpeechEngine {
  const m = module.ExpoSpeechRecognitionModule;
  const isAndroid = () => Platform.OS === 'android';
  return {
    async capabilities() {
      const android = isAndroid();
      let available = false;
      let onDevice = false;
      try {
        available = m.isRecognitionAvailable();
        // The library's on-device path on Android needs 13 (API 33); before that it is network only.
        onDevice = m.supportsOnDeviceRecognition() && (!android || Number(Platform.Version) >= 33);
      } catch {
        available = false;
      }
      let installed: string[] = [];
      let supported: string[] = [];
      if (available) {
        try {
          const locales = await m.getSupportedLocales({});
          installed = locales.installedLocales ?? [];
          supported = locales.locales ?? [];
        } catch {
          // Unknown: the model counts as missing on Android, which offers the download.
        }
      }
      const lang = chooseLang(deviceLocaleTags(), installed, supported);
      let service: SpeechService = android ? 'other' : 'apple';
      if (android) {
        try {
          if (m.getDefaultRecognitionService().packageName.startsWith('com.google')) service = 'google';
        } catch {
          // No default service: worded as "your phone's speech service".
        }
      }
      return {
        available,
        onDevice,
        // iOS's on-device model is a system asset; Android's is per language.
        modelInstalled: onDevice && (!android || installed.some((tag) => sameLocale(tag, lang))),
        canDownloadModel: android && onDevice,
        service,
        lang,
      };
    },
    async permission(mode) {
      const android = isAndroid();
      const microphone = toPermissionState(await m.getMicrophonePermissionsAsync());
      if (microphone !== 'granted' || mode === 'on-device' || android) return microphone;
      return toPermissionState(await m.getSpeechRecognizerPermissionsAsync());
    },
    async requestPermission(mode) {
      const android = isAndroid();
      // On this phone the microphone alone suffices: iOS's speech authorization alert says speech
      // "will be sent to Apple", which would not be true. It is asked for only with consent.
      const microphone = toPermissionState(await m.requestMicrophonePermissionsAsync());
      if (microphone !== 'granted' || mode === 'on-device' || android) return microphone;
      return toPermissionState(await m.requestSpeechRecognizerPermissionsAsync());
    },
    async downloadModel(lang) {
      try {
        return (await m.androidTriggerOfflineModelDownload({ locale: lang })).status;
      } catch {
        return 'failed';
      }
    },
    start(options) {
      m.start(options);
    },
    stop() {
      m.stop();
    },
    abort() {
      m.abort();
    },
    subscribe(listener) {
      const subscriptions = [
        m.addListener('start', () => listener({ type: 'start' })),
        m.addListener('result', (event) => {
          const text = event.results[0]?.transcript ?? '';
          listener(event.isFinal ? { type: 'final', text } : { type: 'interim', text });
        }),
        m.addListener('error', (event) => listener({ type: 'error', code: event.error })),
        m.addListener('end', () => listener({ type: 'end' })),
      ];
      return () => subscriptions.forEach((subscription) => subscription.remove());
    },
  };
}

const nativeEngine = native ? createNativeEngine(native) : null;

/** The engine in use: the scripted fake while a dev build has it armed, else the native module. */
export function speechEngine(): SpeechEngine | null {
  if (DEV_TOOLS && fakeEngine.armed()) return fakeEngine;
  return nativeEngine;
}

/** Whether this build can dictate at all (a development client built before P3 cannot). */
export function dictationSupported(): boolean {
  return speechEngine() !== null;
}

// ---------------------------------------------------------------------------
// The consent to the phone's online speech service: per device, off by default.
// ---------------------------------------------------------------------------

export async function networkConsent(): Promise<boolean> {
  return (await readPref(STORAGE_KEYS.dictationNetwork)) === 'on';
}

export async function setNetworkConsent(on: boolean): Promise<void> {
  await writePref(STORAGE_KEYS.dictationNetwork, on ? 'on' : null);
}

// ---------------------------------------------------------------------------
// Deciding how (and whether) to dictate, then starting.
// ---------------------------------------------------------------------------

export type DictationPlan =
  | { kind: 'ready'; mode: SpeechMode; capabilities: SpeechCapabilities }
  /**
   * Android can dictate on this phone once the language's model is downloaded. Offered first, even
   * with consent to the online service (`consent`), which "Not now" then falls back to.
   */
  | { kind: 'needs-model'; capabilities: SpeechCapabilities; consent: boolean }
  /** Only the online service could do it, and the person has not agreed to that here. */
  | { kind: 'needs-consent'; capabilities: SpeechCapabilities }
  | { kind: 'unavailable' };

/** On this phone when it can; online only with consent; never quietly online. */
export function decide(capabilities: SpeechCapabilities, consent: boolean): DictationPlan {
  if (!capabilities.available) return { kind: 'unavailable' };
  if (capabilities.onDevice && capabilities.modelInstalled) {
    return { kind: 'ready', mode: 'on-device', capabilities };
  }
  if (capabilities.onDevice && capabilities.canDownloadModel) {
    return { kind: 'needs-model', capabilities, consent };
  }
  if (consent) return { kind: 'ready', mode: 'network', capabilities };
  return { kind: 'needs-consent', capabilities };
}

export async function plan(): Promise<DictationPlan> {
  const engine = speechEngine();
  if (!engine) return { kind: 'unavailable' };
  return decide(await engine.capabilities(), await networkConsent());
}

export class DictationRefused extends Error {
  constructor(readonly reason: 'needs-consent' | 'needs-model' | 'unavailable') {
    super(reason);
    this.name = 'DictationRefused';
  }
}

/**
 * Starts listening in `mode`, re-checking the policy first: an on-device start on a device that
 * cannot is refused (never sent online instead), and an online start without consent is refused.
 */
export async function start(mode: SpeechMode): Promise<void> {
  const engine = speechEngine();
  if (!engine) throw new DictationRefused('unavailable');
  const capabilities = await engine.capabilities();
  if (!capabilities.available) throw new DictationRefused('unavailable');
  if (mode === 'on-device' && !(capabilities.onDevice && capabilities.modelInstalled)) {
    throw new DictationRefused(capabilities.onDevice ? 'needs-model' : 'needs-consent');
  }
  if (mode === 'network' && !(await networkConsent())) throw new DictationRefused('needs-consent');
  engine.start(startOptions(mode, capabilities.lang));
}

export function stop(): void {
  speechEngine()?.stop();
}

export function abort(): void {
  speechEngine()?.abort();
}

export function subscribe(listener: SpeechListener): () => void {
  return speechEngine()?.subscribe(listener) ?? (() => undefined);
}

export async function permission(mode: SpeechMode): Promise<PermissionState> {
  return (await speechEngine()?.permission(mode)) ?? 'blocked';
}

export async function requestPermission(mode: SpeechMode): Promise<PermissionState> {
  return (await speechEngine()?.requestPermission(mode)) ?? 'blocked';
}

export async function downloadModel(lang: string): Promise<DownloadOutcome> {
  return (await speechEngine()?.downloadModel(lang)) ?? 'failed';
}
