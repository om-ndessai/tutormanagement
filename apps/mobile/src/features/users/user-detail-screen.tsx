// Ported from apps/web/src/features/users/user-detail-dialog.tsx @ 1132322 -- the dialog becomes a
// pushed screen, with the directory's row actions in its header for an admin.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Divider, IconButton, Menu } from 'react-native-paper';

import { LoadingState, ErrorState } from '@/components/state-views';
import { Screen } from '@/components/screen';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useUserDetail } from './api';
import { canActOn } from './people-model';
import { useUserActions } from './use-user-actions';
import { UserDetailView } from './user-detail-view';

export function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer } = useAuth();
  const theme = useAppTheme();
  const { data, isPending, error, refetch } = useUserDetail(id ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { deactivate, restore, hardDelete, dialog } = useUserActions({
    onDeleted: () => (router.canGoBack() ? router.back() : router.replace('/people')),
  });

  const person = data?.data;
  const canAct = person ? canActOn(viewer, person) : false;
  const isDeleted = Boolean(person?.deleted_at);
  const run = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-person" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen
        options={{
          title: person?.full_name ?? 'User',
          headerRight:
            person && canAct
              ? () => (
                  <Menu
                    visible={menuOpen}
                    onDismiss={() => setMenuOpen(false)}
                    anchor={
                      <IconButton
                        testID="person-menu"
                        icon="dots-horizontal-circle-outline"
                        size={24}
                        accessibilityLabel={`Actions for ${person.full_name}`}
                        style={{ margin: 0 }}
                        onPress={() => setMenuOpen(true)}
                      />
                    }
                  >
                    {isDeleted ? (
                      <Menu.Item
                        testID="person-restore"
                        leadingIcon="restore"
                        title="Restore"
                        onPress={run(() => restore(person))}
                      />
                    ) : (
                      <Menu.Item
                        testID="person-deactivate"
                        leadingIcon="account-minus-outline"
                        title="Deactivate"
                        onPress={run(() => deactivate(person))}
                      />
                    )}
                    <Divider />
                    <Menu.Item
                      testID="person-delete"
                      leadingIcon="trash-can-outline"
                      title="Delete permanently"
                      titleStyle={{ color: theme.colors.error }}
                      onPress={run(() => hardDelete(person))}
                    />
                  </Menu>
                )
              : undefined,
        }}
      />
      {isPending ? <LoadingState label="Loading…" /> : null}
      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {person ? <UserDetailView user={person} /> : null}
      {dialog}
    </Screen>
  );
}
