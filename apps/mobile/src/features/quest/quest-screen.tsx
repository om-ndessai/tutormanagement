// Ported from apps/web/src/features/quest/quest-page.tsx @ 82397b8 (working tree): QuestPage. The
// landing is quest-landing.tsx.
//
// Phase 42: Question Quest's page in the portal. A student starts their Quest here; a tutor or admin
// sees what waits for review, starts reviewing, and sets each student's starting level. The Quest
// itself runs full screen (quest-play-screen, quest-review-screen). docs/gamification-plan.md.
// Mobile: a stack screen in the organization (from More and Search); the students' table is a card
// per student, the level a picker (every level in a short scrolling list) over its counts.
import type { QuestStudent } from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { OptionPicker } from '@/components/option-picker';
import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { ListSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useQuestReview, useQuestState, useQuestStudents, useSetQuestLevel } from './api';
import {
  NOT_SET,
  levelInput,
  levelOptions,
  levelToast,
  playSummary,
  questRoles,
  startLabel,
} from './quest-model';
import { QuestPoints } from './quest-points';

const LEVEL_OPTIONS = levelOptions();

export function QuestScreen() {
  const { user } = useAuth();
  const roles = questRoles(user?.roles);
  const state = useQuestState(roles.plays);
  const queue = useQuestReview(roles.reviews);
  const students = useQuestStudents(roles.reviews);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        roles.plays ? state.refetch() : null,
        roles.reviews ? queue.refetch() : null,
        roles.reviews ? students.refetch() : null,
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-quest" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Question Quest' }} />
      <PageIntro>
        Answer the question bank’s new questions, one at a time, and earn points. Tutors check each answer and
        approve the question for everyone.
      </PageIntro>
      {roles.plays ? <PlayCard /> : null}
      {roles.reviews ? <ReviewCard /> : null}
      {roles.reviews ? <StudentsCard /> : null}
    </Screen>
  );
}

function PlayCard() {
  const theme = useAppTheme();
  const state = useQuestState();
  const data = state.data?.data;
  return (
    <Panel title="Your Quest" testID="quest-play-card">
      <View style={{ gap: space.md }}>
        {state.isPending ? (
          <Skeleton width="70%" height={16} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
            <Text
              testID="quest-play-summary"
              variant="bodyMedium"
              style={{ color: theme.tokens.mutedForeground }}
            >
              {playSummary(data)}
            </Text>
            <QuestPoints points={data?.points ?? 0} testID="quest-play-points" />
          </View>
        )}
        <Button
          testID="quest-start"
          mode="contained"
          icon="play"
          disabled={!data?.level_id}
          onPress={() => router.push('/quest/play')}
          contentStyle={{ minHeight: 48 }}
          style={{ alignSelf: 'flex-start' }}
        >
          {startLabel(data?.answered)}
        </Button>
      </View>
    </Panel>
  );
}

function ReviewCard() {
  const theme = useAppTheme();
  const queue = useQuestReview();
  const data = queue.data?.data;
  return (
    <Panel title="Answers to review" testID="quest-review-card">
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          <Text
            testID="quest-review-waiting"
            variant="bodyMedium"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {queue.isPending ? '…' : `${data?.waiting ?? 0} waiting`}
          </Text>
          <QuestPoints points={data?.points ?? 0} testID="quest-review-points" />
        </View>
        <Button
          testID="quest-review-start"
          mode={data?.waiting ? 'contained' : 'outlined'}
          icon="clipboard-check-outline"
          onPress={() => router.push('/quest/review')}
          contentStyle={{ minHeight: 48 }}
          style={{ alignSelf: 'flex-start' }}
        >
          Review
        </Button>
      </View>
    </Panel>
  );
}

function StudentsCard() {
  const theme = useAppTheme();
  const students = useQuestStudents();
  const rows = students.data?.data ?? [];
  return (
    <Panel title="Students" testID="quest-students">
      <View style={{ gap: space.md }}>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Set where each student starts. When they have answered every new question of a level, they move up
          by themselves. Only students who sign in can play.
        </Text>
        {students.isPending ? (
          <ListSkeleton label="Loading the students…" count={3} height={88} />
        ) : rows.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            No students to show.
          </Text>
        ) : (
          rows.map((row, index) => (
            <View key={row.user_id} style={{ gap: space.md }}>
              {index > 0 ? <Divider /> : null}
              <StudentRow row={row} />
            </View>
          ))
        )}
      </View>
    </Panel>
  );
}

function StudentRow({ row }: { row: QuestStudent }) {
  const theme = useAppTheme();
  const toast = useToast();
  const setLevel = useSetQuestLevel();
  // The choice shows at once and holds until the students' list is read again with it (or goes back,
  // if it was refused), so the picker never flicks back to the old level in between.
  const current = row.level_id ?? NOT_SET;
  const [wanted, setWanted] = useState<{ value: string; from: string } | null>(null);
  const shown = wanted && wanted.from === current ? wanted.value : current;

  async function change(value: string) {
    setWanted({ value, from: current });
    try {
      await setLevel.mutateAsync({ studentId: row.user_id, level_id: levelInput(value) });
      toast.success(levelToast(row.full_name, value));
    } catch (caught) {
      setWanted(null);
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not set the level.');
    }
  }

  const muted = theme.tokens.mutedForeground;
  return (
    <View testID={`quest-student-${row.user_id}`} style={{ gap: space.sm }}>
      <Text variant="titleSmall">{row.full_name}</Text>
      <OptionPicker
        testID={`quest-level-${row.user_id}`}
        label={`${row.full_name}’s level`}
        placeholder="Not set"
        options={LEVEL_OPTIONS}
        value={shown}
        onChange={(value) => void change(value)}
        searchPlaceholder="Search levels"
        defaultOpen={false}
        scroll
      />
      <Text testID={`quest-student-counts-${row.user_id}`} variant="bodySmall" style={{ color: muted }}>
        {`${row.answered} answered · ${row.confirmed} confirmed · ${row.waiting} waiting · ${row.points} points`}
      </Text>
    </View>
  );
}
