// Dictation's questions before the first word (P3, "Permission flow"): the model download, the
// consent to the phone's online speech service, our rationale before the system's microphone
// prompt, Open Settings after a refusal, and "turned off by Screen Time". Native alerts, as the
// live lesson's permission rationale is: they present over the record sheet, which a Paper dialog
// (portalled under the native sheet) cannot.
import { Alert, Linking } from 'react-native';

import {
  downloadModel,
  permission,
  plan,
  requestPermission,
  setNetworkConsent,
  type SpeechMode,
  type SpeechService,
} from '@/lib/speech';
import {
  BLOCKED,
  CONSENT,
  MODEL,
  OFFLINE_MESSAGE,
  RATIONALE,
  RESTRICTED,
  UNAVAILABLE_MESSAGE,
} from './dictation-copy';

type Choice = { label: string; style?: 'cancel' | 'default'; value: boolean };

function ask(title: string, message: string, choices: Choice[]): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      choices.map((choice) => ({
        text: choice.label,
        style: choice.style ?? 'default',
        onPress: () => resolve(choice.value),
      })),
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function askConsent(service: SpeechService): Promise<boolean> {
  return ask(CONSENT.title, CONSENT.message(service), [
    { label: 'Not now', style: 'cancel', value: false },
    { label: 'Allow on this phone', value: true },
  ]);
}

function askModel(): Promise<boolean> {
  return ask(MODEL.title, MODEL.message, [
    { label: 'Not now', style: 'cancel', value: false },
    { label: 'Download', value: true },
  ]);
}

function askRationale(mode: SpeechMode): Promise<boolean> {
  return ask(RATIONALE.title, RATIONALE.message(mode), [
    { label: 'Not now', style: 'cancel', value: false },
    { label: 'Continue', value: true },
  ]);
}

async function offerSettings(): Promise<void> {
  const open = await ask(BLOCKED.title, BLOCKED.message, [
    { label: 'Not now', style: 'cancel', value: false },
    { label: 'Open Settings', value: true },
  ]);
  if (open) void Linking.openSettings();
}

function sayRestricted(): Promise<boolean> {
  return ask(RESTRICTED.title, RESTRICTED.message, [{ label: 'OK', value: false }]);
}

export type Readiness =
  | { ok: true; mode: SpeechMode }
  /** Not dictating; `message` (if any) goes under the field. */
  | { ok: false; message?: string };

/**
 * Everything between a mic tap and listening: decides on-device or (with consent) online, asks what
 * must be asked, and answers whether to start. Never starts online without the person's consent.
 */
export async function prepareDictation({ offline }: { offline: boolean }): Promise<Readiness> {
  let decided = await plan();
  let mode: SpeechMode | null = null;

  if (decided.kind === 'unavailable') return { ok: false, message: UNAVAILABLE_MESSAGE };

  if (decided.kind === 'needs-model') {
    if (await askModel()) {
      const outcome = await downloadModel(decided.capabilities.lang);
      if (outcome === 'download_scheduled') {
        await ask(MODEL.title, MODEL.scheduled, [{ label: 'OK', value: false }]);
        return { ok: false };
      }
      if (outcome === 'opened_dialog') return { ok: false };
      if (outcome === 'failed') return { ok: false, message: UNAVAILABLE_MESSAGE };
      decided = await plan();
      if (decided.kind === 'ready') mode = decided.mode;
      else return { ok: false };
    } else if (decided.consent) {
      mode = 'network';
    } else {
      return { ok: false };
    }
  } else if (decided.kind === 'needs-consent') {
    if (!(await askConsent(decided.capabilities.service))) return { ok: false };
    await setNetworkConsent(true);
    mode = 'network';
  } else {
    mode = decided.mode;
  }

  if (mode === 'network' && offline) return { ok: false, message: OFFLINE_MESSAGE };

  let state = await permission(mode);
  if (state === 'undetermined' || state === 'denied') {
    if (!(await askRationale(mode))) return { ok: false };
    state = await requestPermission(mode);
  }
  if (state === 'granted') return { ok: true, mode };
  if (state === 'blocked') await offerSettings();
  else if (state === 'restricted') await sayRestricted();
  return { ok: false };
}
