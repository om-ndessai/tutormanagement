// Ported from apps/web/src/features/teaching/drafts-panel.tsx @ 1132322.
import { SESSION_MODE_LABELS, type SessionDraft } from '@tmi/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Divider, IconButton, Text } from 'react-native-paper';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useDiscardDraft, useMyDrafts, usePostDraft } from './api';
import { Tag } from './session-card';
import { formatSessionDay, formatSessionTimes } from './session-format';

/**
 * Write-ups the viewer has saved but not posted.
 *
 * Above the session list rather than mixed into it, because a draft is not a lesson on the
 * record: it is billed for nothing, counted nowhere, and read by nobody else (R10). Mixing them
 * would put a row in the list that none of the totals agree with. A draft carries no money at all.
 */
export function DraftsPanel({ today, onEdit }: { today: string; onEdit: (draft: SessionDraft) => void }) {
  const { data } = useMyDrafts();
  const drafts = data?.data ?? [];
  if (drafts.length === 0) return null;
  return <DraftsList drafts={drafts} today={today} onEdit={onEdit} />;
}

/** The panel itself, given the drafts (exported for the tests). */
export function DraftsList({
  drafts,
  today,
  onEdit,
}: {
  drafts: SessionDraft[];
  today: string;
  onEdit: (draft: SessionDraft) => void;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const post = usePostDraft();
  const discard = useDiscardDraft();
  const [posting, setPosting] = useState<string | null>(null);
  const muted = theme.tokens.mutedForeground;

  async function publish(draft: SessionDraft) {
    setPosting(draft.id);
    try {
      await post.mutateAsync(draft.id);
      toast.success(`Session with ${draft.student_name} recorded.`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not post that draft.');
    } finally {
      setPosting(null);
    }
  }

  function confirmDiscard(draft: SessionDraft) {
    haptics.warning();
    Alert.alert(
      'Discard this draft?',
      `The write-up for ${draft.student_name} on ${draft.occurred_on} is deleted. Nothing was billed or recorded, so nothing else changes.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            discard.mutate(draft.id, {
              onSuccess: () => toast.success('Draft discarded.'),
              onError: (error) =>
                toast.error(
                  error instanceof ApiRequestError ? error.message : 'Could not discard that draft.',
                ),
            }),
        },
      ],
    );
  }

  return (
    <Card
      testID="drafts-panel"
      mode="outlined"
      style={{ borderRadius: radius.lg, borderStyle: 'dashed' }}
      contentStyle={{ padding: 0 }}
    >
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text variant="titleSmall" accessibilityRole="header">
          Your drafts{'  '}
          <Text variant="bodySmall" style={{ color: muted }}>
            {drafts.length === 1 ? 'Only you can see it' : 'Only you can see these'}
          </Text>
        </Text>
        {drafts.map((draft, index) => (
          <View key={draft.id} testID={`draft-${draft.id}`}>
            {index > 0 ? <Divider /> : null}
            <View style={{ paddingVertical: space.sm, gap: space.sm }}>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text variant="bodyLarge" style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                    {draft.student_name}
                  </Text>
                  <Tag label="Draft" />
                </View>
                <Text variant="bodySmall" style={{ color: muted }}>
                  {formatSessionDay(draft.occurred_on, today)} ·{' '}
                  {formatSessionTimes(draft.started_at, draft.ended_at)} · {SESSION_MODE_LABELS[draft.mode]}
                  {draft.notes || draft.write_up ? '' : ' · no notes yet'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Button
                  testID={`draft-continue-${draft.id}`}
                  mode="outlined"
                  icon="file-edit-outline"
                  compact
                  onPress={() => onEdit(draft)}
                >
                  Continue
                </Button>
                <Button
                  testID={`draft-post-${draft.id}`}
                  mode="contained"
                  icon="send"
                  compact
                  loading={posting === draft.id}
                  disabled={posting !== null}
                  onPress={() => void publish(draft)}
                >
                  Post
                </Button>
                <View style={{ flex: 1 }} />
                <IconButton
                  testID={`draft-discard-${draft.id}`}
                  icon="trash-can-outline"
                  accessibilityLabel={`Discard the draft with ${draft.student_name}`}
                  onPress={() => confirmDiscard(draft)}
                  style={{ margin: 0 }}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
