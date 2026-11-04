// Ported from apps/web/src/features/home/member-home.tsx (`PinHome`) @ working tree (Phase 68, H4):
// "Make this my home" -- the person pins what leads their home here, or leaves it Automatic. Only the
// focuses they have (`focus_options`), and only when there are two or more. Same testIDs as the web:
// `home-pin`, `home-pin-auto`, `home-pin-<focus>`. A preference: no log line, no money.
import type { HomeFocus, MemberHome } from '@tmi/shared';
import { View } from 'react-native';
import { Chip, Icon, Text } from 'react-native-paper';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, space } from '@/theme/tokens';
import { usePinHome } from './api';
import { pinChoices, pinLabel } from './member-home-model';

export function PinHome({ home }: { home: MemberHome }) {
  const theme = useAppTheme();
  const pin = usePinHome();
  const toast = useToast();
  const choices = pinChoices(home);
  if (choices.length === 0) return null;
  return (
    <View testID="home-pin" collapsable={false} style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon source="home-outline" size={18} color={theme.tokens.mutedForeground} />
        <Text variant="titleSmall" accessibilityRole="header" style={{ color: theme.tokens.mutedForeground }}>
          Make this my home
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {choices.map((focus: HomeFocus | null) => {
          const chosen = (home.pin ?? null) === focus;
          return (
            <Chip
              key={focus ?? 'auto'}
              testID={`home-pin-${focus ?? 'auto'}`}
              hitSlop={CHIP_HIT_SLOP}
              // Paper's Chip reports the choice as `selected` (it sets the state itself).
              accessibilityRole="radio"
              selected={chosen}
              showSelectedCheck={false}
              mode={chosen ? 'flat' : 'outlined'}
              disabled={pin.isPending}
              onPress={() => {
                if (chosen) return;
                haptics.selection();
                pin.mutate(focus, {
                  onError: (caught) => {
                    haptics.error();
                    toast.error(caught instanceof ApiRequestError ? caught.message : 'Your home could not be changed.');
                  },
                });
              }}
            >
              {pinLabel(focus, home)}
            </Chip>
          );
        })}
      </View>
    </View>
  );
}
