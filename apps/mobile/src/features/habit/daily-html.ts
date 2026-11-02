// The Daily's result list of apps/web/src/features/habit/daily-page.tsx @ 0e3ec7a (working tree): each
// question's mark and number, its stem and, once played, its key. Mobile: one page for the bank's KaTeX
// web view (`MathBody`), never a web view per question, with the same in words for assistive tech and as
// plain text should the page not draw. Pure.
import type { DailyQuestion } from '@tmi/shared';

import { escapeHtml, mathHtml } from '@/features/question-bank/question-html';
import { mathToText } from '@/features/question-bank/math-text';

interface Colors {
  errorColor: string;
}

export function dailyResultHtml(
  questions: readonly DailyQuestion[],
  marks: readonly boolean[],
  { errorColor }: Colors,
): string {
  const html = (text: string) => mathHtml(text, errorColor);
  return questions
    .map((q, i) => {
      const right = marks[i] === true;
      const mark = `<span style="color:${right ? 'var(--key)' : 'var(--error)'};font-weight:700">${right ? '✓' : '✗'}</span>`;
      const answer =
        q.answer !== undefined ? `<div class="answer t">Answer: <b>${html(q.answer)}</b></div>` : '';
      const edge = i > 0 ? 'border-top:1px solid var(--border);padding-top:12px;' : '';
      return (
        `<section style="${edge}margin-bottom:12px">` +
        `<div class="label">${mark} ${escapeHtml(String(i + 1))}</div>` +
        `<div class="stem t">${html(q.stem)}</div>${answer}</section>`
      );
    })
    .join('');
}

export function dailyResultSpeech(questions: readonly DailyQuestion[], marks: readonly boolean[]): string {
  return questions
    .map((q, i) => {
      const said = [`Question ${i + 1}, ${marks[i] ? 'right' : 'wrong'}.`, mathToText(q.stem, 'speech')];
      if (q.answer !== undefined) said.push(`Answer: ${mathToText(q.answer, 'speech')}.`);
      return said.join(' ');
    })
    .join(' ');
}

export function dailyResultText(questions: readonly DailyQuestion[], marks: readonly boolean[]): string {
  return questions
    .map((q, i) => {
      const lines = [`${marks[i] ? '✓' : '✗'} ${i + 1}`, mathToText(q.stem, 'display')];
      if (q.answer !== undefined) lines.push(`Answer: ${mathToText(q.answer, 'display')}`);
      return lines.join('\n');
    })
    .join('\n\n');
}
