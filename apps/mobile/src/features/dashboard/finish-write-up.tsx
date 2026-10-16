// "Finish write-up" on a tutor's Home (UI upgrades U6): the draft they left today, one tap from the
// record step flow (U4) opened on it. Drafts are the author's alone (R10): only on their own Home,
// never while an admin views it. No money: it sits on the Tutoring tab.
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useMyDrafts } from '@/features/teaching/api';
import { formatSessionTimes } from '@/features/teaching/session-format';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useOrgClock } from './home-data';
import { draftToFinish } from './home-model';

export function FinishWriteUp({ tutorUserId }: { tutorUserId: string }) {
  const theme = useAppTheme();
  const clock = useOrgClock();
  const drafts = useMyDrafts();
  const found = draftToFinish(drafts.data?.data ?? [], clock.day, tutorUserId);
  if (!found) return null;
  const { draft, others } = found;
  return (
    <OutlinedCard
      testID="home-finish-write-up"
      style={{ borderRadius: radius.lg, borderColor: theme.tokens.highlight }}
      contentStyle={{ padding: space.lg, gap: space.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.tokens.highlightSoft,
          }}
        >
          <Icon source="file-document-edit-outline" size={22} color={theme.tokens.highlightSoftForeground} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '700' }}>
            Finish write-up
          </Text>
          <Text
            testID="home-finish-write-up-lesson"
            variant="bodyMedium"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {draft.student_name} · Today, {formatSessionTimes(draft.started_at, draft.ended_at)}
          </Text>
        </View>
      </View>
      {others > 0 ? (
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {others === 1
            ? 'Another draft from today is on Sessions.'
            : `${others} more drafts from today are on Sessions.`}
        </Text>
      ) : null}
      <Button
        testID="home-finish-write-up-open"
        mode="contained"
        icon="pencil-outline"
        contentStyle={{ minHeight: MIN_TARGET }}
        accessibilityLabel={`Finish the write-up of the lesson with ${draft.student_name}`}
        onPress={() => {
          haptics.selection();
          router.push({ pathname: '/record-lesson', params: { draft: draft.id } });
        }}
      >
        Finish write-up
      </Button>
    </OutlinedCard>
  );
}
