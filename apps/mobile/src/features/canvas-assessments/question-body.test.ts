// The question as the person taking the assessment sees it: KaTeX's maths, the choices lettered,
// the chosen one marked -- never a key, a solution or a "correct" colour.
import { assessmentBodyHtml, choiceSpeech, stemSpeech } from './question-body';

const ERROR = 'ERROR-TOKEN';
const CHOICE = {
  kind: 'choice' as const,
  stem: 'Which is $\\frac{3}{4}$ of 8?',
  choices: ['6', '$\\frac{8}{3}$', '<b>2</b>', '32'],
};

describe('assessmentBodyHtml', () => {
  it('typesets the stem and letters the choices, marking only the selected one', () => {
    const html = assessmentBodyHtml(CHOICE, 1, { errorColor: ERROR });
    expect(html).toContain('class="katex"');
    expect(html.match(/<li class="choice/g)).toHaveLength(4);
    expect(html.match(/class="choice sel"/g)).toHaveLength(1);
    expect(html).toContain('<span class="letter">B</span>');
    // Never the bank's key styling, mark or solution.
    expect(html).not.toMatch(/class="choice key"|class="mark"|class="solution"/);
    // Text is escaped.
    expect(html).toContain('&lt;b&gt;2&lt;/b&gt;');
  });

  it('marks nothing with no choice made, and has no choices for a numeric question', () => {
    expect(assessmentBodyHtml(CHOICE, null, { errorColor: ERROR })).not.toContain('choice sel');
    expect(assessmentBodyHtml({ kind: 'numeric', stem: 'What is 2 + 2?', choices: [] }, null, { errorColor: ERROR })).not.toContain(
      'class="choices"',
    );
  });
});

describe('speech', () => {
  it('reads the stem and each choice in words', () => {
    expect(stemSpeech(CHOICE.stem)).toContain('3 over 4');
    expect(choiceSpeech('$\\frac{8}{3}$', 1)).toBe('Choice B: 8 over 3');
  });
});
