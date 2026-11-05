import { useLocalSearchParams } from 'expo-router';

import { JoinGameSheet } from '@/features/quest/join-game-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Join a Quest game by a game's or a team's code (`?code=`, Phase 46): a fitted form sheet. Phase 73 (JF36):
 * `from=home` when Home opened it, so the game's Exit comes back Home.
 */
function JoinGameRouteContent() {
  const { code, from } = useLocalSearchParams<{ code?: string; from?: string }>();
  return <JoinGameSheet code={code ?? ''} from={from} />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function JoinGameRoute() {
  return (
    <FeatureGate set="quest" presentation="sheet">
      <JoinGameRouteContent />
    </FeatureGate>
  );
}
