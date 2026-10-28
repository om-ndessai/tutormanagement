// A reading drawn natively (design #64): a top-level \frac stacked, the rest as the bank's display text,
// so a stacked fraction and a slash never look alike.
import { mathRuns, mathSpeech } from './math-line-model';

describe('mathRuns', () => {
  it('keeps plain maths as one run of display text', () => {
    expect(mathRuns('3x+5=20')).toEqual([{ kind: 'text', text: '3x+5=20' }]);
    expect(mathRuns('7\\times8=54')).toEqual([{ kind: 'text', text: '7 × 8=54' }]);
    expect(mathRuns('5^{2}=25')).toEqual([{ kind: 'text', text: '5²=25' }]);
  });

  it('stacks a fraction, and leaves a slash as written', () => {
    expect(mathRuns('\\frac{3}{4}')).toEqual([
      { kind: 'frac', top: [{ kind: 'text', text: '3' }], bottom: [{ kind: 'text', text: '4' }] },
    ]);
    expect(mathRuns('3/4')).toEqual([{ kind: 'text', text: '3/4' }]);
  });

  it('splits the text around each fraction', () => {
    expect(mathRuns('\\frac{3}{4}+\\frac{1}{4}=1')).toEqual([
      { kind: 'frac', top: [{ kind: 'text', text: '3' }], bottom: [{ kind: 'text', text: '4' }] },
      { kind: 'text', text: '+' },
      { kind: 'frac', top: [{ kind: 'text', text: '1' }], bottom: [{ kind: 'text', text: '4' }] },
      { kind: 'text', text: '=1' },
    ]);
  });

  it('reads \\dfrac, \\tfrac and single-character arguments too', () => {
    const half = { kind: 'frac', top: [{ kind: 'text', text: '1' }], bottom: [{ kind: 'text', text: '2' }] };
    expect(mathRuns('\\dfrac{1}{2}')).toEqual([half]);
    expect(mathRuns('\\tfrac12')).toEqual([half]);
    expect(mathRuns('\\frac 1 2')).toEqual([half]);
  });

  it('stacks a fraction inside a fraction', () => {
    expect(mathRuns('\\frac{\\frac{1}{2}}{3}')).toEqual([
      {
        kind: 'frac',
        top: [{ kind: 'frac', top: [{ kind: 'text', text: '1' }], bottom: [{ kind: 'text', text: '2' }] }],
        bottom: [{ kind: 'text', text: '3' }],
      },
    ]);
  });

  it('keeps brackets around a fraction, and a fraction inside a group as text', () => {
    expect(mathRuns('\\left(\\frac{1}{2}\\right)')).toEqual([
      { kind: 'text', text: '(' },
      { kind: 'frac', top: [{ kind: 'text', text: '1' }], bottom: [{ kind: 'text', text: '2' }] },
      { kind: 'text', text: ')' },
    ]);
    expect(mathRuns('x^{\\frac{1}{2}}')).toEqual([{ kind: 'text', text: 'x^(1/2)' }]);
  });

  it('keeps an unfinished fraction as the bank’s text, never dropping it', () => {
    expect(mathRuns('\\frac{3}{')).toEqual([{ kind: 'text', text: '3/' }]);
    expect(mathRuns('2x+')).toEqual([{ kind: 'text', text: '2x+' }]);
    expect(mathRuns('')).toEqual([]);
  });
});

describe('mathSpeech', () => {
  it('says a fraction as words', () => {
    expect(mathSpeech('\\frac{3}{4}+\\frac{1}{4}=1')).toBe('3 over 4 + 1 over 4 =1');
    expect(mathSpeech('7\\times8')).toBe('7 times 8');
  });
});
