import { Redirect } from 'expo-router';

import { SignUpScreen } from '@/features/auth/sign-up-screen';
import { useAuth } from '@/providers/auth-provider';

/** Phase 52: the age question and the terms, for a newcomer between Google and the Welcome. */
export default function SignUpRoute() {
  const { pendingSignup } = useAuth();
  if (!pendingSignup) return <Redirect href="/sign-in" />;
  return <SignUpScreen />;
}
