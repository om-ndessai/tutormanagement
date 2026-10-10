// Ported from apps/web/src/features/onboarding/confirm-details.tsx @ 1132322.
//
// The last step for everyone but an admin (Phase 26): the record the office keeps on them, to
// confirm. Only an admin may edit a record, so "something needs changing" sends the office a note
// -- a comment on their own record, which the office, they and their parents read -- rather than a
// form.
import { commentInputSchema } from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useAddComment } from '@/features/comments/api';
import { NoteField } from '@/features/teaching/session-notes';
import { useUserDetail } from '@/features/users/api';
import { UserDetailView } from '@/features/users/user-detail-view';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useConfirmDetails } from './api';
import { WizardHeading } from './wizard-screens';

export function ConfirmDetailsScreen() {
  const theme = useAppTheme();
  const toast = useToast();
  const { user } = useAuth();
  const detail = useUserDetail(user?.id ?? null);
  const confirm = useConfirmDetails();
  const addComment = useAddComment();

  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const onDone = () => router.replace('/onboarding/done');

  async function handleConfirm() {
    try {
      await confirm.mutateAsync();
      toast.success('Thanks — your details are confirmed.');
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not confirm your details.');
    }
  }

  async function handleSend() {
    setError(null);
    // The shared rules first, so an SSN typed here never leaves the phone.
    const parsed = commentInputSchema.safeParse({
      target_type: 'user',
      target_id: user!.id,
      body: note.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the note.');
      haptics.error();
      return;
    }
    try {
      await addComment.mutateAsync(parsed.data);
      toast.success('Sent to the office — they will update your details.');
      onDone();
    } catch (caught) {
      if (caught instanceof ApiRequestError) setError(caught.fieldErrors.body ?? caught.message);
      else setError('Could not send the note.');
    }
  }

  return (
    <Screen testID="screen-onboarding-confirm" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Your details' }} />
      <WizardHeading
        title="Confirm your details"
        description="One last thing: check the office has you right."
      />
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        This is how the office has you on file. Only the office can change it — if something is wrong, tell
        them here.
      </Text>

      <Surface
        testID="confirm-details-record"
        elevation={0}
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          padding: space.lg,
        }}
      >
        {detail.isPending ? (
          <LoadingState label="Loading your record…" />
        ) : detail.data ? (
          <UserDetailView user={detail.data.data} compact />
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </Surface>

      {correcting ? (
        <View style={{ gap: space.sm }}>
          <NoteField
            testID="confirm-details-note"
            label="What needs changing?"
            value={note}
            onChange={setNote}
            placeholder="For example: my phone number is now (919) 555-0100."
            error={error ?? undefined}
          />
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            Goes to the office as a note on your record. Your parents can read it too, if you have them on
            file. Never send a Social Security number here.
          </Text>
          <Button
            testID="confirm-details-send"
            mode="contained"
            onPress={() => void handleSend()}
            disabled={!note.trim() || addComment.isPending}
            loading={addComment.isPending}
          >
            Send to the office
          </Button>
          <Button testID="confirm-details-back" mode="text" onPress={() => setCorrecting(false)}>
            Back
          </Button>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button
            testID="confirm-details-yes"
            mode="contained"
            icon="check"
            onPress={() => void handleConfirm()}
            disabled={confirm.isPending}
            loading={confirm.isPending}
          >
            Yes, that’s all right
          </Button>
          <Button
            testID="confirm-details-change"
            mode="outlined"
            icon="message-text-outline"
            onPress={() => setCorrecting(true)}
          >
            Something needs changing
          </Button>
        </View>
      )}
    </Screen>
  );
}
