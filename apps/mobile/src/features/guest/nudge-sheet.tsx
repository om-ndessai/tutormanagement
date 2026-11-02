// Ported from apps/web/src/features/guest/nudge-sheet.tsx @ 0e3ec7a (working tree). Phase 63 (P12):
// the sign-up offer -- after an answer (the clock paused), on a locked tile, when the free questions run
// out, and on the results. "Keep playing" is as visible as "Sign up free" (both full buttons); "Ask a
// grown-up" is the door for a child, and collects nothing.
//
// Mobile: a Paper dialog (in the Quest frame's own portal host over a quest, the app's over the Play
// home); "Ask a grown-up" opens the system share sheet with the message and the link -- nothing is
// copied, stored or sent by us.
import { Share, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { countEvent } from './guest-api';
import { ASK_ADULT_TEXT } from './guest-model';

export function NudgeSheet({
  open,
  headline,
  description,
  benefits,
  onSignUp,
  onClose,
  closeLabel = 'Keep playing',
  shareLink,
}: {
  open: boolean;
  headline: string;
  description?: string;
  benefits: string[];
  onSignUp: () => void;
  onClose: () => void;
  closeLabel?: string;
  /** What "Ask a grown-up" shares: a link back to this quest, or the Play home. */
  shareLink: string;
}) {
  const theme = useAppTheme();
  const { config } = useAuth();
  const signupOpen = config?.signup_open === true;

  async function ask() {
    countEvent({ name: 'ask_grown_up' });
    try {
      await Share.share({ message: `${ASK_ADULT_TEXT} ${shareLink}` });
    } catch {
      // Dismissed.
    }
  }

  return (
    <Portal>
      <Dialog visible={open} onDismiss={onClose} testID="guest-nudge">
        <Dialog.Title accessibilityRole="header" testID="guest-nudge-title">
          {headline}
        </Dialog.Title>
        <Dialog.Content style={{ gap: space.sm }}>
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {description ?? (signupOpen ? 'With a free account:' : 'With an account:')}
          </Text>
          {benefits.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
              <Text aria-hidden style={{ color: theme.colors.primary }}>
                ✓
              </Text>
              <Text variant="bodyMedium" style={{ flex: 1 }}>
                {line}
              </Text>
            </View>
          ))}
        </Dialog.Content>
        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm }}>
          <Button
            testID="guest-nudge-signup"
            mode="contained"
            onPress={() => {
              haptics.selection();
              onSignUp();
            }}
            contentStyle={{ minHeight: 48 }}
          >
            {signupOpen ? 'Sign up free' : 'Sign in'}
          </Button>
          <Button testID="guest-nudge-close" mode="outlined" onPress={onClose} contentStyle={{ minHeight: 48 }}>
            {closeLabel}
          </Button>
          <Button testID="guest-ask-adult" mode="text" compact onPress={() => void ask()}>
            Under 13? Ask a grown-up
          </Button>
        </View>
      </Dialog>
    </Portal>
  );
}
