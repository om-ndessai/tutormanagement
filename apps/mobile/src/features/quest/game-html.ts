// Ported from the results list of apps/web/src/features/quest/game-page.tsx @ cd0378d (working
// tree, Results): one question of a team's series after the game -- the stem, what the team answered,
// the right answer and the worked solution. Mobile (design 60): one result at a time, drawn in one
// persistent KaTeX web view (`MathBody`), never a web view per question (a timed game can have 150);
// its native header carries the outcome and the key (`reviewLine`). Built on Hermes, escaped as
// quest-html.ts, so the page runs no script. Pure.
import type { GameResultItem } from '@tmi/shared';

import { mathToText } from '@/features/question-bank/math-text';
import { escapeHtml, mathHtml } from '@/features/question-bank/question-html';

const speak = (text: string) => mathToText(text, 'speech').replace(/[.]$/, '');
const show = (text: string) => mathToText(text, 'display');

interface Colors {
  errorColor: string;
}

export function gameResultHtml(
  item: Pick<GameResultItem, 'question' | 'answer' | 'skipped'>,
  { errorColor }: Colors,
): string {
  const html = (text: string) => mathHtml(text, errorColor);
  const q = item.question;
  const parts = [`<div class="stem t">${html(q.stem)}</div>`];
  if (!item.skipped && item.answer !== null) {
    parts.push(`<p class="t" style="color:var(--muted)">${escapeHtml('Answered: ')}${html(item.answer)}</p>`);
  }
  parts.push(`<p class="t"><strong>${escapeHtml('Answer: ')}</strong>${html(q.answer)}</p>`);
  if (q.solution) {
    parts.push(
      `<div class="solution"><div class="label">Solution</div><div class="t">${html(q.solution)}</div></div>`,
    );
  }
  return parts.join('');
}

/** The result read aloud, in order (the web view is hidden from assistive tech). */
export function gameResultSpeech(item: Pick<GameResultItem, 'question' | 'answer' | 'skipped'>): string {
  const q = item.question;
  const parts = [`${speak(q.stem)}.`];
  if (!item.skipped && item.answer !== null) parts.push(`Answered: ${speak(item.answer)}.`);
  parts.push(`Answer: ${speak(q.answer)}.`);
  if (q.solution) parts.push('Solution.', `${speak(q.solution)}.`);
  return parts.join(' ');
}

/** The result as plain lines, when the page cannot draw. */
export function gameResultText(item: Pick<GameResultItem, 'question' | 'answer' | 'skipped'>): string {
  const q = item.question;
  const lines = [show(q.stem)];
  if (!item.skipped && item.answer !== null) lines.push(`Answered: ${show(item.answer)}`);
  lines.push(`Answer: ${show(q.answer)}`);
  if (q.solution) lines.push(`Solution: ${show(q.solution)}`);
  return lines.join('\n');
}
