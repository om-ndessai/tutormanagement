// The member home's quick actions (Phase 66, H4): `quickActionsFor` (shared) picks at most three for the
// hats worn and what this person may do; here they are a row of tonal buttons (`quick-<action>`). "Have
// a code?" opens the Play home's own box in a dialog, so there is one join path.
import { type QuickAction } from '@tmi/shared';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { ToastBridge, useToast } from '@/components/toast';
import { HaveACode } from '@/features/play/play-home';
import { haptics } from '@/lib/haptics';
import { space } from '@/theme/tokens';
import { QUICK_ACTION_META } from './member-home-model';

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  // Read here, inside ToastProvider: the Portal below mounts its dialog above the provider (ToastBridge).
  const toast = useToast();
  const [code, setCode] = useState(false);
  // A game code opens the join sheet over Home: the box closes as Home loses focus.
  useFocusEffect(useCallback(() => () => setCode(false), []));
  if (actions.length === 0) return null;
  return (
    <View testID="home-quick" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {actions.map((action) => {
        const meta = QUICK_ACTION_META[action];
        return (
          <Button
            key={action}
            testID={`quick-${action}`}
            mode="contained-tonal"
            icon={meta.icon}
            contentStyle={{ minHeight: 44 }}
            onPress={() => {
              haptics.selection();
              if (meta.href) router.navigate(meta.href as Href);
              else setCode(true);
            }}
          >
            {meta.label}
          </Button>
        );
      })}
      <Portal>
        <ToastBridge toast={toast}>
          <Dialog visible={code} onDismiss={() => setCode(false)} testID="home-code-dialog">
            <Dialog.Content>
              <HaveACode />
            </Dialog.Content>
            <Dialog.Actions>
              <Button testID="home-code-close" onPress={() => setCode(false)}>
                Close
              </Button>
            </Dialog.Actions>
          </Dialog>
        </ToastBridge>
      </Portal>
    </View>
  );
}
