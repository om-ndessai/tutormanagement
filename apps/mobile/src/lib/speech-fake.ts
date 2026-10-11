// The scripted recognizer for development and e2e builds (P3): the Maestro flows cannot speak to a
// simulator, and this Mac has no microphone. Armed by the developer deep link
//   tutorportal://dev/dictate?text=…&text=…&permission=…&ondevice=0|1&model=installed|missing&error=…
// (src/app/dev/dictate.tsx), disarmed by `reset=1` or a relaunch. It lives in memory only: never
// stored. `speech.ts` uses it instead of the native module only while DEV_TOOLS is true.
import type {
  DownloadOutcome,
  PermissionState,
  SpeechCapabilities,
  SpeechEngine,
  SpeechEvent,
  SpeechListener,
  SpeechMode,
  SpeechStartOptions,
} from './speech';

export interface FakeScript {
  /** One recognizer segment per entry, in order; then it keeps "listening" until stopped. */
  segments: string[];
  permission: PermissionState;
  onDevice: boolean;
  modelInstalled: boolean;
  /** Emitted instead of any result. */
  error: string | null;
  /** How long each segment's interim words show before its final (`hold=` in the link). */
  interimMs: number;
}

/** How long a segment's interim words show before its final result. */
export const FAKE_INTERIM_MS = 400;
const FIRST_SEGMENT_MS = 300;

let script: FakeScript | null = null;
let permissionNow: PermissionState = 'granted';
let lastOptions: SpeechStartOptions | null = null;
const listeners = new Set<SpeechListener>();
let timers: ReturnType<typeof setTimeout>[] = [];
let pending: string[] = [];
let running = false;

function emit(event: SpeechEvent) {
  for (const listener of [...listeners]) listener(event);
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function later(ms: number, run: () => void) {
  timers.push(setTimeout(run, ms));
}

function half(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(' ');
}

/** Plays the remaining segments one after another: interim (half the words), then final. */
function playNext(delay: number) {
  const next = pending[0];
  if (next === undefined || !running) return;
  later(delay, () => {
    if (!running) return;
    emit({ type: 'interim', text: half(next) });
    later(script?.interimMs ?? FAKE_INTERIM_MS, () => {
      if (!running) return;
      pending.shift();
      emit({ type: 'final', text: next });
      playNext(FAKE_INTERIM_MS);
    });
  });
}

function finish() {
  running = false;
  clearTimers();
  emit({ type: 'end' });
}

export const fakeEngine: SpeechEngine & {
  armed(): boolean;
  arm(next: FakeScript): void;
  disarm(): void;
  /** The options the last start was given (for the dev screen and tests). */
  lastOptions(): SpeechStartOptions | null;
} = {
  armed: () => script !== null,
  arm(next) {
    script = next;
    permissionNow = next.permission;
  },
  disarm() {
    if (running) finish();
    script = null;
    lastOptions = null;
  },
  lastOptions: () => lastOptions,

  async capabilities(): Promise<SpeechCapabilities> {
    const s = script!;
    return {
      available: true,
      onDevice: s.onDevice,
      modelInstalled: s.onDevice && s.modelInstalled,
      canDownloadModel: s.onDevice && !s.modelInstalled,
      service: 'other',
      lang: 'en-US',
    };
  },
  async permission(_mode: SpeechMode) {
    return permissionNow;
  },
  async requestPermission(_mode: SpeechMode) {
    // The system prompt, answered "Allow" -- unless the setting is out of the app's reach.
    if (permissionNow === 'undetermined' || permissionNow === 'denied') permissionNow = 'granted';
    return permissionNow;
  },
  async downloadModel(_lang: string): Promise<DownloadOutcome> {
    if (script) script = { ...script, modelInstalled: true };
    return 'download_success';
  },
  start(options) {
    if (!script) return;
    lastOptions = options;
    clearTimers();
    running = true;
    pending = [...script.segments];
    const error = script.error;
    later(0, () => {
      if (!running) return;
      emit({ type: 'start' });
      if (error) {
        later(FIRST_SEGMENT_MS, () => {
          if (!running) return;
          emit({ type: 'error', code: error });
          finish();
        });
        return;
      }
      playNext(FIRST_SEGMENT_MS);
    });
  },
  stop() {
    if (!running) return;
    // Whatever was "said" and not yet settled settles now, as a recognizer's stop() does.
    running = false;
    clearTimers();
    const rest = pending.join(' ').trim();
    pending = [];
    if (rest) emit({ type: 'final', text: rest });
    emit({ type: 'end' });
  },
  abort() {
    if (!running) return;
    pending = [];
    running = false;
    clearTimers();
    emit({ type: 'error', code: 'aborted' });
    emit({ type: 'end' });
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

const PERMISSIONS: readonly PermissionState[] = [
  'granted',
  'undetermined',
  'denied',
  'blocked',
  'restricted',
];

/** Reads the deep link's query into a script (unknown values fall back to the defaults). */
export function scriptFromParams(params: {
  text?: string | string[];
  permission?: string;
  ondevice?: string;
  model?: string;
  error?: string;
  hold?: string;
}): FakeScript {
  const texts = params.text === undefined ? [] : Array.isArray(params.text) ? params.text : [params.text];
  const permission = PERMISSIONS.find((p) => p === params.permission) ?? 'granted';
  return {
    segments: texts.map((t) => t.trim()).filter(Boolean),
    permission,
    onDevice: params.ondevice !== '0',
    modelInstalled: params.model !== 'missing',
    error: params.error?.trim() || null,
    interimMs: Math.min(Math.max(Number(params.hold) || FAKE_INTERIM_MS, 100), 60_000),
  };
}
