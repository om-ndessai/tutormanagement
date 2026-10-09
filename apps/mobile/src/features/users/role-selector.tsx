// Ported from apps/web/src/features/users/role-selector.tsx @ 1132322.
//
// Roles are a set, not a choice: one person can be a parent who tutors, or a senior student who
// teaches younger children. Checkable cards rather than a single choice make that obvious.
import { USER_ROLES, USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS, type UserRole } from '@tmi/shared';
import { Pressable, View } from 'react-native';
import { HelperText, Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { ROLE_ICONS } from './role-icon';

export function RoleSelector({
  value,
  onChange,
  error,
}: {
  value: UserRole[];
  onChange: (roles: UserRole[]) => void;
  error?: string;
}) {
  const theme = useAppTheme();
  const toggle = (role: UserRole) => {
    haptics.selection();
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="titleSmall" style={{ color: error ? theme.colors.error : undefined }}>
        Roles
      </Text>
      {USER_ROLES.map((role) => {
        const checked = value.includes(role);
        return (
          <Pressable
            key={role}
            testID={`person-role-${role}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${USER_ROLE_LABELS[role]}. ${USER_ROLE_DESCRIPTIONS[role]}`}
            onPress={() => toggle(role)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              minHeight: MIN_TARGET,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: checked ? theme.colors.primary : theme.colors.outline,
              backgroundColor: checked ? withAlpha(theme.tokens.accent, 0.6) : 'transparent',
            }}
          >
            <Icon
              source={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={checked ? theme.colors.primary : theme.tokens.mutedForeground}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Icon source={ROLE_ICONS[role]} size={16} color={theme.tokens.mutedForeground} />
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  {USER_ROLE_LABELS[role]}
                </Text>
              </View>
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                {USER_ROLE_DESCRIPTIONS[role]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}
