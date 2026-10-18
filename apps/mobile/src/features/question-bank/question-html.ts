// Ported from apps/web/src/features/question-bank/question-card.tsx @ b0d216e (the body: the stem,
// the choices with the key marked, or "Answer:", and the worked solution) and math-text.tsx (KaTeX's
// options). Mobile: the body is HTML for the card's web view (#54), built here on Hermes, so the page
// carries no script at all. Pure: no React.
import { checkAnswer, type Question } from '@tmi/shared';
import katex from 'katex';

import { KATEX_CSS } from './katex-css.generated';
import { mathToText, splitMath } from './math-text';

/** What the body is built from: a question's content (a draft or an edit would do too). */
export type QuestionBody = Pick<Question, 'kind' | 'stem' | 'choices' | 'answer' | 'solution'>;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

/**
 * Text with maths in `$...$` as HTML: plain text escaped, each span KaTeX's own markup, with the
 * web's options -- `trust: false` refuses \href, \url, \includegraphics and \html*, and a span KaTeX
 * cannot read is drawn as typed, in the error colour, so a reviewer sees the problem rather than a
 * silently dropped symbol. `output: 'html'`: the web view is hidden from assistive tech, which reads
 * the native label (`bodySpeech`) instead.
 */
export function mathHtml(text: string, errorColor: string): string {
  return splitMath(text)
    .map((part) =>
      part.math
        ? katex.renderToString(part.value, {
            throwOnError: false,
            trust: false,
            strict: 'ignore',
            errorColor,
            output: 'html',
          })
        : escapeHtml(part.value),
    )
    .join('');
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** The card's body: the stem; the choices, the key marked (✓, weight and colour); the solution. */
export function questionBodyHtml(question: QuestionBody, { errorColor }: { errorColor: string }): string {
  const html = (text: string) => mathHtml(text, errorColor);
  const parts = [`<div class="stem t">${html(question.stem)}</div>`];
  if (question.kind === 'choice') {
    const items = question.choices.map((choice, index) => {
      const key = checkAnswer(question, choice);
      return (
        `<li class="choice${key ? ' key' : ''}">` +
        `<span class="letter">${LETTERS[index] ?? index + 1}</span>` +
        `<span class="text t">${html(choice)}</span>` +
        (key ? '<span class="mark">✓</span>' : '') +
        '</li>'
      );
    });
    parts.push(`<ol class="choices">${items.join('')}</ol>`);
  } else {
    parts.push(`<div class="answer t">Answer: <b>${html(question.answer)}</b></div>`);
  }
  parts.push(
    `<div class="solution"><div class="label">Solution</div><div class="t">${html(question.solution)}</div></div>`,
  );
  return parts.join('');
}

/** The page's colours: the theme's tokens, as CSS variables. Nothing else in the page has colour. */
export interface ShellColors {
  fg: string;
  muted: string;
  border: string;
  key: string;
  keyBg: string;
  soft: string;
  error: string;
}

/**
 * The page's own rules. No script may run in it (`script-src 'none'`); the height reporter is
 * injected by the host, which the page's CSP does not govern. Nothing can be fetched: the fonts
 * are inlined (`font-src data:`), and there are no images, frames, forms or base URL.
 */
export const SHELL_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'";

/** Text sizes at 1x, scaled by the reader's text size (Android's own zoom is held at 100%). */
const SIZES = { stem: 17, choice: 16, solution: 15, label: 12 } as const;

/**
 * The most the page scales its text. At iOS's largest accessibility sizes (about 3.1x) stacked
 * fractions on consecutive lines all but touched; at 2x (a 34px stem) they read cleanly. The native
 * text around the page still follows the reader's size in full.
 */
export const MAX_MATH_SCALE = 2;

/**
 * The whole page: KaTeX's stylesheet (fonts inlined), the theme as variables, and the body in
 * `#q`, whose `data-k` names the question it holds -- the host ignores a height for any other.
 */
export function mathShell({
  colors,
  fontScale,
  scheme,
  body,
  key,
}: {
  colors: ShellColors;
  fontScale: number;
  scheme: 'light' | 'dark';
  body: string;
  key: string;
}): string {
  const scale = Math.min(fontScale, MAX_MATH_SCALE);
  const px = (size: number) => `${Math.round(size * scale * 10) / 10}px`;
  const css = `
:root{--fg:${colors.fg};--muted:${colors.muted};--border:${colors.border};--key:${colors.key};--key-bg:${colors.keyBg};--soft:${colors.soft};--error:${colors.error};color-scheme:${scheme}}
html,body{margin:0;padding:0;background:transparent;color:var(--fg);-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{font-family:-apple-system,system-ui,Roboto,sans-serif;font-size:${px(SIZES.solution)};line-height:1.5;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#q{display:flow-root}
.t{white-space:pre-wrap;overflow-wrap:anywhere}
.stem{font-size:${px(SIZES.stem)};line-height:1.55;margin:0 0 12px}
.choices{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}
.choice{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:${px(SIZES.choice)}}
.choice.key{border-color:var(--key);background:var(--key-bg);font-weight:600}
.letter{color:var(--muted);min-width:1.1em;font-weight:500}
.choice .text{flex:1;min-width:0}
.mark{color:var(--key);font-weight:700}
.answer{font-size:${px(SIZES.choice)};margin:0 0 12px}
.answer b{font-weight:600}
.solution{background:var(--soft);border-radius:10px;padding:10px 12px;font-size:${px(SIZES.solution)}}
.label{color:var(--muted);font-size:${px(SIZES.label)};font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.katex-error{color:var(--error)}`;
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${SHELL_CSP}">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">' +
    `<style>${KATEX_CSS}</style><style>${css}</style>` +
    // aria-hidden on #q (WebKit ignores it on <body>): the page offers assistive tech and UI tests
    // nothing of its own; the host's native label reads the body instead. Without it WebKit exposes
    // every KaTeX span, which on iOS pushed the screen's accessibility tree past XCTest's depth limit
    // and emptied it. The in-place swap (`window.__q`) replaces #q's content, never #q.
    `</head><body><div id="q" aria-hidden="true" data-k="${escapeHtml(key)}">${body}</div></body></html>`
  );
}

/** "Answer." / "Answer?" kept; anything else gets its full stop. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.?!]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * The body read aloud, in order, for the label that stands in for the web view: "Question. What
 * is ...? Choice A: 7. Choice B: 70. Choice C: 700, the answer. Choice D: 7,000. Solution. ...".
 */
export function bodySpeech(question: QuestionBody): string {
  const speak = (text: string) => mathToText(text, 'speech');
  const parts = ['Question.', sentence(speak(question.stem))];
  if (question.kind === 'choice') {
    question.choices.forEach((choice, index) => {
      const said = speak(choice).replace(/[.]$/, '');
      const key = checkAnswer(question, choice);
      parts.push(`Choice ${LETTERS[index] ?? index + 1}: ${said}${key ? ', the answer' : ''}.`);
    });
  } else {
    parts.push(sentence(`Answer: ${speak(question.answer)}`));
  }
  parts.push('Solution.', sentence(speak(question.solution)));
  return parts.join(' ');
}

/** The body as plain lines, for when the web view cannot draw it. */
export function bodyText(question: QuestionBody): string {
  const show = (text: string) => mathToText(text, 'display');
  const lines = [show(question.stem)];
  if (question.kind === 'choice') {
    question.choices.forEach((choice, index) => {
      lines.push(
        `${LETTERS[index] ?? index + 1}. ${show(choice)}${checkAnswer(question, choice) ? '  ✓' : ''}`,
      );
    });
  } else {
    lines.push(`Answer: ${show(question.answer)}`);
  }
  lines.push(`Solution: ${show(question.solution)}`);
  return lines.join('\n');
}
