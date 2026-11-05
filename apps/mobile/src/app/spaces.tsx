import { Stack, useLocalSearchParams } from 'expo-router';

import { SpacesScreen } from '@/features/organizations/spaces-screen';
import { useStackOptions } from '@/features/shell/stack-options';
import { useAuth } from '@/providers/auth-provider';

/**
 * Phase 60 (S7): Spaces. Inside a space it is pushed over it with a header and a way back; with no
 * space chosen it is the selector, full screen. `?join=1` (UI audit JF5, Home's "Ask again"; JF7, the account
 * sheet's Join with a code) opens on Join with a code; `?start=1` (JF7, the account sheet's and the (+)'s Start a
 * space) on the new space's name.
 */
export default function SpacesRoute() {
  const { organization } = useAuth();
  const { join, start } = useLocalSearchParams<{ join?: string; start?: string }>();
  const options = useStackOptions({ large: false });
  return (
    <>
      <Stack.Screen
        options={organization ? { ...options, headerShown: true, title: 'Spaces' } : { headerShown: false }}
      />
      <SpacesScreen focusJoin={join === '1'} focusStart={start === '1'} />
    </>
  );
}
