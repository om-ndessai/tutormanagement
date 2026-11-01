import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

/** Where the app opens: sign-in, the space's home, the selector (Spaces), or the console. */
export default function Index() {
  const { status, organization, memberships, invitations, platformAdmin, pendingSignup } = useAuth();
  if (status !== 'authenticated') return <Redirect href={pendingSignup ? '/sign-up' : '/sign-in'} />;
  if (organization) return <Redirect href="/dashboard" />;
  // A platform admin with no space and nothing pending lands on the console (as on the web).
  if (platformAdmin && memberships.length === 0 && invitations.length === 0)
    return <Redirect href="/platform" />;
  return <Redirect href="/spaces" />;
}
