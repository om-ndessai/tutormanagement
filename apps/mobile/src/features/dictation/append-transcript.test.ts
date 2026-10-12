import { appendTranscript } from './append-transcript';

describe('appendTranscript', () => {
  it('starts an empty field with a capital and no separator', () => {
    expect(appendTranscript('', 'factored by grouping')).toBe('Factored by grouping');
  });

  it('joins words with one space, without inventing punctuation', () => {
    expect(appendTranscript('Factored', 'by grouping')).toBe('Factored by grouping');
    expect(appendTranscript('Factored ', 'by grouping')).toBe('Factored by grouping');
  });

  it('capitalises after a full stop, a question mark or a new line', () => {
    expect(appendTranscript('Long division.', 'then fractions')).toBe('Long division. Then fractions');
    expect(appendTranscript('Ready?', 'yes')).toBe('Ready? Yes');
    expect(appendTranscript('Line one\n', 'line two')).toBe('Line one\nLine two');
  });

  it('keeps the recognizer’s own punctuation', () => {
    expect(appendTranscript('', 'fractions, then decimals.')).toBe('Fractions, then decimals.');
  });

  it('changes nothing for an empty transcript', () => {
    expect(appendTranscript('Kept', '   ')).toBe('Kept');
  });
});
