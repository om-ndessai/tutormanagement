// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322 (the role Select): "a single user
// could have multiple roles and so the dashboard should have the ability to select the role".
import { DASHBOARD_ROLE_LABELS, USER_ROLES, type UserRole } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { ROLE_ICONS } from '@/features/users/role-icon';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, space } from '@/theme/tokens';

/**
 * The roles as chips, the shown one selected. Renders nothing for someone with one role. Choosing
 * sets the dashboard's `?role=`, and the server answers with that role's dashboard. Since Phase 66 the
 * chips are on the Dashboard page (More → Dashboard), for the reader's own roles and for somebody an
 * admin views; Home has none.
 */
export function RoleSelector({
  roles,
  current,
  label = null,
  onChoose = (role) => router.setParams({ role }),
}: {
  roles: UserRole[];
  current: UserRole;
  /** Phase 74 (JF24): a visible label beside the chips ("Viewing as"); the group keeps its spoken name. */
  label?: string | null;
  onChoose?: (role: UserRole) => void;
}) {
  const theme = useAppTheme();
  const ordered = USER_ROLES.filter((role) => roles.includes(role));
  if (ordered.length < 2) return null;
  const chips = (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Dashboard role"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 }}
    >
      {ordered.map((role) => {
        const selected = role === current;
        return (
          <Chip
            hitSlop={CHIP_HIT_SLOP}
            key={role}
            testID={`dashboard-role-${role}`}
            icon={ROLE_ICONS[role]}
            selected={selected}
            showSelectedCheck={false}
            mode={selected ? 'flat' : 'outlined'}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChoose(role);
            }}
          >
            {DASHBOARD_ROLE_LABELS[role]}
          </Chip>
        );
      })}
    </View>
  );
  if (!label) return chips;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
      <Text testID="dashboard-role-label" variant="labelLarge" style={{ color: theme.tokens.mutedForeground }}>
        {label}
      </Text>
      {chips}
    </View>
  );
}
