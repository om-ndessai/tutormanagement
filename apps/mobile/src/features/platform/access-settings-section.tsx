// Phase 65 (docs/access-approval-plan.md, A1, A2, A6, A7): who may sign up, in the console's Settings
// beneath Guest play -- the three ways (Open, Pre-approved, Post-approved), the platform's list for
// Pre-approved, the people waiting for approval, and the accounts decided lately (Revoke / Approve).
// Written beside the web's section (built in parallel): the same routes, query key and words.
// Phase 80 (A11, A15; the web's access-section.tsx @ 758a19f, working tree): Approve -- waiting, or declined lately --
// opens the approve sheet (`/approve-account`), which may place them in a space; Decline and Revoke are as before. A
// decided, approved row says where the approval placed them ("Joined <space>" / "Asked to join <space>").
import {
  ACCESS_MODES,
  ACCESS_MODE_DESCRIPTIONS,
  ACCESS_MODE_LABELS,
  AUTH_PROVIDER_LABELS,
  accessListEntrySchema,
  formatRelativeTime,
  type AccessAccount,
  type AccessConsoleResponse,
  type AccessListEntry,
  type AccessMode,
  type AuthProvider,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Divider, Text, TextInput } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { Choice } from '@/components/form-choice';
import { IconButton } from '@/components/icon-button';
import { Panel } from '@/components/section';
import { DetailSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useAccessConsole, useAddAccessEntry, useDecideAccess, useRemoveAccessEntry, useSaveAccessMode } from './api';
import { placedLine } from './approve-model';

/** "13-17" or "Adult". */
export function ageBandLabel(band: string): string {
  return band === 'adult' ? 'Adult' : band;
}

/** "Google and Microsoft"; "no way in yet" when the account has none (a developer sign-up). */
export function providersLabel(providers: string[]): string {
  const names = providers.map((provider) => AUTH_PROVIDER_LABELS[provider as AuthProvider] ?? provider);
  if (names.length === 0) return 'Developer sign-in';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What a list row matches: the email or pattern, or "google: <id>". */
export function entryLabel(entry: Pick<AccessListEntry, 'email' | 'provider' | 'subject'>): string {
  if (entry.email) return entry.email;
  return `${entry.provider ?? 'account'}: ${entry.subject ?? ''}`;
}

/** "Nov 3, 2026" on the device's clock (the console belongs to no space). */
export function dayLabel(iso: string): string {
  const at = new Date(iso);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][at.getMonth()];
  return `${month} ${at.getDate()}, ${at.getFullYear()}`;
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiRequestError && caught.status !== 0 ? caught.message : fallback;
}

export function AccessSettingsSection() {
  const access = useAccessConsole();
  if (access.isPending) return <DetailSkeleton label="Loading sign-up access…" />;
  if (access.isError) return <ErrorState error={access.error} onRetry={() => void access.refetch()} />;
  return <AccessEditor data={access.data.data} />;
}

/**
 * The top of Settings: the mode and the people waiting, with Review jumping down to the block, which
 * sits in Guest play below the long list of tiles.
 */
export function AccessJump({ onReview }: { onReview: () => void }) {
  const theme = useAppTheme();
  const access = useAccessConsole();
  const data = access.data?.data;
  if (!data) return null;
  const waiting = data.waiting.length;
  return (
    <Panel testID="access-jump">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleSmall" style={{ fontWeight: '600' }}>
            Sign-up access: {ACCESS_MODE_LABELS[data.settings.mode]}
          </Text>
          <Text testID="access-jump-waiting" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {waiting > 0 ? `${waiting} waiting for approval` : 'Nobody waiting'}
          </Text>
        </View>
        <Button mode={waiting > 0 ? 'contained' : 'outlined'} onPress={onReview} testID="access-jump-review">
          Review
        </Button>
      </View>
    </Panel>
  );
}

function AccessEditor({ data }: { data: AccessConsoleResponse }) {
  const theme = useAppTheme();
  const muted = { color: theme.tokens.mutedForeground };
  const { mode } = data.settings;
  const waiting = data.waiting.length;
  return (
    <View testID="access-settings" style={{ gap: space.lg }}>
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
        {waiting > 0 ? `Sign-up access · ${waiting} waiting` : 'Sign-up access'}
      </Text>
      <Text variant="bodySmall" style={muted}>
        Who may sign up, once sign-up is open. People a space adds or invites are not affected.
      </Text>
      <ModePanel mode={mode} />
      {mode === 'preapproved' || data.list.length > 0 ? <ListPanel list={data.list} /> : null}
      {mode === 'postapproved' || waiting > 0 ? <WaitingPanel waiting={data.waiting} /> : null}
      {data.decided.length > 0 ? <DecidedPanel decided={data.decided} /> : null}
    </View>
  );
}

function ModePanel({ mode }: { mode: AccessMode }) {
  const theme = useAppTheme();
  const toast = useToast();
  const save = useSaveAccessMode();

  async function choose(next: AccessMode) {
    if (next === mode || save.isPending) return;
    try {
      await save.mutateAsync({ mode: next });
      haptics.success();
      toast.success(`Sign-up access: ${ACCESS_MODE_LABELS[next]}.`);
    } catch (caught) {
      toast.error(failure(caught, 'Sign-up access could not be saved.'));
    }
  }

  return (
    <Panel testID="access-mode">
      <View style={{ gap: space.sm, paddingVertical: space.xs }}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.sm }}>
          {ACCESS_MODES.map((option) => (
            <Choice
              key={option}
              testID={`access-mode-${option}`}
              label={ACCESS_MODE_LABELS[option]}
              selected={mode === option}
              onPress={() => void choose(option)}
            />
          ))}
        </View>
        <Text testID="access-mode-description" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {ACCESS_MODE_DESCRIPTIONS[mode]}
        </Text>
      </View>
    </Panel>
  );
}

function ListPanel({ list }: { list: AccessListEntry[] }) {
  const theme = useAppTheme();
  const toast = useToast();
  const add = useAddAccessEntry();
  const remove = useRemoveAccessEntry();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const muted = { color: theme.tokens.mutedForeground };

  async function submit() {
    setProblem(null);
    const parsed = accessListEntrySchema.safeParse({ email: email.trim() || null, note: note.trim() || null });
    if (!parsed.success) {
      haptics.error();
      setProblem(parsed.error.issues[0]?.message ?? 'That entry could not be added.');
      return;
    }
    try {
      await add.mutateAsync(parsed.data);
      haptics.success();
      toast.success(`${parsed.data.email} may sign up.`);
      setEmail('');
      setNote('');
    } catch (caught) {
      haptics.error();
      setProblem(failure(caught, 'That entry could not be added.'));
    }
  }

  function confirmRemove(entry: AccessListEntry) {
    haptics.warning();
    Alert.alert(`Remove ${entryLabel(entry)}?`, 'They will no longer be able to sign up while sign-up is Pre-approved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void remove
            .mutateAsync(entry.id)
            .then(() => toast.success(`${entryLabel(entry)} removed from the list.`))
            .catch((caught: unknown) => toast.error(failure(caught, 'That entry could not be removed.'))),
      },
    ]);
  }

  return (
    <Panel title="Pre-approved list" testID="access-list">
      <View style={{ gap: space.md }}>
        {list.length === 0 ? (
          <Text testID="access-list-empty" variant="bodyMedium" style={muted}>
            Nobody is on the list yet.
          </Text>
        ) : (
          list.map((entry, index) => (
            <View key={entry.id} style={{ gap: space.sm }}>
              {index > 0 ? <Divider /> : null}
              <View testID={`access-list-row-${entry.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="labelLarge">{entryLabel(entry)}</Text>
                  {entry.note ? <Text variant="bodySmall">{entry.note}</Text> : null}
                  <Text variant="bodySmall" style={muted}>
                    {`Added ${formatRelativeTime(entry.added_at)}${entry.added_by_name ? ` by ${entry.added_by_name}` : ''}`}
                  </Text>
                </View>
                <IconButton
                  testID={`access-list-remove-${entry.id}`}
                  icon="close"
                  accessibilityLabel={`Remove ${entryLabel(entry)}`}
                  disabled={remove.isPending}
                  onPress={() => confirmRemove(entry)}
                />
              </View>
            </View>
          ))
        )}
        <Divider />
        <TextInput
          testID="access-list-add-email"
          mode="outlined"
          label="Email or pattern"
          placeholder="*@school.org"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setProblem(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          error={problem !== null}
        />
        <TextInput
          testID="access-list-add-note"
          mode="outlined"
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
        />
        {problem ? <FieldError testID="access-list-error">{problem}</FieldError> : null}
        <Button
          testID="access-list-add"
          mode="contained"
          style={{ alignSelf: 'flex-start' }}
          loading={add.isPending}
          disabled={add.isPending || email.trim() === ''}
          onPress={() => void submit()}
        >
          Add to the list
        </Button>
      </View>
    </Panel>
  );
}

/** Phase 80 (A11): Approve asks where to place them first, in the approve sheet. */
function openApprove(account: AccessAccount) {
  haptics.selection();
  router.push({ pathname: '/approve-account', params: { user: account.user_id } });
}

/** Decline and Revoke: at once, after the alert, as before. */
function useDecide() {
  const toast = useToast();
  const decide = useDecideAccess();
  async function run(account: AccessAccount, done: string) {
    try {
      await decide.mutateAsync({ userId: account.user_id, access: 'declined' });
      haptics.warning();
      toast.success(done);
    } catch (caught) {
      toast.error(failure(caught, 'That decision could not be saved.'));
    }
  }
  return { run, pending: decide.isPending };
}

function WaitingPanel({ waiting }: { waiting: AccessAccount[] }) {
  const theme = useAppTheme();
  const muted = { color: theme.tokens.mutedForeground };
  const { run, pending } = useDecide();

  function confirmDecline(account: AccessAccount) {
    haptics.warning();
    Alert.alert(`Decline ${account.full_name}?`, 'Their account is kept, blocked. You can approve it later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => void run(account, `${account.full_name} declined.`) },
    ]);
  }

  return (
    <Panel title={`Waiting for approval (${waiting.length})`} testID="access-waiting">
      <View style={{ gap: space.md }}>
        {waiting.length === 0 ? (
          <Text testID="access-waiting-empty" variant="bodyMedium" style={muted}>
            Nobody is waiting.
          </Text>
        ) : (
          waiting.map((account, index) => (
            <View key={account.user_id} style={{ gap: space.sm }}>
              {index > 0 ? <Divider /> : null}
              <View testID={`access-waiting-${account.user_id}`} style={{ gap: 2 }}>
                <Text variant="labelLarge">{account.full_name}</Text>
                {account.email ? <Text variant="bodySmall">{account.email}</Text> : null}
                <Text variant="bodySmall" style={muted}>
                  {`${ageBandLabel(account.age_band)} · ${providersLabel(account.providers)} · signed up ${dayLabel(account.signed_up_at)}`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <Button
                  testID={`access-approve-${account.user_id}`}
                  mode="contained"
                  compact
                  disabled={pending}
                  onPress={() => openApprove(account)}
                >
                  Approve
                </Button>
                <Button
                  testID={`access-decline-${account.user_id}`}
                  mode="outlined"
                  compact
                  disabled={pending}
                  onPress={() => confirmDecline(account)}
                >
                  Decline
                </Button>
              </View>
            </View>
          ))
        )}
      </View>
    </Panel>
  );
}

function DecidedPanel({ decided }: { decided: AccessAccount[] }) {
  const theme = useAppTheme();
  const muted = { color: theme.tokens.mutedForeground };
  const { run, pending } = useDecide();

  function confirmRevoke(account: AccessAccount) {
    haptics.warning();
    Alert.alert(`Revoke ${account.full_name}'s access?`, 'They are signed out on their next request. You can approve them again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => void run(account, `${account.full_name}'s access revoked.`) },
    ]);
  }

  return (
    <Panel title="Recently decided" testID="access-decided">
      <View style={{ gap: space.md }}>
        {decided.map((account, index) => {
          const approved = account.access === 'approved';
          const when = account.decided_at ? ` ${formatRelativeTime(account.decided_at)}` : '';
          const by = account.decided_by_name ? ` by ${account.decided_by_name}` : '';
          return (
            <View key={account.user_id} style={{ gap: space.sm }}>
              {index > 0 ? <Divider /> : null}
              <View testID={`access-decided-${account.user_id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="labelLarge">{account.full_name}</Text>
                  <Text variant="bodySmall" style={muted}>
                    {`${approved ? 'Approved' : 'Declined'}${by}${when}`}
                  </Text>
                  {approved && account.placed_in ? (
                    <Text testID={`access-placed-${account.user_id}`} variant="bodySmall" style={muted}>
                      {placedLine(account.placed_in)}
                    </Text>
                  ) : null}
                </View>
                {approved ? (
                  <Button
                    testID={`access-revoke-${account.user_id}`}
                    mode="outlined"
                    compact
                    disabled={pending}
                    onPress={() => confirmRevoke(account)}
                  >
                    Revoke
                  </Button>
                ) : (
                  <Button
                    testID={`access-approve-${account.user_id}`}
                    mode="contained-tonal"
                    compact
                    disabled={pending}
                    onPress={() => openApprove(account)}
                  >
                    Approve
                  </Button>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}
