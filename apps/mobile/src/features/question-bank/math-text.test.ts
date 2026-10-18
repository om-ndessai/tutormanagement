// The question bank's maths as plain text (#54): the web's split on `$`, the display form for native
// lines and the spoken form for the body's label -- for every command the bank uses, and swept over
// every string in apps/api/db/questions/*.json.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { latexToText, mathToText, splitMath } from './math-text';

describe('splitMath', () => {
  it('splits balanced text into plain and maths parts, as the web does', () => {
    expect(splitMath('What is $3 + 4$?')).toEqual([
      { math: false, value: 'What is ' },
      { math: true, value: '3 + 4' },
      { math: false, value: '?' },
    ]);
  });

  it('keeps an odd number of `$` as typed', () => {
    expect(splitMath('It costs $5 and $6 and $7')).toEqual([
      { math: false, value: 'It costs $5 and $6 and $7' },
    ]);
    expect(mathToText('a $ b', 'display')).toBe('a $ b');
  });

  it('handles empty text and a span at either end', () => {
    expect(splitMath('')).toEqual([{ math: false, value: '' }]);
    expect(splitMath('$x$')).toEqual([
      { math: false, value: '' },
      { math: true, value: 'x' },
      { math: false, value: '' },
    ]);
  });
});

describe('latexToText', () => {
  const cases: [string, string, string][] = [
    // [latex, display, speech]
    ['\\frac{3}{4}', '3/4', '3 over 4'],
    ['\\frac{x+1}{2}', '(x+1)/2', 'x+1 over 2'],
    ['3 \\times 4', '3 × 4', '3 times 4'],
    ['12 \\div 4 = 3', '12 ÷ 4 = 3', '12 divided by 4 = 3'],
    ['35^\\circ', '35°', '35 degrees'],
    ['2\\pi r', '2πr', '2 pi r'],
    ['\\sqrt{49}', '√49', 'square root of 49'],
    ['\\sqrt{x+1}', '√(x+1)', 'square root of x+1'],
    ['\\angle B', '∠B', 'angle B'],
    ['2 + 3m \\le 25', '2 + 3m ≤ 25', '2 + 3m is less than or equal to 25'],
    ['3 + 2m \\ge 25', '3 + 2m ≥ 25', '3 + 2m is greater than or equal to 25'],
    ['\\text{base} \\times \\text{height}', 'base × height', 'base times height'],
    ['0.5 \\times 6.5 \\approx 3', '0.5 × 6.5 ≈ 3', '0.5 times 6.5 is approximately 3'],
    ['0 \\to 0', '0 → 0', '0 to 0'],
    ['36 \\div \\square = 9', '36 ÷ □ = 9', '36 divided by blank = 9'],
    ['\\overrightarrow{QP}', 'ray QP', 'ray QP'],
    ['\\overleftrightarrow{PQ}', 'line PQ', 'line PQ'],
    ['\\overline{PQ}', 'P̅Q̅', 'segment PQ'],
    ['2 \\times \\left(\\frac{1}{2} \\times 3\\right)', '2 × (1/2 × 3)', '2 times ( 1 over 2 times 3 )'],
    ['\\frac{30}{40} = 75\\%', '30/40 = 75%', '30 over 40 = 75 percent'],
    ['x^3 \\cdot x^4', 'x³ · x⁴', 'x cubed times x to the power of 4'],
    ['\\frac{5}{12} = 0.41666\\ldots', '5/12 = 0.41666…', '5 over 12 = 0.41666 and so on'],
    ['8+15\\ne 17', '8+15 ≠ 17', '8+15 is not equal to 17'],
    ['\\hat{y} = 1.5x', 'ŷ = 1.5x', 'y hat = 1.5x'],
    ['4{,}732', '4,732', '4,732'],
    ['x^2', 'x²', 'x squared'],
    ['10^{12}', '10¹²', '10 to the power of 12'],
    ['b_1 + b_2', 'b₁ + b₂', 'b sub 1 + b sub 2'],
  ];

  it.each(cases)('%s', (latex, display, speech) => {
    expect(latexToText(latex, 'display')).toBe(display);
    expect(latexToText(latex, 'speech')).toBe(speech);
  });

  it('reads an unknown command by its name, never dropping it', () => {
    expect(latexToText('\\foo{x}', 'speech')).toBe('foo x');
    expect(latexToText('\\foo{x}', 'display')).toBe('foox');
  });

  it('writes the text around a span as it is', () => {
    expect(mathToText('Write $\\frac{2}{3}$ as $\\frac{4}{6}$.', 'display')).toBe('Write 2/3 as 4/6.');
    expect(mathToText('Write $\\frac{2}{3}$ as $\\frac{4}{6}$.', 'speech')).toBe(
      'Write 2 over 3 as 4 over 6.',
    );
  });
});

describe('the whole bank', () => {
  const dir = join(__dirname, '../../../../api/db/questions');
  const strings: string[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const { questions } = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
      questions: {
        stem: string;
        choices: string[];
        answer: string;
        solution: string;
        checks?: { solve?: { answer?: string; work?: string; issues?: string } | null };
      }[];
    };
    for (const q of questions) {
      strings.push(q.stem, ...q.choices, q.answer, q.solution);
      const solve = q.checks?.solve;
      if (solve) strings.push(solve.answer ?? '', solve.work ?? '', solve.issues ?? '');
    }
  }

  it('reads hundreds of questions', () => {
    expect(strings.length).toBeGreaterThan(3000);
  });

  it.each(['display', 'speech'] as const)('leaves no \\, {, } or $ in any converted span (%s)', (mode) => {
    const left: string[] = [];
    for (const text of strings) {
      for (const part of splitMath(text)) {
        if (!part.math) continue;
        const out = latexToText(part.value, mode);
        if (/[\\{}$]/.test(out)) left.push(`${part.value} -> ${out}`);
      }
    }
    expect(left).toEqual([]);
  });
});
