// Ported from apps/web/src/features/users/user-detail-dialog.tsx @ 1132322 -- the dialog becomes a
// pushed screen, with the directory's row actions in its header for an admin.
import { featureAllowed } from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Divider, Menu } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { Screen } from '@/components/screen';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useUserDetail } from './api';
import { canActOn, personPaymentPrefills } from './people-model';
import { useUserActions } from './use-user-actions';
import { UserDetailView } from './user-detail-view';

export function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer, organization } = useAuth();
  // Phase 50: recording a payment is Tutoring's.
  const tutoring = featureAllowed(organization, 'tutoring');
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
  const isAdmin = viewer?.roles.includes('admin') ?? false;
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
            person && isAdmin && (canAct || !isDeleted)
              ? () => (
                  // Admins only, as the API: the person themselves asks the office. Each section of the
                  // record has its own Edit (UI upgrades U5); the whole form stays here, for roles,
                  // status and changes across several sections.
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
                    {!isDeleted ? (
                      <Menu.Item
                        testID="person-edit"
                        leadingIcon="pencil-outline"
                        title="Edit everything"
                        onPress={run(() => router.push({ pathname: '/person-form', params: { id: person.id } }))}
                      />
                    ) : null}
                    {/* Finance: who it is to or from comes with the sheet (U5). */}
                    {!isDeleted && tutoring
                      ? personPaymentPrefills(person).map((prefill) => (
                          <Menu.Item
                            key={prefill.key}
                            testID={`person-record-payment-${prefill.key}`}
                            leadingIcon="cash-plus"
                            title={prefill.title}
                            onPress={run(() => router.push({ pathname: '/payment-form', params: prefill.params }))}
                          />
                        ))
                      : null}
                    {canAct ? (
                      <>
                        {!isDeleted ? <Divider /> : null}
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
                      </>
                    ) : null}
                  </Menu>
                )
              : undefined,
        }}
      />
      {isPending ? <DetailSkeleton label="Loading…" avatar /> : null}
      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {person ? <UserDetailView user={person} /> : null}
      {dialog}
    </Screen>
  );
}
