// A Quest game's result page (Phase 46, design 60): after the game, one question with what the team
// answered, the key and the solution, escaped, with its speech and plain forms in the same order.
import type { GameResultItem } from '@tmi/shared';

import { gameResultHtml, gameResultSpeech, gameResultText } from './game-html';

const COLORS = { errorColor: 'red' };

const ITEM: GameResultItem = {
  number: 1,
  question: {
    id: 'q1',
    kind: 'numeric',
    stem: 'What is $\\frac{1}{2} + \\frac{1}{4}$?',
    choices: [],
    answer: '3/4',
    solution: 'Make quarters: $\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}$.',
  },
  answered_by: 'Sofia',
  answer: '2/4',
  correct: false,
  skipped: false,
};

describe('the result page', () => {
  it('holds the stem, the answer given, the key and the solution, with KaTeX', () => {
    const html = gameResultHtml(ITEM, COLORS);
    expect(html).toContain('class="katex"');
    expect(html).toContain('Answered: ');
    expect(html).toContain('Answer: ');
    expect(html).toContain('3/4');
    expect(html).toContain('2/4');
    expect(html).toContain('class="solution"');
    expect(html.indexOf('Answered')).toBeLessThan(html.indexOf('Answer: </strong>'));
  });

  it('leaves out the answer given when the question was skipped, and a missing solution', () => {
    const html = gameResultHtml(
      { ...ITEM, skipped: true, answer: null, question: { ...ITEM.question, solution: '' } },
      COLORS,
    );
    expect(html).not.toContain('Answered');
    expect(html).not.toContain('solution');
    expect(html).toContain('Answer: ');
  });

  it('escapes what is not maths', () => {
    const html = gameResultHtml(
      {
        ...ITEM,
        answer: '<img src=x onerror=alert(1)>',
        question: { ...ITEM.question, stem: 'Is 3 < 4 & 5 > 2?' },
      },
      COLORS,
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('3 &lt; 4 &amp; 5 &gt; 2');
  });

  it('reads aloud and shows plainly in the same order', () => {
    const speech = gameResultSpeech(ITEM);
    expect(speech).toMatch(/^What is .*Answered: .*Answer: .*Solution\./);
    expect(speech).not.toContain('$');
    const text = gameResultText(ITEM);
    expect(text.split('\n')).toEqual([
      expect.stringContaining('What is'),
      expect.stringMatching(/^Answered: /),
      expect.stringMatching(/^Answer: /),
      expect.stringMatching(/^Solution: /),
    ]);
    expect(gameResultText({ ...ITEM, skipped: true, answer: null })).not.toContain('Answered');
  });
});
