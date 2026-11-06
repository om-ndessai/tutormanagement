// Ported from apps/web/src/features/organizations/invite-people.tsx (Phase 61, working tree on f96b984).
// One difference, as the space code card already has it (the lead's answer, 2026-10-24): no Copy
// button -- the app has no clipboard module, and the system share sheet offers Copy on both systems.
// The invitation's words are shown under each sent row, selectable, so they can be copied by hand too.
//
// Phase 76 (JF21, JF37): opened from the one Add chooser too ("Invite by email", `/invite-people`), at any time; the
// words say what the space is for (`invitationText` with its sets) and a share is confirmed.
import {
  USER_ROLE_LABELS,
  inviteRolesFor,
  spaceInviteRowSchema,
  type SpaceInviteRole,
  type SpaceInviteRow,
} from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Icon, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import { useShareInvitation } from '@/features/users/share-invitation';
import { useInvitePerson } from './api';
import { SpaceCodePanel } from './space-code-card';

interface Row {
  key: number;
  email: string;
  full_name: string;
  role: SpaceInviteRole;
  problem: string | null;
}

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, email: '', full_name: '', role: 'parent', problem: null });

/** What a refused row says: the web's words, from the server's answer. */
export function inviteProblem(caught: unknown): string {
  if (!(caught instanceof ApiRequestError) || caught.status === 0) return 'Could not invite them. Try again.';
  if (caught.status === 409) return 'Already in this space.';
  return caught.fieldErrors.email ?? caught.fieldErrors.roles ?? caught.message;
}

/**
 * Phase 61 (S12, docs/spaces-plan.md): "Invite people", right after starting a space and before
 * the welcome wizard's start. Rows of email and role (Admin, Parent, and Tutor only where Tutoring
 * is allowed); each row is the ordinary add-person request, so the per-minute limit and the daily
 * cap apply, and the person is invited and accepts. A self-serve space sends no email, so each
 * invitation is shared by hand; the space's code is shown too.
 */
export function InvitePeople({
  onDone,
  doneLabel,
}: {
  onDone: () => void;
  /** The last button's words once someone is invited ("Continue" in the wizard, "Done" from the chooser). */
  doneLabel?: string;
}) {
  const { organization } = useAuth();
  const invite = useInvitePerson();
  const toast = useToast();
  const theme = useAppTheme();
  const muted = theme.colors.onSurfaceVariant;
  const roles = inviteRolesFor(organization);
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [sent, setSent] = useState<SpaceInviteRow[]>([]);
  const [sending, setSending] = useState(false);

  // Phase 76 (JF37): the words with what the space is for, and a share that says it went.
  const { textFor, share } = useShareInvitation();

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch, problem: null } : row)));

  async function send() {
    setSending(true);
    const left: Row[] = [];
    const done: SpaceInviteRow[] = [];
    for (const row of rows) {
      if (!row.email.trim() && !row.full_name.trim()) continue;
      const parsed = spaceInviteRowSchema.safeParse({
        // A phone's keyboard often adds a space after a suggested address; the shared schema trims
        // it too, before checking the format.
        email: row.email.trim(),
        full_name: row.full_name || undefined,
        role: row.role,
      });
      if (!parsed.success) {
        left.push({ ...row, problem: parsed.error.issues[0]?.message ?? 'Check this row.' });
        continue;
      }
      try {
        await invite.mutateAsync(parsed.data);
        done.push(parsed.data);
      } catch (caught) {
        left.push({ ...row, problem: inviteProblem(caught) });
      }
    }
    setSending(false);
    // One entry per address: someone invited again (after leaving, say) replaces their earlier line.
    setSent((current) => [...current.filter((row) => !done.some((d) => d.email === row.email)), ...done]);
    setRows(left.length > 0 ? left : [blankRow()]);
    if (left.length > 0) haptics.error();
    if (done.length > 0) toast.success(done.length === 1 ? 'Invitation made.' : `${done.length} invitations made.`);
  }

  const anyTyped = rows.some((row) => row.email.trim() || row.full_name.trim());

  return (
    <View style={{ gap: space.lg }} testID="invite-step">
      <View style={{ gap: space.md }} accessibilityLabel="Invite people">
        {rows.map((row, index) => (
          <OutlinedCard key={row.key} testID={`invite-row-${index}`} style={{ borderRadius: radius.lg }}>
            <View style={{ padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <TextInput
                  testID={`invite-email-${index}`}
                  mode="outlined"
                  label="Email"
                  placeholder="name@example.com"
                  value={row.email}
                  onChangeText={(text) => update(row.key, { email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  // Someone else's address, not the reader's sign-in. Unhinted, Android's autofill
                  // service took this and the name below for a login and offered to "Save password"
                  // (it reads fields marked unimportant too), so both say what they are; on iOS
                  // textContentType "none" wins and keeps the keyboard's suggestions away.
                  autoComplete="email"
                  textContentType="none"
                  importantForAutofill="no"
                  spellCheck={false}
                  // Return closes the keyboard, which otherwise covers Invite.
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  style={{ flex: 1 }}
                />
                {rows.length > 1 ? (
                  <IconButton
                    testID={`invite-remove-${index}`}
                    icon="close"
                    accessibilityLabel="Remove this row"
                    onPress={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                    style={{ margin: 0 }}
                  />
                ) : null}
              </View>
              <TextInput
                testID={`invite-name-${index}`}
                mode="outlined"
                label="Name (optional)"
                value={row.full_name}
                onChangeText={(text) => update(row.key, { full_name: text })}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="none"
                importantForAutofill="no"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
              />
              <Text variant="labelMedium" style={{ color: muted }}>
                Role
              </Text>
              <SegmentedButtons
                value={row.role}
                onValueChange={(value) => {
                  haptics.selection();
                  update(row.key, { role: value as SpaceInviteRole });
                }}
                buttons={roles.map((role) => ({
                  value: role,
                  label: USER_ROLE_LABELS[role],
                  testID: `invite-role-${index}-${role}`,
                  accessibilityLabel: `Role: ${USER_ROLE_LABELS[role]}`,
                }))}
              />
              {row.problem ? (
                <Text
                  testID={`invite-problem-${index}`}
                  accessibilityRole="alert"
                  variant="bodyMedium"
                  style={{ color: theme.colors.error }}
                >
                  {row.problem}
                </Text>
              ) : null}
            </View>
          </OutlinedCard>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button
            testID="invite-add-row"
            mode="outlined"
            icon="plus"
            onPress={() => setRows((current) => [...current, blankRow()])}
          >
            Another person
          </Button>
          <Button
            testID="invite-send"
            mode="contained"
            onPress={() => void send()}
            disabled={!anyTyped || sending}
            loading={sending}
          >
            Invite
          </Button>
        </View>
        <Text variant="bodySmall" style={{ color: muted }}>
          Children are added as students next, with Add a student. You can invite more people any time from People.
        </Text>
      </View>

      {sent.length > 0 ? (
        <View style={{ gap: space.sm }} accessibilityLabel="Invited">
          <Text variant="labelLarge" accessibilityRole="header" style={{ color: muted }}>
            INVITED
          </Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            No email is sent from this space. Copy each invitation, or share it, so they know to sign in.
          </Text>
          {sent.map((row) => (
            <OutlinedCard key={row.email} testID={`invite-sent-${row.email}`} style={{ borderRadius: radius.lg }}>
              <View style={{ padding: space.md, gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Icon source="check" size={18} color={theme.tokens.success} />
                  <Text testID={`invite-sent-line-${row.email}`} variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                    {row.email}
                    <Text style={{ color: muted }}>{` · ${USER_ROLE_LABELS[row.role]}`}</Text>
                  </Text>
                </View>
                <Text testID={`invite-text-${row.email}`} variant="bodySmall" selectable style={{ color: muted }}>
                  {textFor(row.email)}
                </Text>
                <Button
                  testID={`invite-share-${row.email}`}
                  mode="outlined"
                  icon="share-variant"
                  onPress={() => void share(row.email)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Share
                </Button>
              </View>
            </OutlinedCard>
          ))}
        </View>
      ) : null}

      <SpaceCodePanel />

      <View style={{ alignItems: 'flex-end' }}>
        {sent.length > 0 ? (
          <Button testID="invite-continue" mode="contained" onPress={onDone}>
            {doneLabel ?? 'Continue'}
          </Button>
        ) : (
          <Button testID="invite-skip" mode="text" onPress={onDone}>
            Skip
          </Button>
        )}
      </View>
    </View>
  );
}
