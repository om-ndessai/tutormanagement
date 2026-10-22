import { useLocalSearchParams } from 'expo-router';

import { JoinGameSheet } from '@/features/quest/join-game-sheet';

/** Join a Quest game by a game's or a team's code (`?code=`, Phase 46): a fitted form sheet. */
export default function JoinGameRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <JoinGameSheet code={code ?? ''} />;
}
