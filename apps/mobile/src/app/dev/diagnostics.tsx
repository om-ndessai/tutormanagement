// Developer-only: proves the shared contract's formatting on this engine (Hermes on iOS and
// Android), which Jest cannot -- Jest runs on Node's ICU. Asserted by
// .maestro/flows/smoke/diagnostics.yaml. Not reachable in the production variant.
import {
  checkAnswer,
  containsSsn,
  evaluateExact,
  formatCents,
  formatFraction,
  formatRelativeTime,
  ORG_TIME_ZONES,
  zonedClockParts,
} from '@tmi/shared';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { questionBodyHtml } from '@/features/question-bank/question-html';
import { liveSurface } from '@/features/teaching/live-surface';

import * as speech from '@/lib/speech';
import { DEV_TOOLS } from '@/lib/variant';

// A fixed instant: 16:30 UTC on 1 July 2026.
const INSTANT = '2026-07-01T16:30:00Z';
// Three hours later, as "now" for the relative time.
const LATER = new Date('2026-07-01T19:30:00Z');

function clock(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function Row({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text style={{ fontSize: 12, opacity: 0.6 }}>{label}</Text>
      <Text testID={id} style={{ fontSize: 16 }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Whether the live lesson's system surface exists (#45), read from the system itself: ActivityKit's
 * running activities on iOS, the active notifications on Android. The flows read it, since neither
 * the Lock Screen nor the Dynamic Island is in the app's view hierarchy.
 */
function useLiveSurfaceStatus(): string {
  const [status, setStatus] = useState('…');
  useEffect(() => {
    let alive = true;
    const read = () =>
      void liveSurface.isShowing().then((showing) => {
        if (alive) setStatus(showing ? 'showing' : 'none');
      });
    read();
    const timer = setInterval(read, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return status;
}

/**
 * Dictation's engine on this device (P3, and the P3c hand checks): what it reports, and a probe that
 * starts on-device recognition for four seconds and lists the event TYPES it sent -- never the words.
 */
function useSpeechProbe() {
  const [report, setReport] = useState('…');
  const [probe, setProbe] = useState('not run');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const engine = speech.speechEngine();
      if (!engine) return alive && setReport('no native module');
      const caps = await engine.capabilities();
      const mic = await engine.permission('on-device');
      if (alive) {
        setReport(
          `available ${caps.available}, onDevice ${caps.onDevice}, model ${caps.modelInstalled}, ` +
            `service ${caps.service}, lang ${caps.lang}, mic ${mic}`,
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function run() {
    const seen: string[] = [];
    setProbe('asking for the microphone…');
    const mic = await speech.requestPermission('on-device');
    if (mic !== 'granted') return setProbe(`microphone ${mic}`);
    const unsubscribe = speech.subscribe((event) => {
      seen.push(event.type === 'error' ? `error:${event.code}` : event.type);
      setProbe(seen.join(' '));
      if (event.type === 'end') unsubscribe();
    });
    try {
      await speech.start('on-device');
      setTimeout(() => speech.stop(), 4000);
    } catch (error) {
      unsubscribe();
      setProbe(`refused: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
  return { report, probe, run };
}

/**
 * The question bank's maths on this engine (#54): KaTeX's renderToString on Hermes, through the card's
 * own builder, and the bank's exact answers (BigInt fractions). "ok", or what failed.
 */
function katexProbe(): string {
  try {
    const html = questionBodyHtml(
      {
        kind: 'choice',
        stem: 'What is $\\frac{3}{4} \\times 4{,}732$?',
        choices: ['3,549', '3,550', '3,600', '4,732'],
        answer: '3,549',
        solution: '$\\frac{3}{4} \\times 4{,}732 = 3{,}549$.',
      },
      { errorColor: 'currentColor' },
    );
    if (!html.includes('class="katex"') || !html.includes('mfrac')) return 'no KaTeX markup';
    if (html.includes('katex-error')) return 'KaTeX could not read the test span';
    if (!html.includes('class="choice key"')) return 'the key was not marked';
    const exact = evaluateExact('3/4*4732');
    if (!exact || formatFraction(exact) !== '3549')
      return `evaluateExact gave ${exact ? formatFraction(exact) : 'null'}`;
    if (!checkAnswer({ kind: 'numeric', answer: '3549' }, '7098/2')) return 'checkAnswer refused 7098/2';
    return 'ok';
  } catch (error) {
    return `threw: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export default function Diagnostics() {
  const liveSurfaceStatus = useLiveSurfaceStatus();
  const speechProbe = useSpeechProbe();
  if (!DEV_TOOLS) return <Redirect href="/" />;
  return (
    <ScrollView testID="screen-dev-diagnostics" contentContainerStyle={{ padding: 24, paddingTop: 72 }}>
      <Row id="diag-live-surface" label="Live lesson surface (system)" value={liveSurfaceStatus} />
      <Row id="diag-speech" label="Dictation engine" value={speechProbe.report} />
      <Pressable
        testID="diag-speech-probe"
        onPress={() => void speechProbe.run()}
        style={{ paddingVertical: 6 }}
      >
        <Text style={{ fontSize: 12, opacity: 0.6 }}>Probe on-device dictation (tap; event types only)</Text>
        <Text testID="diag-speech-probe-result" style={{ fontSize: 16 }}>
          {speechProbe.probe}
        </Text>
      </Pressable>
      <Row id="diag-cents" label="formatCents(1234567)" value={formatCents(1234567)} />
      <Row id="diag-katex" label="KaTeX and exact answers (question bank)" value={katexProbe()} />
      <Row
        id="diag-relative"
        label="formatRelativeTime(3 hours ago)"
        value={formatRelativeTime(INSTANT, LATER)}
      />
      <Row
        id="diag-ssn"
        label="containsSsn: 123-45-6789 / 919-555-0100"
        value={`${containsSsn('123-45-6789')} / ${containsSsn('919-555-0100')}`}
      />
      {ORG_TIME_ZONES.map((zone) => {
        const parts = zonedClockParts(INSTANT, zone);
        return (
          <Row
            key={zone}
            id={`diag-tz-${zone.replace(/\//g, '-')}`}
            label={`zonedClockParts(${INSTANT}, ${zone})`}
            value={`${parts.day} ${clock(parts.minutesOfDay)}`}
          />
        );
      })}
    </ScrollView>
  );
}
