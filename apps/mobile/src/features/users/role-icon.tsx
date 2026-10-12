// Ported from apps/web/src/features/users/role-icon.tsx @ 1132322
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from '@tmi/shared';
import { View } from 'react-native';
import { Icon } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';

/**
 * One glyph per role (Material Community names), defined once so the dashboard cards, the role
 * selector and the people picker all say the same thing.
 */
export const ROLE_ICONS: Record<UserRole, string> = {
  admin: 'shield-account-outline',
  tutor: 'account-tie-outline',
  student: 'school-outline',
  parent: 'account-cog-outline',
};

/**
 * The roles a person holds, as icons, in the canonical order (USER_ROLES) so the same person
 * always looks the same. The group is labelled with the role names: a glyph alone is not a label.
 */
export function RoleIcons({ roles, size = 16, color }: { roles: UserRole[]; size?: number; color?: string }) {
  const theme = useAppTheme();
  const ordered = USER_ROLES.filter((role) => roles.includes(role));
  const tint = color ?? theme.tokens.mutedForeground;
  if (ordered.length === 0) {
    return (
      <View accessible accessibilityLabel="No role">
        <Icon source="account-outline" size={size} color={tint} />
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={ordered.map((role) => USER_ROLE_LABELS[role]).join(', ')}
      style={{ flexDirection: 'row', gap: 2 }}
    >
      {ordered.map((role) => (
        <Icon key={role} source={ROLE_ICONS[role]} size={size} color={tint} />
      ))}
    </View>
  );
}
