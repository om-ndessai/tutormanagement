// Ported from the question card of apps/web/src/features/canvas-assessments/take-assessment-page.tsx
// @ 22b9701 (the stem, and the choices lettered A-F with the selected one marked). Mobile: built as
// HTML on Hermes for the bank's KaTeX web view (question-bank/question-html.ts) -- never the key or
// the solution, which the taker is never sent. The page draws; native buttons laid over each choice
// take the taps (question-view.tsx). Pure: no React.
import type { CanvasAssessmentQuestion } from '@tmi/shared';

import { escapeHtml, mathHtml } from '@/features/question-bank/question-html';
import { mathToText } from '@/features/question-bank/math-text';
import { LETTERS } from './assessment-model';

/** The stem, and for a multiple-choice question its lettered choices, `selected` marked. */
export function assessmentBodyHtml(
  question: Pick<CanvasAssessmentQuestion, 'kind' | 'stem' | 'choices'>,
  selected: number | null,
  { errorColor }: { errorColor: string },
): string {
  const html = (text: string) => mathHtml(text, errorColor);
  const parts = [`<div class="stem t">${html(question.stem)}</div>`];
  if (question.kind === 'choice' && question.choices.length > 0) {
    const items = question.choices.map(
      (choice, index) =>
        `<li class="choice${index === selected ? ' sel' : ''}">` +
        `<span class="letter">${escapeHtml(LETTERS[index] ?? String(index + 1))}</span>` +
        `<span class="text t">${html(choice)}</span>` +
        '</li>',
    );
    parts.push(`<ol class="choices">${items.join('')}</ol>`);
  }
  return parts.join('');
}

/** The stem read aloud: the web view is hidden from assistive tech, so this is its label. */
export function stemSpeech(stem: string): string {
  return mathToText(stem, 'speech');
}

/** A choice read aloud, for the button over it: "Choice B: 70". */
export function choiceSpeech(choice: string, index: number): string {
  return `Choice ${LETTERS[index] ?? index + 1}: ${mathToText(choice, 'speech').replace(/[.]$/, '')}`;
}

/** A choice as one line of native text, when the page cannot draw. */
export function choiceText(choice: string): string {
  return mathToText(choice, 'display');
}

/** The stem as native text, when the page cannot draw. */
export function stemText(stem: string): string {
  return mathToText(stem, 'display');
}
