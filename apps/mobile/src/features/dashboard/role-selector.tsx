// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322 (the role Select): "a single user
// could have multiple roles and so the dashboard should have the ability to select the role".
import { DASHBOARD_ROLE_LABELS, USER_ROLES, type UserRole } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Chip } from 'react-native-paper';

import { ROLE_ICONS } from '@/features/users/role-icon';
import { haptics } from '@/lib/haptics';
import { CHIP_HIT_SLOP } from '@/theme/tokens';

/**
 * The roles as chips, the shown one selected. Renders nothing for someone with one role. Choosing
 * sets Home's `?role=` (by default from Home itself; the account sheet passes `onChoose`), and the
 * server answers with that role's dashboard. Since UI upgrades U6 the reader's own roles are chosen
 * in the account sheet; Home keeps the chips only while an admin views somebody else's.
 */
export function RoleSelector({
  roles,
  current,
  onChoose = (role) => router.setParams({ role }),
}: {
  roles: UserRole[];
  current: UserRole;
  onChoose?: (role: UserRole) => void;
}) {
  const ordered = USER_ROLES.filter((role) => roles.includes(role));
  if (ordered.length < 2) return null;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Dashboard role"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
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
}
