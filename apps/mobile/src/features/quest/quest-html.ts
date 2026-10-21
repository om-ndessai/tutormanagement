// Ported from the question card and the review card of apps/web/src/features/quest/
// {quest-play-page.tsx, quest-review-page.tsx} @ 82397b8 (working tree): the stem; the lettered
// choices, large, with the student's choice marked; and for the reviewer the options with the key
// and the student's answer marked, then the worked solution. Mobile: HTML built on Hermes for the
// bank's KaTeX web view (question-bank/question-html.ts, `MathBody`), so the page runs no script.
// The student's page is never given the key or the solution: the server never sends them. Pure.
import type { QuestQuestion, QuestReviewItem } from '@tmi/shared';

import { escapeHtml, mathHtml } from '@/features/question-bank/question-html';
import { mathToText } from '@/features/question-bank/math-text';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const speak = (text: string) => mathToText(text, 'speech').replace(/[.]$/, '');
const show = (text: string) => mathToText(text, 'display');

/** A choice read aloud, for the radio button over it: "Choice B: 70". */
export function questChoiceSpeech(choice: string, index: number): string {
  return `Choice ${LETTERS[index] ?? index + 1}: ${speak(choice)}`;
}

/** A choice as one line of native text, when the page cannot draw. */
export function questChoiceText(choice: string): string {
  return show(choice);
}

/** The stem read aloud (the web view is hidden from assistive tech), and as plain text. */
export function questStemSpeech(stem: string): string {
  return mathToText(stem, 'speech');
}

export function questStemText(stem: string): string {
  return show(stem);
}

/** The reviewer's body read aloud, in order, with the key and the student's answer said. */
export function questReviewSpeech(item: Pick<QuestReviewItem, 'answer' | 'question'>, who: string): string {
  const q = item.question;
  const parts = ['Question.', `${speak(q.stem)}.`];
  if (q.kind === 'choice') {
    q.choices.forEach((choice, index) => {
      const marks = [
        choice === q.answer ? 'the key' : null,
        choice === item.answer ? `${who}’s answer` : null,
      ]
        .filter(Boolean)
        .join(', ');
      parts.push(`${questChoiceSpeech(choice, index)}${marks ? `, ${marks}` : ''}.`);
    });
  }
  parts.push('Worked solution.', `${speak(q.solution)}.`);
  return parts.join(' ');
}

/** The reviewer's body as plain lines, when the page cannot draw. */
export function questReviewText(item: Pick<QuestReviewItem, 'answer' | 'question'>, who: string): string {
  const q = item.question;
  const lines = [show(q.stem)];
  if (q.kind === 'choice') {
    q.choices.forEach((choice, index) => {
      const marks = [choice === q.answer ? 'key' : null, choice === item.answer ? `${who}’s answer` : null]
        .filter(Boolean)
        .join(', ');
      lines.push(`${LETTERS[index] ?? index + 1}. ${show(choice)}${marks ? `  (${marks})` : ''}`);
    });
  }
  lines.push(`Worked solution: ${show(q.solution)}`);
  return lines.join('\n');
}

interface Colors {
  errorColor: string;
}

/** The stem alone: on a wide screen it sits beside the answer, so it is its own page. */
export function questStemHtml(stem: string, { errorColor }: Colors): string {
  return `<div class="stem t" style="margin:0">${mathHtml(stem, errorColor)}</div>`;
}

/**
 * The choices, lettered, `selected` marked: larger rows than the bank's (a child's finger, and
 * the whole page is the answer), sized in `em` so they follow the reader's text size with the rest.
 * Native radio buttons are laid over each `.choice` box (quest-choices.tsx).
 */
export function questChoicesHtml(
  question: Pick<QuestQuestion, 'choices'>,
  selected: number | null,
  { errorColor }: Colors,
): string {
  const items = question.choices.map(
    (choice, index) =>
      `<li class="choice${index === selected ? ' sel' : ''}" style="min-height:2.6em;padding:.75em .9em;font-size:1.15em">` +
      `<span class="letter">${escapeHtml(LETTERS[index] ?? String(index + 1))}</span>` +
      `<span class="text t">${mathHtml(choice, errorColor)}</span>` +
      '</li>',
  );
  return `<ol class="choices" style="margin:0;gap:10px">${items.join('')}</ol>`;
}

/** A small label at the end of an option's row: "Key", "Sofia’s answer". */
function tag(text: string, strong: boolean): string {
  const color = strong ? 'var(--key)' : 'var(--muted)';
  return (
    `<span style="flex:none;font-size:.8em;font-weight:700;color:${color};border:1px solid ${color};` +
    `border-radius:6px;padding:1px 6px;white-space:nowrap">${escapeHtml(text)}</span>`
  );
}

/**
 * The reviewer's body: the stem; for a multiple-choice question the options, the key marked
 * (the web: the option equal to the key) and the student's answer tagged with their first name,
 * edged in the error colour when it is not the key; then the worked solution.
 */
export function questReviewHtml(
  item: Pick<QuestReviewItem, 'answer' | 'question'>,
  who: string,
  { errorColor }: Colors,
): string {
  const q = item.question;
  const html = (text: string) => mathHtml(text, errorColor);
  const parts = [`<div class="stem t">${html(q.stem)}</div>`];
  if (q.kind === 'choice') {
    const items = q.choices.map((choice, index) => {
      const key = choice === q.answer;
      const chosen = choice === item.answer;
      const edge = chosen && !key ? ' style="border-color:var(--error)"' : '';
      return (
        `<li class="choice${key ? ' key' : ''}"${edge}>` +
        `<span class="letter">${escapeHtml(LETTERS[index] ?? String(index + 1))}</span>` +
        `<span class="text t">${html(choice)}</span>` +
        (key ? tag('Key', true) : '') +
        (chosen ? tag(`${who}’s answer`, false) : '') +
        '</li>'
      );
    });
    parts.push(`<ol class="choices">${items.join('')}</ol>`);
  }
  parts.push(
    `<div class="solution"><div class="label">Worked solution</div><div class="t">${html(q.solution)}</div></div>`,
  );
  return parts.join('');
}
