import { StartGameFlow } from '@/features/quest/start-game-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Start a Quest game (Phase 47): a four-step wizard (2026-10-23), rising from the bottom over the Quest hub. */
function NewGameRouteContent() {
  return <StartGameFlow />;
}

/** Phase 50: only where Quest is on here; otherwise the calm "Not part of this space". */
export default function NewGameRoute() {
  return (
    <FeatureGate set="quest">
      <NewGameRouteContent />
    </FeatureGate>
  );
}
