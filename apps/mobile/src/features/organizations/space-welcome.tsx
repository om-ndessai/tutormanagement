// Ported from apps/web/src/features/organizations/welcome.tsx @ 9485a8e (Phase 60's "Requests sent" and
// Delete my account's condition from the working tree on f96b984; Phase 61's two choices and the
// invite step's mark likewise)
import { formatRelativeTime, type SpaceLookup } from '@tmi/shared';
import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Icon, Text, TextInput } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { problemMessage, showProblem } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import {
  useAskToJoin,
  useDeleteAccount,
  useLookupSpace,
  useMakeSpace,
  useMarkDeclinesSeen,
  useWithdrawRequest,
} from './api';
import { markInviteStep } from './invite-step';
import { OrgAvatar } from './org-avatar';
import { canMake, codeReady, deviceTimeZone, makeProblem, splitRequests, standingLine } from './space-model';

/**
 * Phase 52: what a newcomer sees after signing in -- and anyone looking for another space. Join a
 * space with its code (by asking; its admins let you in), or make your own (adults). Requests
 * waiting for an answer are listed, and may be withdrawn; a decline is shown once.
 * `firstTime` adds "Delete my account" (the person is in no space).
 *
 * Phase 61 (S11): two choices, Join with a code and Start a space (adults only; a 13-17 sees only
 * the first). A phone has no room side by side, so they stack, in that order. Starting one goes on
 * to "Invite people" (S12) inside the new space.
 */
export function SpaceWelcome({ firstTime }: { firstTime: boolean }) {
  const { joinRequests, account, memberships, invitations, platformAdmin } = useAuth();
  const mayMake = canMake(account, memberships, platformAdmin);
  const markSeen = useMarkDeclinesSeen();
  // Held here, not on the request's row: withdrawing refreshes the session, which unmounts the row
  // (and Requests sent with it) before a per-call onSuccess there would run, and TanStack drops the
  // callbacks of an unmounted observer -- so the toast would never show.
  const withdraw = useWithdrawRequest();
  const toast = useToast();
  const { open, declined } = splitRequests(joinRequests);
  const theme = useAppTheme();

  // A decline is shown once: told to the server once per visit, never again on a re-render. The
  // session is not re-read, so the line stays for this visit.
  const told = useRef(false);
  const { mutate: tellSeen } = markSeen;
  useEffect(() => {
    if (declined.length === 0 || told.current) return;
    told.current = true;
    tellSeen();
  }, [declined.length, tellSeen]);

  return (
    <View style={{ gap: space.lg }} testID="welcome">
      {declined.map((r) => (
        <View
          key={r.slug}
          testID={`welcome-declined-${r.slug}`}
          style={{ backgroundColor: theme.tokens.muted, borderRadius: radius.md, padding: space.md }}
        >
          <Text variant="bodyMedium">{`${r.name} didn’t accept your request to join.`}</Text>
        </View>
      ))}
      {open.length > 0 ? (
        <OpenRequests
          pending={withdraw.isPending}
          onWithdraw={(slug, name) =>
            withdraw.mutate(slug, {
              onSuccess: () => toast.success(`Request to ${name} withdrawn.`),
              onError: (e) => showProblem(toast, e, 'Could not withdraw the request.'),
            })
          }
        />
      ) : null}
      <View style={{ gap: space.lg }} testID="welcome-choices">
        <JoinWithCode />
        {mayMake ? <MakeSpace /> : null}
      </View>
      {mayMake ? null : (
        <Text testID="welcome-adults-only" variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          To start a space of your own you need to be 18 or older.
        </Text>
      )}
      {/* Only for someone who belongs nowhere and has nothing open (the API checks the same). */}
      {/* Not for a platform admin, whose account the API never deletes. */}
      {firstTime && !platformAdmin && memberships.length === 0 && invitations.length === 0 && open.length === 0 ? <DeleteAccount /> : null}
    </View>
  );
}

function OpenRequests({
  pending,
  onWithdraw,
}: {
  pending: boolean;
  onWithdraw: (slug: string, name: string) => void;
}) {
  const { joinRequests } = useAuth();
  const theme = useAppTheme();
  const { open } = splitRequests(joinRequests);
  return (
    <View style={{ gap: space.sm }} accessibilityLabel="Requests sent">
      <Text variant="labelLarge" accessibilityRole="header" style={{ color: theme.colors.onSurfaceVariant }}>
        REQUESTS SENT
      </Text>
      {open.map((r) => (
        <OutlinedCard key={r.slug} testID={`welcome-request-${r.slug}`} style={{ borderRadius: radius.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
            <OrgAvatar org={r} />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium">{r.name}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {`Asked ${formatRelativeTime(r.requested_at)}. Its administrators will let you in.`}
              </Text>
            </View>
            <Button
              testID={`welcome-withdraw-${r.slug}`}
              mode="text"
              compact
              disabled={pending}
              accessibilityLabel={`Withdraw the request to ${r.name}`}
              onPress={() => onWithdraw(r.slug, r.name)}
            >
              Withdraw
            </Button>
          </View>
        </OutlinedCard>
      ))}
    </View>
  );
}

function JoinWithCode() {
  const lookup = useLookupSpace();
  const ask = useAskToJoin();
  const toast = useToast();
  const theme = useAppTheme();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<SpaceLookup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const ready = codeReady(code) && !lookup.isPending;

  async function find() {
    if (!codeReady(code)) return;
    setProblem(null);
    setFound(null);
    try {
      setFound((await lookup.mutateAsync(code)).data);
    } catch (caught) {
      if (!(caught instanceof ApiRequestError && caught.code === 'rate_limited')) haptics.error();
      setProblem(problemMessage(caught, 'No space has that code.'));
    }
  }

  async function join() {
    try {
      await ask.mutateAsync(code);
      toast.success(`Asked to join ${found?.name}. Its administrators will let you in.`);
      setFound(null);
      setCode('');
    } catch (caught) {
      showProblem(toast, caught, 'Could not ask to join.');
    }
  }

  const standing = found ? standingLine(found.standing) : null;

  return (
    <OutlinedCard testID="welcome-join" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon source="key-outline" size={18} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" accessibilityRole="header">
            Join with a code
          </Text>
        </View>
        <TextInput
          testID="welcome-code"
          mode="outlined"
          label="Space code"
          placeholder="K7QM-9XDA"
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setProblem(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          returnKeyType="search"
          onSubmitEditing={() => void find()}
        />
        <Button
          testID="welcome-find"
          mode="outlined"
          onPress={() => void find()}
          disabled={!ready}
          loading={lookup.isPending}
          style={{ alignSelf: 'flex-start' }}
        >
          Find
        </Button>
        {problem ? (
          <Text testID="welcome-code-error" variant="bodyMedium" style={{ color: theme.colors.error }}>
            {problem}
          </Text>
        ) : null}
        {found ? (
          <View
            testID="welcome-found"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
              flexWrap: 'wrap',
            }}
          >
            <OrgAvatar org={found} />
            <Text testID="welcome-found-name" variant="titleMedium" style={{ flex: 1, minWidth: 120 }}>
              {found.name}
            </Text>
            {standing ? (
              <Text testID="welcome-found-standing" variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {standing}
              </Text>
            ) : (
              <Button testID="welcome-ask" mode="contained" onPress={() => void join()} loading={ask.isPending} disabled={ask.isPending}>
                Ask to join
              </Button>
            )}
          </View>
        ) : null}
      </View>
    </OutlinedCard>
  );
}

function MakeSpace() {
  const make = useMakeSpace();
  const { chooseOrganization } = useAuth();
  const toast = useToast();
  const theme = useAppTheme();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    setProblem(null);
    const refused = makeProblem(name);
    if (refused) {
      haptics.error();
      setProblem(refused);
      return;
    }
    const zone = deviceTimeZone(getCalendars());
    try {
      const made = await make.mutateAsync({ name: name.trim(), ...(zone ? { time_zone: zone } : {}) });
      toast.success(`${made.data.name} is ready.`);
      // S12: the new space opens on "Invite people", then the welcome wizard's start.
      markInviteStep(made.data.slug);
      await chooseOrganization(made.data.slug);
      // From the "Join or make a space" modal, the stack goes first; then the space's home, where
      // the welcome wizard opens on its own (a new person has not been through it).
      if (router.canDismiss()) router.dismissAll();
      router.replace('/dashboard');
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === 'rate_limited') {
        setProblem(caught.message);
        return;
      }
      haptics.error();
      setProblem(
        caught instanceof ApiRequestError && caught.status !== 0
          ? (caught.fieldErrors.name ?? caught.message)
          : 'Could not make the space.',
      );
    }
  }

  return (
    <OutlinedCard testID="welcome-make" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon source="plus" size={18} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" accessibilityRole="header">
            Start a space
          </Text>
        </View>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          For your family or your students: assessments answered by hand, with a PDF for you, and Quest. It gets its own
          code, so others can ask to join, and you can invite people next.
        </Text>
        <TextInput
          testID="welcome-space-name"
          mode="outlined"
          label="Name your space"
          placeholder="The Patel family"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setProblem(null);
          }}
          autoCorrect={false}
          autoCapitalize="words"
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={() => name.trim().length >= 2 && void submit()}
        />
        <Button
          testID="welcome-make-submit"
          mode="contained"
          onPress={() => void submit()}
          disabled={name.trim().length < 2 || make.isPending}
          loading={make.isPending}
          style={{ alignSelf: 'flex-start' }}
        >
          Start the space
        </Button>
        {problem ? (
          <Text testID="welcome-make-error" variant="bodyMedium" style={{ color: theme.colors.error }}>
            {problem}
          </Text>
        ) : null}
      </View>
    </OutlinedCard>
  );
}

function DeleteAccount() {
  const remove = useDeleteAccount();
  const { signOut } = useAuth();
  const toast = useToast();
  const theme = useAppTheme();

  function confirm() {
    haptics.warning();
    Alert.alert('Delete your account?', 'Your name, address and sign-in are removed. This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            // The cookie is already cleared; signing out tolerates that and lands on sign-in.
            onSuccess: () => void signOut(),
            onError: (e) => showProblem(toast, e, 'Could not delete the account.'),
          }),
      },
    ]);
  }

  return (
    <Button
      testID="welcome-delete-account"
      mode="text"
      onPress={confirm}
      disabled={remove.isPending}
      textColor={theme.colors.onSurfaceVariant}
      style={{ alignSelf: 'flex-start' }}
    >
      Delete my account
    </Button>
  );
}
