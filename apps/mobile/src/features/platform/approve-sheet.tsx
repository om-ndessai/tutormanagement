// Ported from apps/web/src/features/platform/approve-sheet.tsx @ 758a19f (working tree, built beside this one)
//
// Phase 80 (A11, A15, docs/members-plan.md; build-log entry 89): approving a sign-up, with an optional place. A space
// made in the console joins them at once (as Member, or Admin -- never for a 13-17); a self-started space gets a
// request to join filed for them, which its admins answer. Nowhere (the default): their own space is made, as before.
// The sheet says what will happen in words, and warns where Quest is off. The `/approve-account?user=<id>` route in
// the console's stack, a form sheet on Android and a page sheet on iOS (not a fitted quick sheet: the spaces are a list,
// and a list must not sit in the fitted sheet's root ScrollView; nor an iOS form sheet, which stretches the list over
// the title and the search -- see `(platform)/_layout.tsx`). The account comes from the console's cached read, never the link; the list of
// spaces is a read across spaces, so it is fetched only while this sheet is mounted.
// Mobile difference: the role is a row of two radio buttons with the chosen one's hint under it (the web's radio
// cards), so the list keeps its room on a small phone.
import { PLACEMENT_ROLE_LABELS, type AccessAccount, type PlacementRole } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Button, HelperText, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Choice } from '@/components/form-choice';
import { Screen } from '@/components/screen';
import { SearchPicker, type SearchPickerItem } from '@/components/search-picker';
import { FormSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useAccessConsole, useDecideAccess, usePlacementSpaces } from './api';
import {
  NOWHERE_ID,
  NOWHERE_LABEL,
  PLACEMENT_ROLE_HINTS,
  PLACEMENT_SHOWN,
  approveDescription,
  approveRequest,
  approveTitle,
  chosenPlacementRole,
  matchingSpaces,
  placementLine,
  placementListNote,
  placementNotes,
  placementRoles,
} from './approve-model';

function close() {
  if (router.canGoBack()) router.back();
}

export function ApproveSheet({ userId }: { userId?: string }) {
  const access = useAccessConsole();
  const data = access.data?.data;
  // Waiting, or declined lately (approved again through the same sheet).
  const account = data ? ([...data.waiting, ...data.decided].find((a) => a.user_id === userId) ?? null) : null;
  // Once Approve is pressed the console's answer marks them approved before the sheet closes: it stays the form.
  const [sent, setSent] = useState(false);

  if (!data && access.isPending) {
    return (
      <Screen testID="screen-approve-account" edges={['bottom']}>
        <FormSkeleton label="Loading the sign-up…" fields={3} />
      </Screen>
    );
  }
  if (!data && access.isError) {
    return (
      <Screen testID="screen-approve-account" edges={['bottom']}>
        <ErrorState error={access.error} onRetry={() => void access.refetch()} />
      </Screen>
    );
  }
  if (!account || (account.access === 'approved' && !sent)) {
    // Decided already, on another device or by another platform admin.
    return (
      <Screen testID="screen-approve-account" edges={['bottom']}>
        <EmptyState
          testID="access-approve-missing"
          icon="account-question-outline"
          title="That sign-up is not waiting."
          body="Someone may have decided it already."
        />
      </Screen>
    );
  }
  return <ApproveForm account={account} onSend={() => setSent(true)} />;
}

function ApproveForm({ account, onSend }: { account: AccessAccount; onSend: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const decide = useDecideAccess();
  const spaces = usePlacementSpaces(true);
  const [query, setQuery] = useState('');
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [role, setRole] = useState<PlacementRole>('member');
  const [problem, setProblem] = useState<string | null>(null);
  const muted = { color: theme.tokens.mutedForeground };

  // Memoised by the React Compiler (no manual useMemo, which it could not preserve here).
  const all = spaces.data?.data ?? [];
  const matching = matchingSpaces(all, query);
  const shown = matching.slice(0, PLACEMENT_SHOWN);
  const chosen = all.find((candidate) => candidate.id === spaceId) ?? null;
  const roles = placementRoles(chosen, account.age_band);
  const chosenRole = chosenPlacementRole(roles, role);
  const notes = chosen ? placementNotes(chosen, account.full_name) : null;
  const note = placementListNote({
    pending: spaces.isPending,
    failed: spaces.isError,
    query,
    matching: matching.length,
    shown: shown.length,
  });

  const items: SearchPickerItem[] = [
    { id: NOWHERE_ID, title: NOWHERE_LABEL },
    ...shown.map((candidate) => ({ id: candidate.id, title: candidate.name, description: placementLine(candidate) })),
  ];

  function choose(id: string) {
    // The role and Approve are under the list: the keyboard goes, so they show.
    Keyboard.dismiss();
    setProblem(null);
    setSpaceId(id === NOWHERE_ID ? null : id);
    setRole('member');
  }

  async function approve() {
    setProblem(null);
    onSend();
    try {
      await decide.mutateAsync(approveRequest(account, chosen, chosenRole));
      haptics.success();
      toast.success(`${account.full_name} approved.`);
      close();
    } catch (caught) {
      haptics.error();
      setProblem(problemMessage(caught, 'That could not be saved.'));
    }
  }

  const warningInk = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;

  return (
    <Screen
      testID="screen-approve-account"
      scroll={false}
      edges={['bottom']}
      contentStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.md, gap: space.md }}
    >
      <View testID="access-approve-sheet" style={{ flex: 1, gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <Text testID="access-approve-title" variant="titleLarge" accessibilityRole="header">
            {approveTitle(account)}
          </Text>
          <Text variant="bodyMedium" style={muted}>
            {approveDescription(account)}
          </Text>
        </View>
        <Text testID="access-approve-place-label" variant="labelLarge">
          Place them in a space (optional)
        </Text>
        <SearchPicker
          testID="access-approve"
          label="Place them in a space (optional)"
          placeholder="Search spaces…"
          items={items}
          value={spaceId ?? NOWHERE_ID}
          onChange={choose}
          query={query}
          onQueryChange={setQuery}
          // Filtered here, on name and short name; "Nowhere" stays listed whatever is typed.
          filter={false}
          footer={
            note ? (
              <Text testID="access-approve-list-note" variant="bodySmall" style={muted}>
                {note}
              </Text>
            ) : null
          }
          style={{ flex: 1, minHeight: 160 }}
        />
      </View>

      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.outlineVariant,
          paddingTop: space.md,
          gap: space.sm,
        }}
      >
        {chosen && notes ? (
          <View testID="access-approve-place" style={{ gap: space.sm }}>
            <Text variant="labelLarge">Their role there</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Their role there" style={{ flexDirection: 'row', gap: space.sm }}>
              {roles.map((choice) => (
                <Choice
                  key={choice}
                  testID={`access-approve-role-${choice}`}
                  label={PLACEMENT_ROLE_LABELS[choice]}
                  accessibilityLabel={`${PLACEMENT_ROLE_LABELS[choice]}. ${PLACEMENT_ROLE_HINTS[choice]}`}
                  selected={chosenRole === choice}
                  onPress={() => setRole(choice)}
                />
              ))}
            </View>
            <Text testID="access-approve-role-hint" variant="bodySmall" style={muted}>
              {PLACEMENT_ROLE_HINTS[chosenRole]}
            </Text>
            <Text
              testID="access-approve-words"
              variant="bodyMedium"
              style={{ padding: space.md, borderRadius: radius.md, backgroundColor: theme.tokens.muted }}
            >
              {notes.words}
            </Text>
            {notes.warning ? (
              <View
                testID="access-approve-quest-off"
                accessibilityRole="text"
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space.sm,
                  padding: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: withAlpha(theme.tokens.warning, 0.6),
                  backgroundColor: withAlpha(theme.tokens.warning, 0.12),
                }}
              >
                <Icon source="alert-outline" size={18} color={warningInk} />
                <Text variant="bodyMedium" style={{ flex: 1 }}>
                  {notes.warning}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {problem ? (
          <HelperText type="error" padding="none" testID="access-approve-problem">
            {problem}
          </HelperText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Button
            testID="access-approve-cancel"
            mode="text"
            onPress={close}
            disabled={decide.isPending}
            contentStyle={styles.button}
          >
            Cancel
          </Button>
          <Button
            testID="access-approve-confirm"
            mode="contained"
            icon="account-check-outline"
            onPress={() => void approve()}
            loading={decide.isPending}
            disabled={decide.isPending}
            style={{ flexGrow: 1 }}
            contentStyle={styles.button}
          >
            Approve
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
