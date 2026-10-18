// Ported from the question card of apps/web/src/features/canvas-assessments/take-assessment-page.tsx
// @ 22b9701: the stem typeset, and for a multiple-choice question the lettered choices the student
// taps to choose (tapping the chosen one again takes it back). Mobile: one KaTeX web view draws the
// stem and the choices, as the question bank does (MathBody); the page reports each choice's box,
// and a native radio button is laid over each one -- the taps, the testIDs (`assessment-choice-A`)
// and what assistive tech reads are native. If the page cannot draw, the choices are plain native
// rows instead. Nothing here is checked or marked: the selection is the only colour.
import type { CanvasAssessmentQuestion } from '@tmi/shared';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { MathBody, type ChoiceBox } from '@/features/question-bank/math-body';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { LETTERS } from './assessment-model';
import { assessmentBodyHtml, choiceSpeech, choiceText, stemSpeech, stemText } from './question-body';

export function QuestionView({
  question,
  selected,
  onChoose,
}: {
  question: CanvasAssessmentQuestion;
  selected: number | null;
  /** A choice tapped, by position: the screen toggles it. */
  onChoose: (index: number) => void;
}) {
  const theme = useAppTheme();
  const choice = question.kind === 'choice' && question.choices.length > 0;
  const html = useMemo(
    () => assessmentBodyHtml(question, selected, { errorColor: theme.colors.error }),
    [question, selected, theme.colors.error],
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

  const shownBoxes = boxes?.key === question.id ? boxes.boxes : null;
  // Drawn (or given up on) with no boxes for this question: the page could not lay them out.
  const fallback = choice && drawn === question.id && (shownBoxes?.length ?? 0) !== question.choices.length;

  function choose(index: number) {
    haptics.selection();
    onChoose(index);
  }

  return (
    <View testID="assessment-question" style={{ gap: space.sm }}>
      <View>
        <MathBody
          html={html}
          speech={stemSpeech(question.stem)}
          plain={stemText(question.stem)}
          contentKey={question.id}
          onRendered={onRendered}
          onChoiceBoxes={onChoiceBoxes}
          // A choice or the next page swaps into the page in place: no new web view, no flicker.
          persistent
        />
        {!fallback && shownBoxes
          ? question.choices.map((text, index) => {
              const box = shownBoxes[index];
              if (!box) return null;
              const chosen = selected === index;
              return (
                <Pressable
                  key={index}
                  testID={`assessment-choice-${LETTERS[index]}`}
                  accessibilityRole="radio"
                  accessibilityLabel={choiceSpeech(text, index)}
                  accessibilityState={{ checked: chosen }}
                  onPress={() => choose(index)}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: box.top,
                    // A short choice still gets a full target; the page's row is at least as tall.
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
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {question.choices.map((text, index) => {
            const chosen = selected === index;
            return (
              <Pressable
                key={index}
                testID={`assessment-choice-${LETTERS[index]}`}
                accessibilityRole="radio"
                accessibilityLabel={choiceSpeech(text, index)}
                accessibilityState={{ checked: chosen }}
                onPress={() => choose(index)}
                style={({ pressed }) => ({
                  minHeight: MIN_TARGET,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderWidth: 1,
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
                  variant="labelLarge"
                  style={{ color: chosen ? theme.colors.primary : theme.tokens.mutedForeground }}
                >
                  {LETTERS[index]}
                </Text>
                <Text variant="bodyLarge" style={{ flex: 1, fontWeight: chosen ? '600' : '400' }}>
                  {choiceText(text)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
