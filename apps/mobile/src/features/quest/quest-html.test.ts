// Question Quest's KaTeX pages (Phase 42): the student's stem and choices never carry a key or a
// solution; the reviewer's body marks the key and the student's answer, as the web's review card.
import type { QuestReviewItem } from '@tmi/shared';

import {
  questChoiceSpeech,
  questChoicesHtml,
  questReviewHtml,
  questReviewSpeech,
  questReviewText,
  questStemHtml,
} from './quest-html';

const COLORS = { errorColor: 'red' };

const ITEM: Pick<QuestReviewItem, 'answer' | 'question'> = {
  answer: '5',
  question: {
    id: 'q1',
    kind: 'choice',
    difficulty: 2,
    level_id: 'BA3',
    topic_code: 'BA3.01',
    topic_name: 'Shapes',
    skill: null,
    stem: 'What is $2+2$?',
    choices: ['3', '4', '5', '6'],
    answer: '4',
    solution: 'Two and two make $4$.',
    solver_answer: '4',
    solver_issues: null,
  },
};

describe('the student page', () => {
  it('draws the stem with KaTeX and nothing else', () => {
    const html = questStemHtml('What is $2+2$?', COLORS);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('choice');
  });

  it('letters the choices and marks only the one chosen', () => {
    const html = questChoicesHtml({ choices: ['3', '4', '5', '6'] }, 1, COLORS);
    expect(html.match(/class="choice[ "]/g)).toHaveLength(4);
    expect(html.match(/class="choice sel"/g)).toHaveLength(1);
    expect(html).toContain('<span class="letter">D</span>');
    expect(html).not.toContain('key');
    expect(questChoicesHtml({ choices: ['3', '4'] }, null, COLORS)).not.toContain(' sel');
  });

  it('escapes text, so a choice cannot carry markup', () => {
    const html = questChoicesHtml({ choices: ['<b>x</b>'] }, null, COLORS);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  it('reads a choice aloud by its letter', () => {
    expect(questChoiceSpeech('70', 1)).toBe('Choice B: 70');
  });
});

describe('the review body', () => {
  it("marks the key, tags the student's wrong answer and edges it, and shows the solution", () => {
    const html = questReviewHtml(ITEM, 'Sofia', COLORS);
    expect(html.match(/class="choice key"/g)).toHaveLength(1);
    expect(html).toContain('>Key<');
    expect(html).toContain('Sofia’s answer');
    expect(html).toContain('border-color:var(--error)');
    expect(html).toContain('Worked solution');
  });

  it('tags a right answer on the key itself, with no error edge', () => {
    const html = questReviewHtml({ ...ITEM, answer: '4' }, 'Sofia', COLORS);
    expect(html).toContain('Sofia’s answer');
    expect(html).not.toContain('var(--error)"');
  });

  it('has no options for a numeric question', () => {
    const html = questReviewHtml(
      { answer: '7', question: { ...ITEM.question, kind: 'numeric', choices: [], answer: '7' } },
      'Sofia',
      COLORS,
    );
    expect(html).not.toMatch(/class="choice[ "]/);
    expect(html).toContain('Worked solution');
  });

  it('says the body aloud and as text, with the key and the answer named', () => {
    const speech = questReviewSpeech(ITEM, 'Sofia');
    expect(speech).toContain('Choice B: 4, the key.');
    expect(speech).toContain('Choice C: 5, Sofia’s answer.');
    expect(speech).toContain('Worked solution.');
    const text = questReviewText(ITEM, 'Sofia');
    expect(text).toContain('B. 4  (key)');
    expect(text).toContain('C. 5  (Sofia’s answer)');
  });
});
