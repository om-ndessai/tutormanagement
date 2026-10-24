import { useLocalSearchParams } from 'expo-router';

import { JoinGameSheet } from '@/features/quest/join-game-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Join a Quest game by a game's or a team's code (`?code=`, Phase 46): a fitted form sheet. */
function JoinGameRouteContent() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <JoinGameSheet code={code ?? ''} />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function JoinGameRoute() {
  return (
    <FeatureGate set="quest" presentation="sheet">
      <JoinGameRouteContent />
    </FeatureGate>
  );
}
