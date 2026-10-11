// A lesson's verbs on the Sessions list (ux-audit F-8): the swipe, the long-press menu and the
// card's accessibility actions all come from here, so the three never disagree. Who may do what
// is the API's: Edit and Delete for the office or the lesson's own tutor (the 403 in
// `DELETE /sessions/:id` and `PATCH /sessions/:id`), Assess and Reflect exactly where the card's
// own buttons show.
import type { TutoringSession, User } from '@tmi/shared';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import type { RowAction } from '@/components/swipe-row';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useDeleteSession } from './api';
import { assessLabel, reflectLabel } from './session-actions';
import { describeSessionMoney } from './session-money';

type Reader = Pick<User, 'id' | 'roles'> | null;

/** The office, or the lesson's own tutor: what the API lets edit or delete a lesson. */
export function mayEditSession(session: Pick<TutoringSession, 'tutor_user_id'>, user: Reader): boolean {
  return Boolean(user && (user.roles.includes('admin') || session.tutor_user_id === user.id));
}

/** Which verbs a reader gets on a lesson, in menu order (pure, so the rule is tested alone). */
export function sessionRowVerbs(session: TutoringSession, user: Reader) {
  const assess = assessLabel(session, user);
  const reflect = reflectLabel(session, user);
  const edit = mayEditSession(session, user);
  return {
    assess: assess?.label ?? null,
    reflect: reflect?.label ?? null,
    edit,
    delete: edit,
  };
}

/** Asks, then deletes: a lesson is a billing record and there is no way to bring it back. */
export function useConfirmDeleteSession(showMoney: boolean, onDeleted?: () => void) {
  const toast = useToast();
  const remove = useDeleteSession();
  const confirm = useCallback(
    (session: TutoringSession) => {
      haptics.warning();
      Alert.alert(
        'Delete this session?',
        `The ${session.occurred_on} session with ${session.student_name}, and ${
          showMoney ? describeSessionMoney(session) : 'its record'
        }, will be removed. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              remove.mutate(session.id, {
                onSuccess: () => {
                  toast.success('Session deleted.');
                  onDeleted?.();
                },
                onError: (error) =>
                  toast.error(
                    error instanceof ApiRequestError ? error.message : 'Could not delete the session.',
                  ),
              });
            },
          },
        ],
      );
    },
    [remove, toast, showMoney, onDeleted],
  );
  return { confirm, isPending: remove.isPending };
}

/** The row actions for one lesson card. */
export function sessionRowActions(
  session: TutoringSession,
  user: Reader,
  { showMoney, onDelete }: { showMoney: boolean; onDelete: (session: TutoringSession) => void },
): RowAction[] {
  const verbs = sessionRowVerbs(session, user);
  const actions: RowAction[] = [];
  if (verbs.assess) {
    actions.push({
      key: 'assess',
      label: verbs.assess,
      icon: 'message-text-outline',
      onPress: () => router.push({ pathname: '/assess-session', params: { session: session.id } }),
    });
  }
  if (verbs.reflect) {
    actions.push({
      key: 'reflect',
      label: verbs.reflect,
      icon: 'emoticon-happy-outline',
      onPress: () => router.push({ pathname: '/reflection', params: { session: session.id } }),
    });
  }
  if (verbs.edit) {
    actions.push({
      key: 'edit',
      label: 'Edit',
      icon: 'pencil-outline',
      onPress: () =>
        router.push({
          pathname: '/record-session',
          params: { id: session.id, tab: showMoney ? 'finance' : 'tutoring' },
        }),
    });
  }
  if (verbs.delete) {
    actions.push({
      key: 'delete',
      label: 'Delete',
      icon: 'trash-can-outline',
      destructive: true,
      onPress: () => onDelete(session),
    });
  }
  return actions;
}
