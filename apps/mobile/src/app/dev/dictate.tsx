// Developer-only deep link that scripts dictation (P3), as the Maestro flows cannot speak:
//   aimtrue://dev/dictate?text=<segment>&text=…&permission=undetermined|granted|denied|blocked|restricted
//     &ondevice=0|1&model=installed|missing&error=<code>&hold=<ms of interim words>  -- or ?reset=1.
// Arms the in-memory fake recognizer (src/lib/speech-fake.ts), then goes home, like dev/link.
// Absent from production: the variant check here and in speech.ts.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingState } from '@/components/state-views';
import { fakeEngine, scriptFromParams } from '@/lib/speech-fake';
import { DEV_TOOLS } from '@/lib/variant';

export default function DevDictate() {
  const params = useLocalSearchParams<{
    text?: string | string[];
    permission?: string;
    ondevice?: string;
    model?: string;
    error?: string;
    hold?: string;
    reset?: string;
  }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!DEV_TOOLS) return;
    if (params.reset === '1') fakeEngine.disarm();
    else fakeEngine.arm(scriptFromParams(params));
    void Promise.resolve().then(() => setDone(true));
    // Runs once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!DEV_TOOLS || done) return <Redirect href="/" />;
  return <LoadingState label="Preparing dictation…" testID="screen-dev-dictate" />;
}
