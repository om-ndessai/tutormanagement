// The member home's quick actions (Phase 66, H4): `quickActionsFor` (shared) picks at most three for the
// hats worn and what this person may do; here they are a row of tonal buttons (`quick-<action>`). "Have
// a code?" opens the one "Have a code?" sheet (`/have-a-code`, UI audit JF4), as the web's opens its CodeSheet.
import { type QuickAction } from '@tmi/shared';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { space } from '@/theme/tokens';
import { QUICK_ACTION_META } from './member-home-model';

export function QuickActions({ actions }: { actions: QuickAction[] }) {
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
              router.navigate(meta.href as Href);
            }}
          >
            {meta.label}
          </Button>
        );
      })}
    </View>
  );
}
