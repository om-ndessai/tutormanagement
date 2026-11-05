// Ported from apps/web/src/features/organizations/code-sheet.tsx @ 98c40ab (working tree)
//
// The one "Have a code?" door (UI audit JF4, owner 2026-11-04): from the guest page, the home's quick action, the
// Quest board's box and a code kept on this phone, the same sheet. It always says what a code found before sending:
// a space's NAME first (then the role asked for, a note, and "Ask to join"), or a game (its join choices). Signed
// out, a code is kept on this phone through sign-up and approval, and the first home offers it (KeptForYou).
//
// Mobile: signed in it is the `/have-a-code?code=` route, a fitted quick sheet. A six-character code goes to the
// game's own join sheet (JoinGameSheet, the one join path: it looks the code up, says a refusal in the server's
// words -- "No game in this space has that code..." for another space's -- and offers the choices). Signed out it
// is a Paper dialog over the guest page (GuestCodeSheet): it only keeps the code, nothing is sent.
import {
  JOIN_NOTE_MAX,
  JOIN_REQUEST_ROLE_HINTS,
  JOIN_REQUEST_ROLE_LABELS,
  type JoinRequestRole,
  type SpaceLookup,
} from '@tmi/shared';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Dialog, Icon, Portal, Text, TextInput } from 'react-native-paper';

import { QuickSheet } from '@/components/quick-sheet';
import { useToast } from '@/components/toast';
import { guestMemory } from '@/features/guest/guest-store';
import { codeKind, tidyCode } from '@/features/play/play-model';
import { CODE_FONT } from '@/features/quest/game-style';
import { JoinGameSheet } from '@/features/quest/join-game-sheet';
import { ApiRequestError } from '@/lib/api-client';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

import { useAskToJoin, useLookupSpace } from './api';
import {
  CODE_SHEET_HINT,
  askedToJoinText,
  codeSheetStanding,
  joinAskRequest,
  joinAskRole,
  joinAskRoles,
  keptText,
} from './code-sheet-model';
import { OrgAvatar } from './org-avatar';

/** The code box of both sheets: a code reads best in a fixed-width face, spaced out. */
function CodeField({ value, onChange, onSubmit }: { value: string; onChange: (text: string) => void; onSubmit: () => void }) {
  return (
    <TextInput
      testID="code-sheet-code"
      mode="outlined"
      label="Code"
      placeholder="Game or space code"
      accessibilityLabel="Game or space code"
      value={value}
      onChangeText={onChange}
      autoCapitalize="characters"
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
      // Android's keyboard would offer words; this one does not.
      keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
      maxLength={12}
      returnKeyType="go"
      onSubmitEditing={onSubmit}
      contentStyle={{ fontFamily: CODE_FONT, letterSpacing: 3, fontSize: 18 }}
    />
  );
}

/**
 * Signed in: the `/have-a-code` sheet. `initialCode` (a kept one, the Quest board's box) is looked up at once.
 */
export function CodeSheet({ initialCode = '' }: { initialCode?: string }) {
  const lookup = useLookupSpace();
  const ask = useAskToJoin();
  const toast = useToast();
  const start = tidyCode(initialCode);
  const [code, setCode] = useState(start);
  // A game's code goes to the game's own join sheet, which looks it up.
  const [game, setGame] = useState<string | null>(() => (codeKind(start) === 'game' ? start : null));
  const [found, setFound] = useState<(SpaceLookup & { code: string }) | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);
  const joining = useJoinAsk(found);
  const typed = tidyCode(code);
  const kind = codeKind(typed);

  // The space a code opens, or why not. Used: a code kept on this phone is offered no more.
  const findSpace = (value: string) =>
    lookup.mutateAsync(value).then(
      (answer) => {
        guestMemory.dropCode();
        setFound({ ...answer.data, code: value });
      },
      (caught: unknown) => {
        if (!(caught instanceof ApiRequestError && caught.code === 'rate_limited')) haptics.error();
        setProblem(problemMessage(caught, 'Could not find that code.'));
      },
    );

  function go() {
    if (!kind) return;
    setProblem(null);
    if (kind === 'game') {
      guestMemory.dropCode();
      setGame(typed);
      return;
    }
    void findSpace(typed);
  }

  async function askToJoin(leave: () => void) {
    if (!found) return;
    setProblem(null);
    try {
      await ask.mutateAsync(joinAskRequest(found.code, joining.role, joining.note));
      toast.success(askedToJoinText(found.name));
      leave();
    } catch (caught) {
      haptics.error();
      setProblem(problemMessage(caught, 'Could not ask to join.'));
    }
  }

  // A code to start from is looked up once, as the sheet opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (codeKind(start) === 'game') guestMemory.dropCode();
    else if (codeKind(start) === 'space') void findSpace(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (game) return <JoinGameSheet code={game} />;

  if (found) {
    const open = found.standing === null;
    return (
      <QuickSheet
        testID="code-sheet"
        actionTestID="code-sheet"
        titleTestID="code-sheet-space"
        title={found.name}
        description={codeSheetStanding(found)}
        primaryTestID={open ? 'code-sheet-ask' : 'code-sheet-done'}
        primaryLabel={open ? 'Ask to join' : 'Done'}
        primaryIcon={open ? 'account-plus-outline' : undefined}
        cancelTestID="code-sheet-another"
        cancelLabel="Another code"
        onCancel={() => {
          setFound(null);
          setCode('');
          setProblem(null);
        }}
        loading={ask.isPending}
        error={problem}
        onPrimary={({ leave }) => (open ? askToJoin(() => leave()) : leave())}
      >
        <View style={{ gap: space.md }}>
          <OrgAvatar org={found} />
          {open ? <JoinAskFields space={found} ask={joining} /> : null}
        </View>
      </QuickSheet>
    );
  }

  return (
    <QuickSheet
      testID="code-sheet"
      actionTestID="code-sheet"
      primaryTestID="code-sheet-go"
      title="Have a code?"
      description={CODE_SHEET_HINT}
      primaryLabel="Look it up"
      primaryDisabled={!kind}
      loading={lookup.isPending}
      error={problem}
      onPrimary={() => go()}
    >
      <CodeField
        value={code}
        onChange={(text) => {
          setCode(text);
          setProblem(null);
        }}
        onSubmit={go}
      />
    </QuickSheet>
  );
}

/**
 * Signed out (the guest page's "Have a code?"): the code is kept on this phone, never sent, and waits on the first
 * screen once the person has signed up or signed in. A Paper dialog over the page.
 */
export function GuestCodeSheet({
  visible,
  onClose,
  onSignUp,
}: {
  visible: boolean;
  onClose: () => void;
  /** The guest page's sign-up (or sign-in, where sign-up is closed), offered once the code is kept. */
  onSignUp: () => void;
}) {
  // The typed code lives INSIDE the portal (GuestCodeBody): state held out here reached the field through the
  // portal host's asynchronous update, and fast typing lost characters ("fmxy-2345" kept as "FMY345").
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} testID="code-sheet">
        {visible ? <GuestCodeBody onClose={onClose} onSignUp={onSignUp} /> : null}
      </Dialog>
    </Portal>
  );
}

function GuestCodeBody({ onClose, onSignUp }: { onClose: () => void; onSignUp: () => void }) {
  const theme = useAppTheme();
  const [code, setCode] = useState('');
  const [kept, setKept] = useState<string | null>(null);
  const typed = tidyCode(code);
  const kind = codeKind(typed);

  function keep() {
    if (!kind) return;
    guestMemory.keepCode(typed);
    haptics.success();
    setKept(typed);
  }

  return (
    <View>
      <Dialog.Title accessibilityRole="header">{kept ? 'Kept on this device' : 'Have a code?'}</Dialog.Title>
      <Dialog.Content style={{ gap: space.md }}>
        {kept ? (
          <Text testID="code-sheet-kept" variant="bodyMedium">
            {keptText(kept)}
          </Text>
        ) : (
          <>
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {CODE_SHEET_HINT}
            </Text>
            <CodeField value={code} onChange={setCode} onSubmit={keep} />
          </>
        )}
      </Dialog.Content>
      {kept ? (
        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm }}>
          <Button
            testID="code-sheet-sign-up"
            mode="contained"
            contentStyle={{ minHeight: 48 }}
            onPress={() => {
              onClose();
              onSignUp();
            }}
          >
            Sign up or sign in
          </Button>
          <Button testID="code-sheet-keep-playing" mode="text" contentStyle={{ minHeight: 48 }} onPress={onClose}>
            Keep playing
          </Button>
        </View>
      ) : (
        <Dialog.Actions>
          <Button testID="code-sheet-cancel" onPress={onClose}>
            Cancel
          </Button>
          <Button testID="code-sheet-go" mode="contained" disabled={!kind} onPress={keep}>
            Keep it
          </Button>
        </Dialog.Actions>
      )}
    </View>
  );
}

/** What a request asks for (owner, 2026-11-04; UI audit JF26): a role, a parent's by default, and a short note. */
export interface JoinAsk {
  role: JoinRequestRole;
  note: string;
  roles: JoinRequestRole[];
  setRole: (role: JoinRequestRole) => void;
  setNote: (note: string) => void;
}

export function useJoinAsk(space: Pick<SpaceLookup, 'offers_tutoring'> | null): JoinAsk {
  const { account } = useAuth();
  const roles = joinAskRoles(account, space);
  const [chosen, setRole] = useState<JoinRequestRole | null>(null);
  const [note, setNote] = useState('');
  // A teen asks as a learner; anyone else as a parent unless they choose otherwise.
  return { role: joinAskRole(chosen, roles), note, roles, setRole, setNote };
}

/** The role and the note, above "Ask to join". The space's admins read both; nobody else does (R32). */
export function JoinAskFields({ space: target, ask }: { space: Pick<SpaceLookup, 'name'>; ask: JoinAsk }) {
  const legend = `You are joining ${target.name} as`;
  return (
    <View testID="join-ask" style={{ gap: space.md }}>
      {ask.roles.length > 1 ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={legend} style={{ gap: space.sm }}>
          <Text variant="titleSmall">{legend}</Text>
          {ask.roles.map((role) => (
            <JoinRoleChoice key={role} role={role} chosen={ask.role} onChoose={ask.setRole} />
          ))}
        </View>
      ) : null}
      <TextInput
        testID="join-ask-note"
        mode="outlined"
        label="A note for its admins (optional)"
        placeholder="Who you are, or whose parent"
        value={ask.note}
        onChangeText={ask.setNote}
        // A short line: Return puts the keyboard away, so "Ask to join" is in reach on a phone.
        maxLength={JOIN_NOTE_MAX}
        autoCapitalize="sentences"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
      />
    </View>
  );
}

function JoinRoleChoice({
  role,
  chosen,
  onChoose,
}: {
  role: JoinRequestRole;
  chosen: JoinRequestRole;
  onChoose: (role: JoinRequestRole) => void;
}) {
  const theme = useAppTheme();
  const selected = chosen === role;
  return (
    <Pressable
      testID={`join-ask-role-${role}`}
      accessibilityRole="radio"
      accessibilityLabel={`${JOIN_REQUEST_ROLE_LABELS[role]}. ${JOIN_REQUEST_ROLE_HINTS[role]}`}
      // `selected` too, as the grade row's: what a flow reads on both systems.
      accessibilityState={{ checked: selected, selected }}
      onPress={() => {
        haptics.selection();
        onChoose(role);
      }}
      style={({ pressed }) => ({
        minHeight: MIN_TARGET,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
      })}
    >
      <Icon
        source={selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={22}
        color={selected ? theme.colors.primary : theme.tokens.mutedForeground}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSmall">{JOIN_REQUEST_ROLE_LABELS[role]}</Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {JOIN_REQUEST_ROLE_HINTS[role]}
        </Text>
      </View>
    </Pressable>
  );
}
