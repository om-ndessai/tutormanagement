// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322 (the role Select): "a single user
// could have multiple roles and so the dashboard should have the ability to select the role".
import { DASHBOARD_ROLE_LABELS, USER_ROLES, type UserRole } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Chip } from 'react-native-paper';

import { ROLE_ICONS } from '@/features/users/role-icon';
import { haptics } from '@/lib/haptics';

/**
 * The subject's roles as chips, the shown one selected. Renders nothing for someone with one
 * role. Choosing sets `?role=`; the server answers with that role's dashboard.
 */
export function RoleSelector({ roles, current }: { roles: UserRole[]; current: UserRole }) {
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
              router.setParams({ role });
            }}
          >
            {DASHBOARD_ROLE_LABELS[role]}
          </Chip>
        );
      })}
    </View>
  );
}
