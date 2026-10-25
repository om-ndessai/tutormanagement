import { Screen } from '@/components/screen';
import { SpaceWelcome } from '@/features/organizations/space-welcome';

/** Phase 52: joining or making another space, for someone already in one (a modal). */
export default function JoinSpaceRoute() {
  return (
    <Screen testID="screen-join-space">
      <SpaceWelcome firstTime={false} />
    </Screen>
  );
}
