// Dictation's words (P3): what each recognizer error says under the field, and the sentences the
// dialogs use. Inline, never a toast -- a form sheet covers the app's toasts.
import type { SpeechMode, SpeechService } from '@/lib/speech';

export const UNAVAILABLE_MESSAGE =
  "Dictation isn't available on this phone. On iPhone, turn on Siri & Dictation in Settings; on Android, check the speech service is installed and on.";
export const OFFLINE_MESSAGE =
  'Dictation needs a connection on this phone. Type instead, or try again online.';
export const LISTENING_HINT = 'Listening… tap the mic to stop';

/** The line under the field for a recognizer error; null when it says nothing (a deliberate abort). */
export function errorMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'no-speech':
    case 'speech-timeout':
      return "Didn't catch that. Tap the mic and try again.";
    case 'audio-capture':
    case 'interrupted':
      return 'The microphone stopped (a call or another app?). Tap to try again.';
    case 'network':
      return 'Dictation needs a connection on this phone.';
    case 'not-allowed':
      return 'Microphone access is off for this app.';
    case 'service-not-allowed':
    case 'language-not-supported':
      return UNAVAILABLE_MESSAGE;
    default:
      return 'Dictation stopped. Tap to try again.';
  }
}

/** Who would turn speech into text, in the consent's words. */
export function serviceName(service: SpeechService): string {
  if (service === 'apple') return 'Apple';
  if (service === 'google') return 'Google';
  return "your phone's speech service";
}

export const RATIONALE = {
  title: 'Dictate with the microphone',
  message(mode: SpeechMode): string {
    return mode === 'on-device'
      ? 'What you say becomes text in this field, recognised on this phone; the audio is never kept or sent.'
      : "What you say becomes text in this field, turned into text by your phone's online speech service; the app never keeps or sends the audio itself.";
  },
};

export const CONSENT = {
  title: 'Dictate online?',
  message(service: SpeechService): string {
    return `This phone can't turn speech into text by itself. Dictating would send your voice to ${serviceName(service)} to be turned into text. The app never keeps or sends the audio itself.`;
  },
};

export const MODEL = {
  title: 'Download the speech model',
  message: 'Download the speech model to dictate on this phone. Your voice then stays on the phone.',
  scheduled: 'It will finish in the background, on Wi-Fi.',
};

export const BLOCKED = {
  title: 'Microphone access is off',
  message: 'Microphone access is off for this app. Turn it on in Settings to dictate.',
};

export const RESTRICTED = {
  title: 'Dictation is turned off',
  message: 'Dictation is turned off on this phone by Screen Time or device management.',
};
