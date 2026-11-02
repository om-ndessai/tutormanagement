import { Redirect } from 'expo-router';

import { LoadingState } from '@/components/state-views';
import { GuestHome } from '@/features/guest/guest-home';
import { useGuestMemoryReady } from '@/features/guest/play-link';
import { useAuth } from '@/providers/auth-provider';

/**
 * Phase 63 (P10): the guest Play home, the first screen for someone signed out while guest play is on
 * (index.tsx sends them here). Outside both sign-in guards (_layout.tsx). Without guest play here, the
 * sign-in screen, as before.
 */
export default function PlayHomeRoute() {
  const { config, status } = useAuth();
  const ready = useGuestMemoryReady();
  if (!config?.guest && status !== 'authenticated') return <Redirect href="/sign-in" />;
  if (!ready) return <LoadingState />;
  return <GuestHome />;
}
