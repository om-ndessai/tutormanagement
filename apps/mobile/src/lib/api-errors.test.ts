import { ApiRequestError } from './api-client';
import { isRateLimited, showProblem } from './api-errors';

describe('api errors (Phase 51)', () => {
  const toast = () => ({ error: jest.fn(), info: jest.fn() });

  it('says a rate limit calmly, in the server’s words', () => {
    const t = toast();
    const limited = new ApiRequestError(429, 'rate_limited', 'Too many tries. Try again in 42 seconds.');
    expect(isRateLimited(limited)).toBe(true);
    showProblem(t, limited, 'fallback');
    expect(t.info).toHaveBeenCalledWith('Too many tries. Try again in 42 seconds.');
    expect(t.error).not.toHaveBeenCalled();
  });

  it('shows any other refusal as an error, and a non-answer as the fallback', () => {
    const t = toast();
    showProblem(t, new ApiRequestError(409, 'conflict', 'You have asked already.'), 'fallback');
    expect(t.error).toHaveBeenLastCalledWith('You have asked already.');
    showProblem(t, new Error('boom'), 'Could not ask to join.');
    expect(t.error).toHaveBeenLastCalledWith('Could not ask to join.');
    expect(isRateLimited(new Error('x'))).toBe(false);
  });
});
