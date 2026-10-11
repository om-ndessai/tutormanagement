// Developer-only: proves the shared contract's formatting on this engine (Hermes on iOS and
// Android), which Jest cannot -- Jest runs on Node's ICU. Asserted by
// .maestro/flows/smoke/diagnostics.yaml. Not reachable in the production variant.
import { containsSsn, formatCents, formatRelativeTime, ORG_TIME_ZONES, zonedClockParts } from '@tmi/shared';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { liveSurface } from '@/features/teaching/live-surface';

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

export default function Diagnostics() {
  const liveSurfaceStatus = useLiveSurfaceStatus();
  if (!DEV_TOOLS) return <Redirect href="/" />;
  return (
    <ScrollView testID="screen-dev-diagnostics" contentContainerStyle={{ padding: 24, paddingTop: 72 }}>
      <Row id="diag-live-surface" label="Live lesson surface (system)" value={liveSurfaceStatus} />
      <Row id="diag-cents" label="formatCents(1234567)" value={formatCents(1234567)} />
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
