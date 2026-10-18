// Phase 40: the Organization card's "Questions in an assessment" stepper stays inside 1-25.
import { stepQuestionCount } from './settings-form';

describe('stepQuestionCount', () => {
  it('moves by one, never below 1 or above 25', () => {
    expect(stepQuestionCount(10, 1)).toBe(11);
    expect(stepQuestionCount(10, -1)).toBe(9);
    expect(stepQuestionCount(1, -1)).toBe(1);
    expect(stepQuestionCount(25, 1)).toBe(25);
  });
});
