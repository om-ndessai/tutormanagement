// Ported from apps/web/src/pages/dashboard-page.tsx @ 1132322 (the "Viewing as" strip)
import { DASHBOARD_ROLE_LABELS, type DashboardSubject, type UserRole } from '@tmi/shared';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { RoleIcons } from '@/features/users/role-icon';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { backToMine } from './view-as';

/** While an admin looks at somebody else's dashboard: whose, as which role, and the way back. */
export function ViewAsBanner({ subject, role }: { subject: DashboardSubject; role: UserRole }) {
  const theme = useAppTheme();
  return (
    <View
      testID="view-as-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: withAlpha(theme.colors.primary, 0.3),
        backgroundColor: withAlpha(theme.colors.primary, 0.1),
        paddingLeft: space.md,
        paddingVertical: 4,
      }}
    >
      <Icon source="eye-outline" size={16} color={theme.colors.onSurface} />
      <RoleIcons roles={subject.roles} color={theme.colors.onSurface} />
      <Text variant="bodyMedium" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
        Viewing as <Text style={{ fontWeight: '600' }}>{subject.full_name}</Text>
        <Text style={{ color: theme.tokens.mutedForeground }}> · {DASHBOARD_ROLE_LABELS[role]}</Text>
      </Text>
      <Button testID="view-as-back" compact icon="close" onPress={backToMine}>
        Back to mine
      </Button>
    </View>
  );
}
