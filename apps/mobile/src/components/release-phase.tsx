// The newest phase of docs/plan.md this build includes, in small text (owner, 2026-10-24): it tells
// which phase a phone's build carries. The app only, on the owner's word (docs/mobile/parity.md).
import { RELEASE_PHASE, releaseLabel } from '@tmi/shared';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';

export function ReleasePhase() {
  const theme = useAppTheme();
  return (
    <Text
      testID="release-phase"
      variant="labelSmall"
      style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', opacity: 0.8 }}
    >
      {releaseLabel(RELEASE_PHASE)}
    </Text>
  );
}
