import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

/** Where the app opens: sign-in, the organization's home, the picker, or the console. */
export default function Index() {
  const { status, organization, memberships, invitations, platformAdmin } = useAuth();
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;
  if (organization) return <Redirect href="/dashboard" />;
  // A platform admin with nowhere else to go lands on the console (as on the web).
  if (platformAdmin && memberships.length === 0 && invitations.length === 0)
    return <Redirect href="/platform" />;
  return <Redirect href="/select-organization" />;
}
