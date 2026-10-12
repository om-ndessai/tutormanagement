// Ported from the phone layout of apps/web/src/features/users/users-table.tsx @ 1132322: one card
// per person, nothing hidden off-screen, and the actions menu beside the name.
import { USER_ROLES, USER_ROLE_LABELS, USER_STATUS_LABELS, type User } from '@tmi/shared';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Divider, Menu, Text } from 'react-native-paper';

import { AdaptiveRow } from '@/components/adaptive-row';
import { useLargeText, useLines } from '@/hooks/use-large-text';
import { IconButton } from '@/components/icon-button';
import { SwipeRow, rowActionsA11y, type RowAction } from '@/components/swipe-row';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { PersonAvatar } from './person-avatar';
import { DeletedBadge, EmailOrNone, RoleBadges, StatusBadge } from './user-badges';

export interface RowActions {
  onView: (user: User) => void;
  onEdit?: (user: User) => void;
  onDeactivate: (user: User) => void;
  /** A swipe's deactivate: at once, with Undo on the toast (soft, so it can be taken back). */
  onDeactivateNow?: (user: User) => void;
  onRestore: (user: User) => void;
  onDelete: (user: User) => void;
}

export const UserCard = memo(function UserCard({
  user,
  actions,
  canAct,
  isSelf = false,
}: {
  user: User;
  actions: RowActions;
  /** An admin: the server refuses everyone else. */
  canAct: boolean;
  /** The reader's own row: an admin may edit it, never deactivate or delete it. */
  isSelf?: boolean;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const isDeleted = user.deleted_at !== null;
  const swipeActions = canAct ? personRowActions(user, actions, isSelf) : [];
  const large = useLargeText();
  const lines = useLines(1);

  return (
    <SwipeRow actions={swipeActions} testID={`people-row-${user.id}`}>
      {({ openMenu }) => (
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
              {...rowActionsA11y(swipeActions, () => actions.onView(user))}
              onPress={() => actions.onView(user)}
              onLongPress={openMenu}
              delayLongPress={400}
              style={{ flex: 1, minWidth: 0, padding: space.md, gap: space.sm }}
            >
              <AdaptiveRow gap={space.md}>
                <PersonAvatar name={user.full_name} />
                <View style={{ flex: large ? undefined : 1, minWidth: 0 }}>
                  <Text variant="titleSmall" numberOfLines={lines}>
                    {user.full_name}
                  </Text>
                  {/* Not a link here: a tap on the card opens the record, and the record offers Email. */}
                  <EmailOrNone
                    email={user.email}
                    link={false}
                    numberOfLines={lines}
                    style={{ fontSize: 12, color: muted }}
                  />
                  {user.phone ? (
                    <Text style={{ fontSize: 12, color: muted }} numberOfLines={lines}>
                      {user.phone}
                    </Text>
                  ) : null}
                </View>
              </AdaptiveRow>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: large ? 0 : 48,
                }}
              >
                <RoleBadges roles={user.roles} />
                <StatusBadge status={user.status} />
                {isDeleted ? <DeletedBadge testID={`people-deleted-${user.id}`} /> : null}
              </View>
            </Pressable>
            {canAct ? (
              <View style={{ paddingTop: space.sm, paddingRight: space.xs }}>
                <ActionsMenu user={user} actions={actions} isSelf={isSelf} />
              </View>
            ) : null}
          </View>
        </Card>
      )}
    </SwipeRow>
  );
});

/**
 * A person's swipe and long-press verbs: Edit, then Deactivate (at once, with Undo) or Restore.
 * Never one's own deactivation, and never the permanent delete, which stays behind the ⋯ menu's
 * typed confirmation.
 */
export function personRowActions(user: User, actions: RowActions, isSelf: boolean): RowAction[] {
  const isDeleted = user.deleted_at !== null;
  const list: RowAction[] = [];
  const onEdit = actions.onEdit;
  if (!isDeleted && onEdit) {
    list.push({ key: 'edit', label: 'Edit', icon: 'pencil-outline', onPress: () => onEdit(user) });
  }
  if (isSelf) return list;
  if (isDeleted) {
    list.push({ key: 'restore', label: 'Restore', icon: 'restore', onPress: () => actions.onRestore(user) });
  } else {
    const deactivate = actions.onDeactivateNow ?? actions.onDeactivate;
    list.push({
      key: 'deactivate',
      label: 'Deactivate',
      icon: 'account-minus-outline',
      destructive: true,
      onPress: () => deactivate(user),
    });
  }
  return list;
}

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

function ActionsMenu({ user, actions, isSelf }: { user: User; actions: RowActions; isSelf: boolean }) {
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
      {isSelf ? null : !isDeleted ? (
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
      {isSelf ? null : (
        <>
          <Divider />
          <Menu.Item
            testID="people-action-delete"
            leadingIcon="trash-can-outline"
            title="Delete permanently"
            titleStyle={{ color: theme.colors.error }}
            onPress={run(actions.onDelete)}
          />
        </>
      )}
    </Menu>
  );
}
