// Ported from apps/web/src/features/question-bank/standard-page.tsx @ b0d216e. One standard's
// questions, by status, each with the actions its status allows. Mobile (#54): no "Write 8
// questions" and no "Needs a figure" switch (writing stays at the desk; the figure is a read-only
// chip). The cards are a windowed FlatList, each with its own web view -- not a FlashList, whose
// recycling would hand one question's web view to another and re-measure on every scroll.
import { QUESTION_STATUS_LABELS } from '@tmi/shared';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Chip, Icon, Text } from 'react-native-paper';

import { useBottomOverlap } from '@/components/live-banner-inset';
import { PageIntro } from '@/components/page-intro';
import { EmptyState, ErrorState } from '@/components/state-views';
import { ListSkeleton } from '@/components/skeletons';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, radius, space } from '@/theme/tokens';
import { useQuestionCoverage, useQuestions } from './api';
import { applyFilter, filterCounts, findStandard, FILTERS, type FilterId } from './bank-model';
import { QuestionActions, QuestionCard } from './question-card';

export function StandardScreen({ topicId }: { topicId: string }) {
  const theme = useAppTheme();
  const bottomOverlap = useBottomOverlap();
  const coverage = useQuestionCoverage();
  const topic = findStandard(coverage.data?.data, topicId);
  const questions = useQuestions({ topic_id: topicId }, Boolean(topicId));
  const all = questions.data?.data ?? [];
  const [filter, setFilter] = useState<FilterId>('all');
  const [refreshing, setRefreshing] = useState(false);
  const counts = filterCounts(all);
  const shown = applyFilter(all, filter);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([questions.refetch(), coverage.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  if (coverage.isSuccess && !topic) {
    return (
      <View
        testID="screen-platform-question-standard"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <Stack.Screen options={{ title: 'Standard' }} />
        <EmptyState
          testID="question-bank-not-found"
          icon="file-question-outline"
          title="That standard is not in the question bank."
        />
      </View>
    );
  }

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      {topic ? (
        <View style={{ gap: space.xs }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {topic.code} · {topic.name}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {[topic.level, topic.unit].filter(Boolean).join(' · ')}
          </Text>
          {topic.description ? <PageIntro>{topic.description}</PageIntro> : null}
          {topic.needs_figure ? (
            <View
              testID="question-bank-figure"
              style={{
                flexDirection: 'row',
                alignSelf: 'flex-start',
                alignItems: 'center',
                gap: 4,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: 2,
              }}
            >
              <Icon source="image-off-outline" size={14} color={theme.tokens.mutedForeground} />
              <Text variant="labelMedium" style={{ color: theme.tokens.mutedForeground }}>
                Needs a figure (left out of the test)
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <ListSkeleton label="Loading the standard…" count={1} height={72} />
      )}

      <View
        accessibilityRole="tablist"
        accessibilityLabel="Filter by status"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, rowGap: space.md }}
      >
        {FILTERS.map((id) => {
          const label = id === 'all' ? 'All' : QUESTION_STATUS_LABELS[id];
          const selected = filter === id;
          return (
            <Chip
              key={id}
              testID={`question-bank-filter-${id}`}
              selected={selected}
              showSelectedOverlay
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              hitSlop={CHIP_HIT_SLOP}
              onPress={() => {
                if (selected) return;
                haptics.selection();
                setFilter(id);
              }}
            >
              {`${label} (${counts[id]})`}
            </Chip>
          );
        })}
      </View>
    </View>
  );

  return (
    <View
      testID="screen-platform-question-standard"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <Stack.Screen options={{ title: topic?.code ?? 'Standard' }} />
      <FlatList
        testID="question-bank-list"
        data={questions.isSuccess ? shown : []}
        keyExtractor={(question) => question.id}
        renderItem={({ item }) => (
          <QuestionCard question={item} footer={<QuestionActions question={item} />} />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          questions.isError ? (
            <ErrorState error={questions.error} onRetry={() => void questions.refetch()} />
          ) : questions.isSuccess ? (
            <Text
              testID="question-bank-list-empty"
              variant="bodyMedium"
              style={{ color: theme.tokens.mutedForeground }}
            >
              No questions here yet.
            </Text>
          ) : (
            <ListSkeleton label="Loading the questions…" count={2} height={240} />
          )
        }
        initialNumToRender={2}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={false}
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + bottomOverlap }}
      />
    </View>
  );
}

function Separator() {
  return <View style={{ height: space.lg }} />;
}
