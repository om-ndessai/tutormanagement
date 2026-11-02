import { MemberTileStart } from '@/features/guest/play-link';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Phase 63 (P14): a member arriving from a tile link -- the tile starts as a game in their space. */
export default function QuestTileRoute() {
  return (
    <FeatureGate set="quest" presentation="modal">
      <MemberTileStart />
    </FeatureGate>
  );
}
