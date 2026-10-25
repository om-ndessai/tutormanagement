// Ported from apps/web/src/features/organizations/space-code-card.tsx @ 9485a8e. No Copy button
// (the lead's answer, 2026-10-24): the share sheet offers Copy on both systems.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';

import { ErrorState } from '@/components/state-views';
import { Panel } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { showProblem } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

import { useDeleteSpace, useLeaveSpace, useRenewSpaceCode, useSetJoinByCode, useSpaceCode } from './api';
import { deleteNameMatches, mayDeleteSpace, shareText, spokenCode } from './space-model';

/**
 * Phase 52: the space's code, for its admins: share it, make a new one (the old stops working at
 * once), and switch joining by code on or off. People who use it ask to join; the admins let them
 * in from the People screen.
 */
export function SpaceCodePanel() {
  const { organization } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const code = useSpaceCode(true);
  const renew = useRenewSpaceCode();
  const setJoining = useSetJoinByCode();
  const value = code.data?.data;
  const muted = theme.colors.onSurfaceVariant;
  // The switch moves at once and settles on the server's answer.
  const [wanted, setWanted] = useState<boolean | null>(null);
  const joining = wanted ?? value?.join_by_code ?? false;

  async function share() {
    if (!value?.code || !organization) return;
    try {
      // A closed sheet says nothing.
      await Share.share({ message: shareText(organization.name, value.code, serverOrigin()) });
    } catch {
      // Nothing to do.
    }
  }

  function makeCode() {
    const had = Boolean(value?.code);
    const go = () =>
      renew.mutate(undefined, {
        onSuccess: () => toast.success(had ? 'New code made. The old one no longer works.' : 'Code made.'),
        onError: (e) => showProblem(toast, e, 'Could not make a code.'),
      });
    if (!had) return go();
    haptics.warning();
    Alert.alert('Make a new code?', 'The old code stops working at once.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Make it', style: 'destructive', onPress: go },
    ]);
  }

  async function toggle(next: boolean) {
    haptics.selection();
    setWanted(next);
    try {
      await setJoining.mutateAsync(next);
      toast.success(next ? 'Joining by code is on.' : 'Joining by code is off.');
    } catch (caught) {
      showProblem(toast, caught, 'Could not change joining by code.');
    } finally {
      setWanted(null);
    }
  }

  return (
    <Panel title="Space code" testID="space-code">
      {code.isPending ? (
        <View style={{ gap: space.sm }}>
          <Skeleton width={180} height={32} />
          <Skeleton width="70%" height={16} />
        </View>
      ) : code.isError ? (
        <ErrorState error={code.error} onRetry={() => void code.refetch()} />
      ) : (
        <View style={{ gap: space.md }}>
          {value?.code ? (
            <Text
              testID="space-code-value"
              variant="headlineMedium"
              selectable
              accessibilityLabel={`Code ${spokenCode(value.code)}`}
              style={{ letterSpacing: 4, fontWeight: '700' }}
            >
              {value.code}
            </Text>
          ) : (
            <Text variant="bodyMedium" style={{ color: muted }}>
              No code yet. Make one to let people ask to join.
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {value?.code ? (
              <Button testID="space-code-share" mode="outlined" icon="share-variant" onPress={() => void share()}>
                Share
              </Button>
            ) : null}
            <Button
              testID="space-code-renew"
              mode="text"
              icon="refresh"
              onPress={makeCode}
              disabled={renew.isPending}
              loading={renew.isPending}
            >
              {value?.code ? 'Make a new code' : 'Make a code'}
            </Button>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                Let people ask to join with the code
              </Text>
              <Text variant="bodySmall" style={{ color: muted }}>
                You decide who comes in, on the People page.
              </Text>
            </View>
            <Switch
              testID="space-code-joining"
              value={joining}
              disabled={setJoining.isPending}
              onValueChange={(next) => void toggle(next)}
              accessibilityLabel="Let people ask to join with the code"
              accessibilityRole="switch"
              accessibilityState={{ checked: joining, disabled: setJoining.isPending }}
            />
          </View>
        </View>
      )}
    </Panel>
  );
}

/**
 * Phase 52: leaving the space, and -- for a space made here, by its admin -- deleting it with
 * everything in it. Both are confirmed first (a mis-tap on a phone is easy, and both are final);
 * the server refuses the last admin's leaving in its own words.
 */
export function SpaceDangerPanel({ testID = 'space-danger', leaveOnly = false }: { testID?: string; leaveOnly?: boolean }) {
  const { organization, user, leaveOrganization, refreshSession } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const leave = useLeaveSpace();
  const remove = useDeleteSpace();
  const [confirm, setConfirm] = useState('');
  if (!organization) return null;
  const org = organization;
  const deletable = !leaveOnly && mayDeleteSpace(org, user);
  const muted = theme.colors.onSurfaceVariant;

  async function land() {
    if (router.canDismiss()) router.dismissAll();
    leaveOrganization();
    await refreshSession().catch(() => undefined);
    router.replace('/');
  }

  function askLeave() {
    haptics.warning();
    Alert.alert(`Leave ${org.name}?`, 'You stop being a member. Its records of you stay.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          leave.mutate(undefined, {
            onSuccess: () => void land(),
            onError: (e) => showProblem(toast, e, 'Could not leave.'),
          }),
      },
    ]);
  }

  function deleteSpace() {
    remove.mutate(confirm, {
      onSuccess: () => {
        toast.success(`${org.name} deleted.`);
        void land();
      },
      onError: (e) => showProblem(toast, e, 'Could not delete the space.'),
    });
  }

  return (
    <Panel testID={testID}>
      <View style={{ gap: space.lg, paddingVertical: space.sm }}>
        <View style={{ gap: space.sm }}>
          {/* Not the web's bare "Leave": the confirm's button says that, and a heading of the same word
              under the alert is what a test (or a screen reader's search) would find first. */}
          <Text variant="titleSmall" accessibilityRole="header">
            Leave the space
          </Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            {`You stop being a member of ${org.name}. Its records of you stay.`}
          </Text>
          <Button
            testID="space-leave"
            mode="outlined"
            onPress={askLeave}
            disabled={leave.isPending}
            loading={leave.isPending}
            style={{ alignSelf: 'flex-start' }}
          >
            {`Leave ${org.short_name}`}
          </Button>
        </View>
        {deletable ? (
          <View style={{ gap: space.sm }}>
            <Text variant="titleSmall" accessibilityRole="header" style={{ color: theme.colors.error }}>
              Delete the space
            </Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              Everything in it goes: its people’s places, its assessments and their PDFs, its activity. Children added here
              with no account of their own are removed too. This cannot be undone. Type its name to confirm.
            </Text>
            <TextInput
              testID="space-delete-name"
              mode="outlined"
              label="The space’s name"
              placeholder={org.name}
              value={confirm}
              onChangeText={setConfirm}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              // Return deletes once the name matches, as the button does.
              onSubmitEditing={() => {
                if (deleteNameMatches(confirm, org.name) && !remove.isPending) deleteSpace();
              }}
            />
            <Button
              testID="space-delete"
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              onPress={deleteSpace}
              disabled={!deleteNameMatches(confirm, org.name) || remove.isPending}
              loading={remove.isPending}
              style={{ alignSelf: 'flex-start' }}
            >
              {`Delete ${org.short_name}`}
            </Button>
          </View>
        ) : null}
      </View>
    </Panel>
  );
}
