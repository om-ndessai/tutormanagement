// The directory's deactivate / restore / delete, from apps/web/src/features/users/users-page.tsx
// (confirmPendingAction, handleRestore) @ 1132322 -- shared by the list's row menu and the record's
// header menu so both say the same sentences.
import type { User } from '@tmi/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useDeleteUser, useRestoreUser } from './api';
import { HardDeleteDialog } from './hard-delete-dialog';

type Person = Pick<User, 'id' | 'full_name'>;

export function useUserActions({ onDeleted }: { onDeleted?: (person: Person) => void } = {}) {
  const toast = useToast();
  const deleteUser = useDeleteUser();
  const restoreUser = useRestoreUser();
  const [doomed, setDoomed] = useState<Person | null>(null);

  async function restore(person: Person) {
    try {
      await restoreUser.mutateAsync(person.id);
      toast.success(`${person.full_name} restored.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not restore that user.');
    }
  }

  async function deactivateNow(person: Person) {
    try {
      await deleteUser.mutateAsync({ id: person.id });
      // Soft, so it can be taken back at once: Undo is the restore the web offers in its menu.
      toast.success(`${person.full_name} deactivated.`, {
        label: 'Undo',
        onPress: () => void restore(person),
      });
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not complete that action.');
    }
  }

  function deactivate(person: Person) {
    haptics.warning();
    Alert.alert(
      `Deactivate ${person.full_name}?`,
      'They will be hidden from the directory but kept on file, and can be restored at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void deactivateNow(person) },
      ],
    );
  }

  function hardDelete(person: Person) {
    haptics.warning();
    setDoomed(person);
  }

  async function confirmHardDelete() {
    if (!doomed) return;
    const person = doomed;
    try {
      await deleteUser.mutateAsync({ id: person.id, hard: true });
      setDoomed(null);
      toast.success(`${person.full_name} deleted.`);
      onDeleted?.(person);
    } catch (caught) {
      setDoomed(null);
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not complete that action.');
    }
  }

  const dialog = (
    <HardDeleteDialog
      fullName={doomed?.full_name ?? ''}
      visible={doomed !== null}
      busy={deleteUser.isPending}
      onDismiss={() => setDoomed(null)}
      onConfirm={() => void confirmHardDelete()}
    />
  );

  return { deactivate, restore: (person: Person) => void restore(person), hardDelete, dialog };
}
