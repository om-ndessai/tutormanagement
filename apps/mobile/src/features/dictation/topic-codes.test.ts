import { normaliseTopicCodes } from './topic-codes';

const ids = new Set(['BA3.10', 'BA1.01', 'PRE.02', 'ALG.13', 'GEO.06']);

describe('normaliseTopicCodes', () => {
  it('writes spoken codes as the catalogue does, when the topic exists', () => {
    expect(normaliseTopicCodes('worked on B A three point ten today', ids)).toBe('worked on BA3.10 today');
    expect(normaliseTopicCodes('BA 3.10 again', ids)).toBe('BA3.10 again');
    expect(normaliseTopicCodes('started ba one point one', ids)).toBe('started BA1.01');
    expect(normaliseTopicCodes('pre two and alg thirteen', ids)).toBe('PRE.02 and ALG.13');
    expect(normaliseTopicCodes('geo point six', ids)).toBe('GEO.06');
  });

  it('leaves unknown codes, and ordinary words, as heard', () => {
    expect(normaliseTopicCodes('B A nine point ten', ids)).toBe('B A nine point ten');
    expect(normaliseTopicCodes('pre seven', ids)).toBe('pre seven');
    expect(normaliseTopicCodes('geometry two problems', ids)).toBe('geometry two problems');
    expect(normaliseTopicCodes('pre-algebra two', ids)).toBe('pre-algebra two');
  });

  it('does nothing before the catalogue has loaded', () => {
    expect(normaliseTopicCodes('B A three point ten', new Set())).toBe('B A three point ten');
  });
});
