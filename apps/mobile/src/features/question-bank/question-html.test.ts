// The card's body for the web view (#54), built with the real KaTeX: maths becomes KaTeX's markup,
// everything else is escaped text, nothing can fetch or run, and the colours are the tokens given.
import { KATEX_CSS } from './katex-css.generated';
import { SHELL_CSP, bodySpeech, bodyText, mathHtml, mathShell, questionBodyHtml } from './question-html';

const ERROR = '#C62828'; // test data, not a component colour
const COLORS = {
  fg: '#111111',
  muted: '#555555',
  border: '#DDDDDD',
  key: '#249057',
  keyBg: '#2490571F',
  soft: '#F2F2F280',
  error: ERROR,
};

const CHOICE = {
  kind: 'choice' as const,
  stem: 'What is the value of the digit 7 in $4{,}732$?',
  choices: ['7', '70', '700', '7,000'],
  answer: '700',
  solution: 'The 7 is in the hundreds place: $7 \\times 100 = 700$.',
};
const NUMERIC = {
  kind: 'numeric' as const,
  stem: 'What is $\\frac{2}{3} + \\frac{1}{6}$?',
  choices: [],
  answer: '5/6',
  solution: 'Write $\\frac{2}{3}$ as $\\frac{4}{6}$.',
};

describe('mathHtml', () => {
  it('draws \\frac with KaTeX', () => {
    const html = mathHtml('$\\frac{3}{4}$', ERROR);
    expect(html).toContain('class="katex"');
    expect(html).toContain('mfrac');
    // output: 'html' -- the web view is hidden from assistive tech, so no MathML.
    expect(html).not.toContain('<math');
  });

  it('keeps tags and ampersands in plain text as text', () => {
    const html = mathHtml('<script>alert(1)</script> <img src=x onerror=alert(1)> & more', ERROR);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; more');
  });

  it('refuses links and pictures inside maths (trust: false)', () => {
    const html = mathHtml(
      '$\\href{https://example.com}{x}$ and $\\includegraphics{https://example.com/a.png}$',
      ERROR,
    );
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a ');
  });

  it("draws an unknown command as typed, in the theme's error colour", () => {
    const html = mathHtml('$\\notacommand{2}$', ERROR);
    expect(html).toContain(`color:${ERROR}`);
    expect(html).toContain('\\notacommand');
  });

  it('draws a span it cannot parse as typed, in the error colour', () => {
    const html = mathHtml('$\\frac{1}$', ERROR);
    expect(html).toContain('katex-error');
    expect(html).toContain(`color:${ERROR}`);
  });
});

describe('questionBodyHtml', () => {
  it('marks the key choice, and only it', () => {
    const html = questionBodyHtml(CHOICE, { errorColor: ERROR });
    expect(html.match(/class="choice key"/g)).toHaveLength(1);
    expect(html).toMatch(
      /class="choice key"><span class="letter">C<\/span><span class="text t">700<\/span><span class="mark">✓<\/span>/,
    );
    expect(html).toContain('<div class="label">Solution</div>');
  });

  it('shows "Answer:" for a numeric question', () => {
    const html = questionBodyHtml(NUMERIC, { errorColor: ERROR });
    expect(html).toContain('Answer: <b>5/6</b>');
    expect(html).not.toContain('class="choices"');
  });
});

describe('mathShell', () => {
  const page = mathShell({
    colors: COLORS,
    fontScale: 1.5,
    scheme: 'dark',
    body: questionBodyHtml(NUMERIC, { errorColor: ERROR }),
    key: 'q-1',
  });

  it('allows no script, no fetch and no address of any kind', () => {
    expect(page).toContain(`content="${SHELL_CSP}"`);
    expect(SHELL_CSP).toContain("default-src 'none'");
    expect(SHELL_CSP).toContain("script-src 'none'");
    expect(page).not.toMatch(/https?:/);
    expect(page).not.toMatch(/<script/i);
    expect(KATEX_CSS).not.toMatch(/url\((?!data:font\/woff2)/);
  });

  it('takes its colours only from the tokens given', () => {
    const colours = page.replace(KATEX_CSS, '').match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
    expect(new Set(colours)).toEqual(new Set(Object.values(COLORS)));
    expect(KATEX_CSS).not.toMatch(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/);
    expect(page).toContain('color-scheme:dark');
  });

  it("scales its text by the reader's text size and names the body it holds", () => {
    expect(page).toContain('.stem{font-size:25.5px');
    // Capped at 2x: at iOS's largest sizes stacked fractions on consecutive lines touched.
    const largest = mathShell({ colors: COLORS, fontScale: 3.1, scheme: 'light', body: '', key: 'q-1' });
    expect(largest).toContain('.stem{font-size:34px');
    // Assistive tech reads the native label; the page itself is hidden from it.
    expect(page).toContain('<div id="q" aria-hidden="true" data-k="q-1">');
  });
});

describe('bodySpeech and bodyText', () => {
  it('reads the body in order and names the key', () => {
    expect(bodySpeech(CHOICE)).toBe(
      'Question. What is the value of the digit 7 in 4,732? Choice A: 7. Choice B: 70. Choice C: 700, the answer. Choice D: 7,000. Solution. The 7 is in the hundreds place: 7 times 100 = 700.',
    );
  });

  it('reads a numeric answer', () => {
    expect(bodySpeech(NUMERIC)).toBe(
      'Question. What is 2 over 3 + 1 over 6? Answer: 5/6. Solution. Write 2 over 3 as 4 over 6.',
    );
  });

  it('gives the plain lines for when the page cannot draw', () => {
    expect(bodyText(CHOICE).split('\n')).toEqual([
      'What is the value of the digit 7 in 4,732?',
      'A. 7',
      'B. 70',
      'C. 700  ✓',
      'D. 7,000',
      'Solution: The 7 is in the hundreds place: 7 × 100 = 700.',
    ]);
  });
});
