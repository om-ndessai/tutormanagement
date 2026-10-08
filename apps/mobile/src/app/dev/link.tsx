// Developer-only deep link: tutorportal://dev/link?as=<email>&org=<slug>&server=local|demo
// Signs in as a seeded person (and enters an organization) in one step -- how the Maestro
// flows begin. Absent from production: the variant check, and the API ignoring X-Dev-User
// whenever its sign-in is on.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingState } from '@/components/state-views';
import { setServer } from '@/lib/server';
import { DEV_TOOLS } from '@/lib/variant';
import { useAuth } from '@/providers/auth-provider';

export default function DevLink() {
  const params = useLocalSearchParams<{ as?: string; org?: string; server?: string }>();
  const { signInAsDevUser, reboot } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!DEV_TOOLS) return;
    let cancelled = false;
    (async () => {
      if (params.server === 'local' || params.server === 'demo') {
        await setServer(params.server);
        await reboot();
      }
      if (params.as) await signInAsDevUser(params.as, params.org ?? null);
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!DEV_TOOLS || done) return <Redirect href="/" />;
  return <LoadingState label="Signing in…" testID="screen-dev-link" />;
}
