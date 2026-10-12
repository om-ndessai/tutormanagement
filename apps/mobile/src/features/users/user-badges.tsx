// Ported from apps/web/src/features/users/user-badges.tsx @ 1132322
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  type UserRole,
  type UserStatus,
} from '@tmi/shared';
import { Linking, Pressable, View, type TextStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import { radius } from '@/theme/tokens';

/**
 * Each role gets its own tint so a row's roles are scannable at a glance. All four are
 * brand-adjacent rather than a rainbow: admin carries the brand, the rest sit around it (the web's
 * sky/emerald/amber become the palette's ring, success and warning, which follow dark mode).
 */
function roleTone(theme: AppTheme, role: UserRole): { background: string; color: string } {
  const t = theme.tokens;
  const dark = theme.scheme === 'dark';
  switch (role) {
    case 'admin':
      return {
        background: dark ? withAlpha(t.brand900, 0.6) : t.brand100,
        color: dark ? t.brand200 : t.brand800,
      };
    case 'tutor':
      return { background: withAlpha(t.ring, dark ? 0.3 : 0.15), color: dark ? t.brand200 : t.brand800 };
    case 'student':
      return { background: withAlpha(t.success, 0.15), color: t.success };
    case 'parent':
      return { background: withAlpha(t.warning, 0.2), color: dark ? t.warning : t.warningForeground };
  }
}

function statusTone(theme: AppTheme, status: UserStatus): { background: string; color: string } {
  const t = theme.tokens;
  switch (status) {
    case 'active':
      return { background: withAlpha(t.success, 0.15), color: t.success };
    case 'invited':
      return {
        background: withAlpha(t.warning, 0.2),
        color: theme.scheme === 'dark' ? t.warning : t.warningForeground,
      };
    case 'suspended':
      return { background: withAlpha(t.destructive, 0.15), color: t.destructive };
  }
}

function Badge({
  label,
  background,
  color,
  borderColor,
  dashed,
  testID,
}: {
  label: string;
  background: string;
  color: string;
  borderColor?: string;
  dashed?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: background,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: borderColor ?? 'transparent',
        borderStyle: dashed ? 'dashed' : 'solid',
        paddingHorizontal: 6,
        paddingVertical: 2,
        flexShrink: 0,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color }}>{label}</Text>
    </View>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  const theme = useAppTheme();
  const tone = roleTone(theme, role);
  return <Badge label={USER_ROLE_LABELS[role]} {...tone} />;
}

/**
 * A user holds one or more roles, so the card shows a set, in the canonical order from
 * USER_ROLES rather than the order the database returned.
 */
export function RoleBadges({ roles }: { roles: UserRole[] }) {
  const theme = useAppTheme();
  const ordered = USER_ROLES.filter((role) => roles.includes(role));
  if (ordered.length === 0) {
    return <Text style={{ fontSize: 12, color: theme.tokens.mutedForeground }}>No role</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {ordered.map((role) => (
        <RoleBadge key={role} role={role} />
      ))}
    </View>
  );
}

export function StatusBadge({ status }: { status: UserStatus }) {
  const theme = useAppTheme();
  return <Badge label={USER_STATUS_LABELS[status]} {...statusTone(theme, status)} />;
}

export function DeletedBadge({ testID }: { testID?: string }) {
  const theme = useAppTheme();
  return (
    <Badge
      testID={testID}
      label="Deactivated"
      background="transparent"
      color={theme.tokens.mutedForeground}
      borderColor={theme.colors.outline}
      dashed
    />
  );
}

/**
 * Somebody's email, or a plain statement that they have none.
 *
 * Most students are children who never sign in, so an absent address is ordinary rather than
 * missing data -- it should not read as a gap, and it must never become a mailto: pointing at the
 * word "null". With `link`, a present address opens the mail app.
 */
export function EmailOrNone({
  email,
  link = true,
  style,
  testID,
  numberOfLines,
}: {
  email: string | null;
  link?: boolean;
  style?: TextStyle;
  testID?: string;
  numberOfLines?: number;
}) {
  const theme = useAppTheme();
  if (!email) {
    return (
      <Text
        testID={testID}
        numberOfLines={numberOfLines}
        style={[style, { color: theme.tokens.mutedForeground }]}
      >
        No email
      </Text>
    );
  }
  if (!link) {
    return (
      <Text testID={testID} numberOfLines={numberOfLines} style={style}>
        {email}
      </Text>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`Email ${email}`}
      hitSlop={8}
      onPress={() => void Linking.openURL(`mailto:${email}`).catch(() => undefined)}
    >
      <Text numberOfLines={numberOfLines} style={[style, { color: theme.colors.primary }]}>
        {email}
      </Text>
    </Pressable>
  );
}
