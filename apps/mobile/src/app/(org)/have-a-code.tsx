import { useLocalSearchParams } from 'expo-router';

import { CodeSheet } from '@/features/organizations/code-sheet';

/**
 * The one "Have a code?" sheet (UI audit JF4): a game's code (six characters) or a space's (eight), always saying
 * what it found before sending anything. `?code=` starts it on a code -- one kept on this phone, or the Quest
 * board's box. A fitted quick sheet.
 */
export default function HaveACodeRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <CodeSheet initialCode={code ?? ''} />;
}
