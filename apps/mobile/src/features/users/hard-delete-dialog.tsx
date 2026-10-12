// The web's "Delete <name>?" alert (users-page.tsx) @ 1132322, with one more step: the admin types
// the person's name before the destructive button enables. On a phone a permanent delete sits one
// mis-tap away in a menu, and it cannot be undone.
import { useState } from 'react';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useAppTheme } from '@/providers/theme-provider';
import { confirmsName } from './people-model';

export function HardDeleteDialog({
  fullName,
  visible,
  busy,
  onDismiss,
  onConfirm,
}: {
  fullName: string;
  visible: boolean;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const theme = useAppTheme();
  // Uncontrolled (ux-audit F-7): a controlled field re-rendered the dialog on every key while it
  // moved with the keyboard, and the simulator's keyboard dropped keys ("jae x"). Only whether the
  // name matches is state, so the dialog re-renders when that flips, not per key. The dialog's
  // content unmounts when it closes, so it reopens empty.
  const [matches, setMatches] = useState(false);
  const onChangeText = (text: string) => setMatches(confirmsName(text, fullName));
  // A Paper dialog sits in the middle of the whole screen, so the keyboard covered its buttons on
  // iOS: Delete permanently could not be reached without putting the keyboard away first. A bottom
  // margin as tall as the keyboard centres it in the part left visible.
  const keyboard = useKeyboardHeight();
  const dismiss = () => {
    setMatches(false);
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={dismiss}
        testID="person-delete-dialog"
        style={keyboard > 0 ? { marginBottom: keyboard } : undefined}
      >
        <Dialog.Title>{`Delete ${fullName}?`}</Dialog.Title>
        <Dialog.Content style={{ gap: 12 }}>
          <Text variant="bodyMedium">
            This permanently removes the record. This cannot be undone — deactivate instead if you may need
            the history.
          </Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            Type their name to confirm.
          </Text>
          <TextInput
            testID="person-delete-input"
            mode="outlined"
            dense
            defaultValue=""
            onChangeText={onChangeText}
            placeholder={fullName}
            // The check ignores case: nothing to capitalise, correct or complete.
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            returnKeyType="done"
            accessibilityLabel={`Type ${fullName} to confirm`}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="person-delete-cancel" onPress={dismiss}>
            Cancel
          </Button>
          <Button
            testID="person-delete-confirm"
            // Paper's textColor outranks its disabled colour: set it only once the name matches.
            textColor={matches && !busy ? theme.colors.error : undefined}
            disabled={!matches || busy}
            loading={busy}
            onPress={() => {
              setMatches(false);
              onConfirm();
            }}
          >
            Delete permanently
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
