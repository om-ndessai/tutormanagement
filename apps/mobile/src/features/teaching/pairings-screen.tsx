// Ported from apps/web/src/features/teaching/assignments-page.tsx @ 1132322.
//
// Which tutor teaches which student. The list is the server's, scoped to the reader: a tutor gets
// their students, a parent who teaches their children, a student their own tutors. A pairing's
// rates are what its tutor is paid, so they reach only that tutor and the office (R5): the API
// blanks them for everyone else and this screen renders a rate line only for a reader who may see
// one. Only an admin changes pairings.
import type { Assignment, UserRole } from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, IconButton, Text } from 'react-native-paper';

import { FocusNotice } from '@/components/focus-notice';
import { CommentsButton } from '@/features/comments/comments-button';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useAssignments, useDeleteAssignment } from './api';
import { PairingRates, seesPairingPay } from './pairing-rates';

export function PairingsScreen() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const muted = theme.tokens.mutedForeground;
  const isAdmin = user?.roles.includes('admin') ?? false;
  const { description, empty } = copyFor(user?.roles ?? []);
  const viewer = user ? { id: user.id, isAdmin } : null;

  const { data, isPending, error, refetch } = useAssignments();
  const remove = useDeleteAssignment();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * A link from the comments feed names one pairing. The whole list is already loaded here, so
   * singling it out is a filter rather than another request.
   */
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusId = params.focus || null;
  const all = data?.data ?? [];
  const assignments = focusId ? all.filter((row) => row.id === focusId) : all;
  const clearFocus = () => router.setParams({ focus: undefined });

  const openForm = (assignment?: Assignment) =>
    router.push(
      assignment ? { pathname: '/assignment-form', params: { id: assignment.id } } : '/assignment-form',
    );

  function confirmRemove(assignment: Assignment) {
    haptics.warning();
    Alert.alert(
      `Remove ${assignment.student_name} from ${assignment.tutor_name}?`,
      'They will no longer be able to record sessions for this student. Sessions already taught are kept, along with their billing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            remove.mutate(assignment.id, {
              onSuccess: () =>
                toast.success(`${assignment.student_name} removed from ${assignment.tutor_name}.`),
              onError: (failure) =>
                toast.error(
                  failure instanceof ApiRequestError ? failure.message : 'Could not remove the pairing.',
                ),
            }),
        },
      ],
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-pairings" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen
        options={{
          title: 'Pairings',
          headerRight: isAdmin
            ? () => (
                <IconButton
                  testID="pairings-add"
                  icon="plus"
                  size={24}
                  accessibilityLabel="Assign a student"
                  style={{ margin: 0 }}
                  onPress={() => openForm()}
                />
              )
            : undefined,
        }}
      />
      <Text testID="pairings-description" variant="bodyMedium" style={{ color: muted }}>
        {description}
      </Text>
      {isAdmin ? (
        <Button
          testID="pairings-add-button"
          mode="contained"
          icon="plus"
          onPress={() => openForm()}
          style={{ alignSelf: 'flex-start' }}
        >
          Assign a student
        </Button>
      ) : null}

      <FocusNotice
        active={Boolean(focusId)}
        found={assignments.length > 0}
        what="assignment"
        onClear={clearFocus}
      />

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading pairings"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="100%" height={84} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : null}

      {!isPending && !error && assignments.length === 0 && !focusId ? (
        <EmptyState
          testID="pairings-empty"
          icon="link-variant"
          title={empty}
          body={isAdmin ? 'Assign one to let their tutor record sessions.' : undefined}
        />
      ) : null}

      {assignments.map((assignment) => (
        <PairingCard
          key={assignment.id}
          assignment={assignment}
          isAdmin={isAdmin}
          seesPay={seesPairingPay(assignment, viewer)}
          onEdit={() => openForm(assignment)}
          onRemove={() => confirmRemove(assignment)}
        />
      ))}
    </Screen>
  );
}

function PairingCard({
  assignment,
  isAdmin,
  seesPay,
  onEdit,
  onRemove,
}: {
  assignment: Assignment;
  isAdmin: boolean;
  seesPay: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;

  return (
    <Card testID={`pairing-card-${assignment.id}`} mode="outlined" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.md, paddingLeft: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">{assignment.student_name}</Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              with {assignment.tutor_name}
            </Text>
          </View>
          <CommentsButton
            testID={`pairing-comments-${assignment.id}`}
            target={{ target_type: 'assignment', target_id: assignment.id }}
            title={`${assignment.student_name}’s pairing`}
            description={`${assignment.student_name} is taught by ${assignment.tutor_name}.`}
          />
          {isAdmin ? (
            <>
              <IconButton
                testID={`pairing-edit-${assignment.id}`}
                icon="pencil-outline"
                accessibilityLabel={`Edit ${assignment.student_name}'s assignment`}
                onPress={onEdit}
                style={{ margin: 0 }}
              />
              <IconButton
                testID={`pairing-remove-${assignment.id}`}
                icon="trash-can-outline"
                accessibilityLabel={`Remove ${assignment.student_name} from ${assignment.tutor_name}`}
                onPress={onRemove}
                style={{ margin: 0 }}
              />
            </>
          ) : null}
        </View>
        {seesPay ? <PairingRates assignment={assignment} isAdmin={isAdmin} /> : null}
        {assignment.notes ? (
          <Text testID={`pairing-notes-${assignment.id}`} variant="bodySmall" style={{ color: muted }}>
            {assignment.notes}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * What this page is, in the viewer's own terms.
 *
 * The list is scoped to whoever is reading it: a tutor gets their assigned students, a parent gets
 * the tutors teaching their children, and someone who is taught gets their own tutors. Built by
 * clause rather than by case because the roles combine -- a tutor who is also a parent sees both
 * kinds of row in the one list.
 */
export function copyFor(roles: readonly UserRole[]): { description: string; empty: string } {
  if (roles.includes('admin')) {
    return {
      description: 'Which tutor teaches which student, and what the tutor is paid for it.',
      empty: 'No students are assigned yet.',
    };
  }

  const descriptions: string[] = [];
  const empties: string[] = [];

  if (roles.includes('tutor')) {
    descriptions.push('the students you teach');
    empties.push('you have no students assigned');
  }

  if (roles.includes('student')) {
    descriptions.push('your own tutors');
    empties.push('no tutor teaches you');
  }

  if (roles.includes('parent')) {
    descriptions.push('who teaches your children');
    empties.push('no tutor teaches your children');
  }

  if (descriptions.length === 0) {
    return {
      description: 'Tutor and student pairings that involve you.',
      empty: 'Nothing is assigned to you yet.',
    };
  }

  return { description: sentence(descriptions), empty: sentence(empties) };
}

/** Joins clauses into one capitalised sentence: "a, b, and c." */
export function sentence(parts: string[]): string {
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : parts[0]!;

  return `${joined[0]!.toUpperCase()}${joined.slice(1)}.`;
}
