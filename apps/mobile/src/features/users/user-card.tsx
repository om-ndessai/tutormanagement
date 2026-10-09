// Ported from the phone layout of apps/web/src/features/users/users-table.tsx @ 1132322: one card
// per person, nothing hidden off-screen, and the actions menu beside the name.
import { USER_ROLES, USER_ROLE_LABELS, USER_STATUS_LABELS, type User } from '@tmi/shared';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Divider, IconButton, Menu, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { PersonAvatar } from './person-avatar';
import { DeletedBadge, EmailOrNone, RoleBadges, StatusBadge } from './user-badges';

export interface RowActions {
  onView: (user: User) => void;
  onEdit?: (user: User) => void;
  onDeactivate: (user: User) => void;
  onRestore: (user: User) => void;
  onDelete: (user: User) => void;
}

export const UserCard = memo(function UserCard({
  user,
  actions,
  canAct,
}: {
  user: User;
  actions: RowActions;
  /** An admin, on somebody else's row: the server refuses everyone else. */
  canAct: boolean;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const isDeleted = user.deleted_at !== null;

  return (
    <Card
      testID={`people-row-${user.id}`}
      mode="outlined"
      style={{ borderRadius: radius.lg, opacity: isDeleted ? 0.6 : 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* The menu is a sibling, not inside the card's button: nested in an accessible element it
            would be one with it, unreachable by VoiceOver (and by the tests). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${user.full_name}, ${describe(user)}, open their record`}
          onPress={() => actions.onView(user)}
          style={{ flex: 1, minWidth: 0, padding: space.md, gap: space.sm }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <PersonAvatar name={user.full_name} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="titleSmall" numberOfLines={1}>
                {user.full_name}
              </Text>
              {/* Not a link here: a tap on the card opens the record, and the record offers Email. */}
              <EmailOrNone
                email={user.email}
                link={false}
                numberOfLines={1}
                style={{ fontSize: 12, color: muted }}
              />
              {user.phone ? (
                <Text style={{ fontSize: 12, color: muted }} numberOfLines={1}>
                  {user.phone}
                </Text>
              ) : null}
            </View>
          </View>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingLeft: 48 }}
          >
            <RoleBadges roles={user.roles} />
            <StatusBadge status={user.status} />
            {isDeleted ? <DeletedBadge testID={`people-deleted-${user.id}`} /> : null}
          </View>
        </Pressable>
        {canAct ? (
          <View style={{ paddingTop: space.sm, paddingRight: space.xs }}>
            <ActionsMenu user={user} actions={actions} />
          </View>
        ) : null}
      </View>
    </Card>
  );
});

/** What the card shows besides the name, for a screen reader: "No email, Student, Active". */
function describe(user: User): string {
  const roles = USER_ROLES.filter((role) => user.roles.includes(role)).map((role) => USER_ROLE_LABELS[role]);
  return [
    user.email ?? 'No email',
    ...roles,
    USER_STATUS_LABELS[user.status],
    ...(user.deleted_at ? ['Deactivated'] : []),
  ].join(', ');
}

function ActionsMenu({ user, actions }: { user: User; actions: RowActions }) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const isDeleted = user.deleted_at !== null;
  const run = (action: (user: User) => void) => () => {
    setOpen(false);
    action(user);
  };

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <IconButton
          testID={`people-row-menu-${user.id}`}
          icon="dots-horizontal"
          accessibilityLabel={`Actions for ${user.full_name}`}
          onPress={() => setOpen(true)}
          style={{ margin: 0 }}
        />
      }
    >
      <Menu.Item
        testID="people-action-view"
        leadingIcon="eye-outline"
        title="View details"
        onPress={run(actions.onView)}
      />
      {!isDeleted && actions.onEdit ? (
        <Menu.Item
          testID="people-action-edit"
          leadingIcon="pencil-outline"
          title="Edit"
          onPress={run(actions.onEdit)}
        />
      ) : null}
      {!isDeleted ? (
        <Menu.Item
          testID="people-action-deactivate"
          leadingIcon="account-minus-outline"
          title="Deactivate"
          onPress={run(actions.onDeactivate)}
        />
      ) : (
        <Menu.Item
          testID="people-action-restore"
          leadingIcon="restore"
          title="Restore"
          onPress={run(actions.onRestore)}
        />
      )}
      <Divider />
      <Menu.Item
        testID="people-action-delete"
        leadingIcon="trash-can-outline"
        title="Delete permanently"
        titleStyle={{ color: theme.colors.error }}
        onPress={run(actions.onDelete)}
      />
    </Menu>
  );
}
