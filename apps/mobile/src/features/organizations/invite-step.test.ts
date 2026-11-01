import { clearInviteStep, hasInviteStep, markInviteStep } from './invite-step';

describe('the invite step mark (Phase 61, S12)', () => {
  it('is held for the space just started only, until the step is left', () => {
    expect(hasInviteStep('s-one')).toBe(false);
    markInviteStep('s-one');
    expect(hasInviteStep('s-one')).toBe(true);
    expect(hasInviteStep('s-two')).toBe(false);
    expect(hasInviteStep(null)).toBe(false);
    // Read, not taken.
    expect(hasInviteStep('s-one')).toBe(true);
    clearInviteStep();
    expect(hasInviteStep('s-one')).toBe(false);
  });
});
