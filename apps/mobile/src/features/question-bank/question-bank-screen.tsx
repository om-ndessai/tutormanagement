// Ported from apps/web/src/features/question-bank/question-bank-page.tsx @ b0d216e. The coverage of
// the bank: its figures, "Review N checked", and each level's standards with their approved
// questions by difficulty against the target and what is waiting. Mobile (#54): no "Write for N
// standards" (writing stays at the desk); each level is closed until opened (U5's pattern), and the
// "Needs a figure" switch is a read-only chip here.
import {
  QUESTIONS_PER_DIFFICULTY_TARGET,
  QUESTION_DIFFICULTY_LABELS,
  type QuestionCoverageLevel,
  type QuestionCoverageTopic,
} from '@tmi/shared';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Divider, Icon, Text } from 'react-native-paper';

import { FigureRow } from '@/components/figure-row';
import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { ListSkeleton } from '@/components/skeletons';
import { useLines } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { bankKeys, useQuestionCoverage } from './api';
import { approvedTone, bankTotals, levelSummary, standardStatusLine } from './bank-model';

const TARGET = QUESTIONS_PER_DIFFICULTY_TARGET * 3;

function ApprovedPills({ topic }: { topic: QuestionCoverageTopic }) {
  const theme = useAppTheme();
  const tones = {
    target: { color: theme.tokens.success, background: withAlpha(theme.tokens.success, 0.15) },
    some: { color: theme.colors.onSurface, background: withAlpha(theme.tokens.warning, 0.25) },
    none: { color: theme.tokens.mutedForeground, background: theme.tokens.muted },
  };
  const label = topic.approved
    .map((n, i) => `${QUESTION_DIFFICULTY_LABELS[(i + 1) as 1 | 2 | 3]} ${n}`)
    .join(', ');
  return (
    <View
      testID={`question-bank-standard-${topic.topic_id}-approved`}
      accessible
      accessibilityLabel={`Approved: ${label}`}
      style={{ flexDirection: 'row', gap: space.xs }}
    >
      {topic.approved.map((count, index) => {
        const tone = tones[approvedTone(count)];
        return (
          <View
            key={index}
            style={{
              minWidth: 24,
              paddingHorizontal: space.xs,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: tone.background,
            }}
          >
            <Text variant="labelMedium" style={{ color: tone.color, fontVariant: ['tabular-nums'] }}>
              {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function StandardRow({ topic }: { topic: QuestionCoverageTopic }) {
  const theme = useAppTheme();
  const lines = useLines(2);
  const status = standardStatusLine(topic);
  return (
    <Pressable
      testID={`question-bank-standard-${topic.topic_id}`}
      accessibilityRole="button"
      accessibilityLabel={`${topic.code} ${topic.name}${topic.needs_figure ? ', needs a figure' : ''}. ${status}`}
      onPress={() => {
        haptics.selection();
        router.push(`/platform/questions/${encodeURIComponent(topic.topic_id)}`);
      }}
      style={({ pressed }) => ({
        minHeight: MIN_TARGET,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        gap: space.xs,
        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
      })}
    >
      <Text variant="bodyMedium" numberOfLines={lines}>
        <Text style={{ fontWeight: '700' }}>{topic.code}</Text> {topic.name}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        <ApprovedPills topic={topic} />
        {topic.needs_figure ? (
          <View
            testID={`question-bank-standard-${topic.topic_id}-figure`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
              borderRadius: radius.sm,
              paddingHorizontal: space.xs,
            }}
          >
            <Icon source="image-off-outline" size={14} color={theme.tokens.mutedForeground} />
            <Text variant="labelMedium" style={{ color: theme.tokens.mutedForeground }}>
              Needs a figure
            </Text>
          </View>
        ) : null}
        {status ? (
          <Text
            testID={`question-bank-standard-${topic.topic_id}-status`}
            variant="bodySmall"
            style={{ color: theme.tokens.mutedForeground, flexShrink: 1 }}
          >
            {status}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function LevelSection({
  level,
  open,
  onToggle,
}: {
  level: QuestionCoverageLevel;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const summary = levelSummary(level);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface,
      }}
    >
      <Pressable
        testID={`question-bank-level-${level.level_id}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${level.name}, ${summary}`}
        onPress={onToggle}
        style={({ pressed }) => ({
          minHeight: MIN_TARGET + 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          backgroundColor: pressed ? theme.tokens.muted : 'transparent',
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleSmall" accessibilityRole="header">
            {level.name}
          </Text>
          <Text
            testID={`question-bank-level-${level.level_id}-summary`}
            variant="bodySmall"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {summary}
          </Text>
        </View>
        <Icon source={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.tokens.mutedForeground} />
      </Pressable>
      {open
        ? level.topics.map((topic) => (
            <View key={topic.topic_id}>
              <Divider />
              <StandardRow topic={topic} />
            </View>
          ))
        : null}
    </View>
  );
}

/**
 * The question bank (Phase 36): every standard of NC 2026 grades 3-8 and Math 1, with its approved
 * questions by difficulty against the target, and what is waiting for review. Questions reach a
 * test only once a person approves them.
 */
export function QuestionBankScreen() {
  const queryClient = useQueryClient();
  // Read the coverage (every question in the bank) only once the tab is opened: Android mounts every
  // console tab at once, and the console is opened far more often than its Questions tab.
  const [opened, setOpened] = useState(false);
  const coverage = useQuestionCoverage(opened);
  const levels = coverage.data?.data ?? [];
  const totals = bankTotals(levels);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // On a return (from a standard, Review or another tab), read the coverage again only if an action
  // since marked it stale -- once per return, never on every action (#54).
  useFocusEffect(
    useCallback(() => {
      setOpened(true);
      const query = queryClient.getQueryCache().find({ queryKey: bankKeys.coverage, exact: true });
      if (query?.state.data && query.isStale() && query.state.fetchStatus === 'idle') {
        void queryClient.refetchQueries({ queryKey: bankKeys.coverage, exact: true });
      }
    }, [queryClient]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await coverage.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function toggle(levelId: string) {
    haptics.selection();
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  return (
    <Screen testID="screen-platform-questions" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <PageIntro>
        {`Claude writes each question; code checks it and a second model solves it blind; a person approves it. The target is ${TARGET} approved per standard, ${QUESTIONS_PER_DIFFICULTY_TARGET} at each difficulty.`}
      </PageIntro>

      {coverage.isError ? (
        <ErrorState error={coverage.error} onRetry={() => void coverage.refetch()} />
      ) : !coverage.data ? (
        <ListSkeleton label="Loading the question bank…" count={5} height={64} />
      ) : (
        <>
          <Button
            testID="question-bank-review"
            mode="contained"
            icon="clipboard-check-outline"
            disabled={totals.toReview === 0}
            onPress={() => {
              haptics.selection();
              router.push('/question-review');
            }}
            contentStyle={{ minHeight: 48 }}
          >
            {totals.toReview === 0 ? 'Nothing to review' : `Review ${totals.toReview} checked`}
          </Button>
          {/* Phase 51: approvals suggested by spaces whose Quest reviews are not trusted. */}
          <Button
            testID="bank-suggested"
            mode="outlined"
            icon="account-group-outline"
            onPress={() => {
              haptics.selection();
              router.push('/question-review?suggested=1');
            }}
            contentStyle={{ minHeight: 48 }}
          >
            Suggested by spaces
          </Button>

          <FigureRow
            testID="question-bank-totals"
            figures={[
              { label: 'Approved', value: totals.approved, tone: 'success' },
              {
                label: 'At target',
                value: totals.atTarget,
                formatValue: (n) => `${n} / ${totals.askable}`,
                animate: false,
              },
              { label: 'To review', value: totals.toReview },
              { label: 'Flagged', value: totals.flagged, tone: totals.flagged > 0 ? 'warning' : 'default' },
            ]}
          />

          <View style={{ gap: space.sm }}>
            {levels.map((level) => (
              <LevelSection
                key={level.level_id}
                level={level}
                open={open.has(level.level_id)}
                onToggle={() => toggle(level.level_id)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
