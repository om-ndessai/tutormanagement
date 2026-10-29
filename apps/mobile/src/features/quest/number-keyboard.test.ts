import { numberAnswerKeyboard } from './number-keyboard';

describe('numberAnswerKeyboard', () => {
  it('gives iOS the keyboard with "/" and "-"', () => {
    expect(numberAnswerKeyboard('ios')).toBe('numbers-and-punctuation');
  });

  it('never a pad without the fraction bar, on either platform', () => {
    for (const os of ['ios', 'android']) {
      expect(['phone-pad', 'number-pad', 'decimal-pad', 'numeric']).not.toContain(numberAnswerKeyboard(os));
    }
  });
});
