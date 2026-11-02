import { PlayLastScreen } from '@/features/play/play-last-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Phase 62 (P6): the "Play <tile>" quick action -- the last tile started here, in one step. */
export default function PlayLastRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <PlayLastScreen />
    </FeatureGate>
  );
}
