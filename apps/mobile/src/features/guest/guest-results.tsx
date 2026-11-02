// The answers list of apps/web/src/features/guest/{guest-quest,guest-assessment}.tsx @ 0e3ec7a (working
// tree), Results: each question with a tick or a cross, the right answer, the guest's own when it was
// wrong, and how to solve it. Mobile, as a game's results (game-results.tsx, design 60): one question at
// a time in one persistent KaTeX web view, never a web view per question, with a chip per question
// (its colour the outcome) and Previous / Next. `below` adds a page's own part (the Assessment's working).
import type { GameResultItem } from '@tmi/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import { MathBody } from '@/features/question-bank/math-body';
import { gameResultHtml, gameResultSpeech, gameResultText } from '@/features/quest/game-html';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { CHIP_HIT_SLOP, space } from '@/theme/tokens';

export type GuestResultItem = Pick<GameResultItem, 'number' | 'question' | 'answer' | 'correct' | 'skipped'>;

export function outcomeWord(item: Pick<GuestResultItem, 'correct' | 'skipped'>): string {
  return item.skipped ? 'Skipped' : item.correct ? 'Right' : 'Wrong';
}

export function GuestResultPager({
  items,
  label = 'Question',
  below,
}: {
  items: GuestResultItem[];
  /** "Question" or the Assessment's "Page". */
  label?: string;
  below?: (item: GuestResultItem) => ReactNode;
}) {
  const theme = useAppTheme();
  const [index, setIndex] = useState(0);
  const item = items[Math.min(index, items.length - 1)];
  const html = useMemo(
    () => (item ? gameResultHtml(item, { errorColor: theme.colors.error }) : ''),
    [item, theme.colors.error],
  );
  if (!item) return null;

  function tone(it: GuestResultItem) {
    if (it.skipped) return { border: theme.colors.outline, fill: 'transparent', ink: theme.tokens.mutedForeground };
    if (it.correct)
      return { border: theme.colors.primary, fill: withAlpha(theme.colors.primary, 0.15), ink: theme.colors.primary };
    return { border: theme.colors.error, fill: withAlpha(theme.colors.error, 0.12), ink: theme.colors.error };
  }
  const go = (next: number) => {
    haptics.selection();
    setIndex(next);
  };
  const current = tone(item);

  return (
    <View testID="guest-review" style={{ gap: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        {items.map((it, i) => {
          const t = tone(it);
          const selected = i === index;
          return (
            <Chip
              key={it.number}
              testID={`guest-review-chip-${it.number}`}
              compact
              icon={it.skipped ? undefined : it.correct ? 'check' : 'close'}
              selected={selected}
              showSelectedCheck={false}
              onPress={() => go(i)}
              hitSlop={CHIP_HIT_SLOP}
              accessibilityLabel={`${label} ${it.number}, ${outcomeWord(it)}`}
              accessibilityState={{ selected }}
              style={{ borderWidth: selected ? 2 : 1, borderColor: t.border, backgroundColor: t.fill }}
              textStyle={{ color: t.ink, fontWeight: selected ? '700' : '400' }}
            >
              {String(it.number)}
            </Chip>
          );
        })}
      </ScrollView>
      <View
        testID={`guest-review-${item.number}`}
        accessible
        accessibilityRole="header"
        style={{ borderLeftWidth: 4, borderLeftColor: current.border, paddingLeft: space.md }}
      >
        <Text variant="titleSmall" style={{ color: current.ink, fontWeight: '700' }}>
          {`${label} ${item.number} · ${outcomeWord(item)}`}
        </Text>
      </View>
      <MathBody
        testID="guest-review-body"
        html={html}
        speech={gameResultSpeech(item)}
        plain={gameResultText(item)}
        contentKey={`${item.question.id}:${item.number}`}
        persistent
      />
      {below?.(item)}
      {items.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
          <Button
            testID="guest-review-prev"
            mode="outlined"
            icon="chevron-left"
            disabled={index === 0}
            onPress={() => go(index - 1)}
            contentStyle={{ minHeight: 48 }}
          >
            Previous
          </Button>
          <Text variant="bodySmall" style={{ alignSelf: 'center', color: theme.tokens.mutedForeground }}>
            {`${index + 1} of ${items.length}`}
          </Text>
          <Button
            testID="guest-review-next"
            mode="outlined"
            icon="chevron-right"
            contentStyle={{ minHeight: 48, flexDirection: 'row-reverse' }}
            disabled={index >= items.length - 1}
            onPress={() => go(index + 1)}
          >
            Next
          </Button>
        </View>
      ) : null}
    </View>
  );
}
