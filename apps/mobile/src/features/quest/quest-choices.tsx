// The choices of apps/web/src/features/quest/quest-play-page.tsx @ 82397b8 (working tree): large
// lettered buttons, one chosen at a time (tapping the chosen one again takes it back). Mobile, as the
// Assessment's question-view.tsx: the bank's KaTeX web view draws them (`MathBody`, persistent, so a
// choice or the next question swaps into the page in place); the page reports each choice's box and
// a native radio button is laid over it -- the taps, the testIDs (`quest-choice-A`) and what
// assistive tech reads are native. If the page cannot draw, they are plain native rows instead.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { MathBody, type ChoiceBox } from '@/features/question-bank/math-body';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { LETTERS, questChoiceSpeech, questChoiceText, questChoicesHtml } from './quest-html';

/** A child's finger on a phone: every choice is at least this tall. */
const CHOICE_TARGET = 56;

export function QuestChoices({
  questionId,
  choices,
  selected,
  onChoose,
}: {
  questionId: string;
  choices: string[];
  selected: number | null;
  onChoose: (index: number) => void;
}) {
  const theme = useAppTheme();
  const html = useMemo(
    () => questChoicesHtml({ choices }, selected, { errorColor: theme.colors.error }),
    [choices, selected, theme.colors.error],
  );
  const [boxes, setBoxes] = useState<{ key: string; boxes: ChoiceBox[] } | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const onChoiceBoxes = useCallback(
    (key: string, next: ChoiceBox[]) =>
      setBoxes((was) =>
        was?.key === key &&
        was.boxes.length === next.length &&
        was.boxes.every((box, i) => box.top === next[i]!.top && box.height === next[i]!.height)
          ? was
          : { key, boxes: next },
      ),
    [],
  );
  const onRendered = useCallback((key: string) => setDrawn(key), []);

  const shownBoxes = boxes?.key === questionId ? boxes.boxes : null;
  // Drawn (or given up on) with no boxes for this question: the page could not lay them out.
  const fallback = drawn === questionId && (shownBoxes?.length ?? 0) !== choices.length;

  function choose(index: number) {
    haptics.selection();
    onChoose(index);
  }

  return (
    <View testID="quest-choices" accessibilityRole="radiogroup">
      <View>
        <MathBody
          html={html}
          speech={choices.map((choice, index) => questChoiceSpeech(choice, index)).join('. ')}
          plain={choices.map((choice, index) => `${LETTERS[index]}. ${questChoiceText(choice)}`).join('\n')}
          contentKey={questionId}
          onRendered={onRendered}
          onChoiceBoxes={onChoiceBoxes}
          persistent
        />
        {!fallback && shownBoxes
          ? choices.map((text, index) => {
              const box = shownBoxes[index];
              if (!box) return null;
              const chosen = selected === index;
              return (
                <Pressable
                  key={index}
                  testID={`quest-choice-${LETTERS[index]}`}
                  accessibilityRole="radio"
                  accessibilityLabel={questChoiceSpeech(text, index)}
                  accessibilityState={{ checked: chosen }}
                  onPress={() => choose(index)}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: box.top,
                    height: Math.max(box.height, MIN_TARGET),
                    borderRadius: radius.md,
                    backgroundColor: pressed ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
                  })}
                />
              );
            })
          : null}
      </View>
      {fallback ? (
        <View style={{ gap: space.sm }}>
          {choices.map((text, index) => {
            const chosen = selected === index;
            return (
              <Pressable
                key={index}
                testID={`quest-choice-${LETTERS[index]}`}
                accessibilityRole="radio"
                accessibilityLabel={questChoiceSpeech(text, index)}
                accessibilityState={{ checked: chosen }}
                onPress={() => choose(index)}
                style={({ pressed }) => ({
                  minHeight: CHOICE_TARGET,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                  borderWidth: chosen ? 2 : 1,
                  borderRadius: radius.md,
                  borderColor: chosen ? theme.colors.primary : theme.colors.outlineVariant,
                  backgroundColor: chosen
                    ? withAlpha(theme.colors.primary, 0.1)
                    : pressed
                      ? theme.tokens.muted
                      : 'transparent',
                })}
              >
                <Text
                  variant="titleMedium"
                  style={{ color: chosen ? theme.colors.primary : theme.tokens.mutedForeground }}
                >
                  {LETTERS[index]}
                </Text>
                <Text variant="titleMedium" style={{ flex: 1, fontWeight: chosen ? '700' : '400' }}>
                  {questChoiceText(text)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
