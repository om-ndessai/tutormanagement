import { USER_ROLES } from '@tmi/shared';

import { decideOnboarding, primaryRole, screenAfterTour } from './onboarding-model';
import { placementOf, TOUR_STEPS } from './tour-steps';

const never = { tour_finished_at: null, details_confirmed_at: null };
const been = { tour_finished_at: '2026-09-01T12:00:00.000Z', details_confirmed_at: null };

describe('the welcome wizard decides', () => {
  it('opens itself for somebody who has never been through it, on any device', () => {
    expect(decideOnboarding({ onboarding: never, viewingAs: false })).toBe('wizard');
  });

  // Phase 74 (JF25): once per PERSON -- the server's record decides; a new device offers nothing.
  it('offers nothing to somebody who has been through it, whatever the device', () => {
    expect(decideOnboarding({ onboarding: been, viewingAs: false })).toBe('none');
  });

  it('never opens while an admin is viewing somebody else', () => {
    expect(decideOnboarding({ onboarding: never, viewingAs: true })).toBe('none');
    expect(decideOnboarding({ onboarding: been, viewingAs: true })).toBe('none');
  });

  it('tours the first dashboard a person sees, and returns an admin to the start', () => {
    expect(primaryRole(['parent', 'tutor'])).toBe('tutor');
    expect(primaryRole(['student', 'admin'])).toBe('admin');
    expect(primaryRole([])).toBe('student');
    expect(screenAfterTour(true)).toBe('welcome');
    expect(screenAfterTour(false)).toBe('confirm');
  });
});

describe('the tour on a phone', () => {
  it('has steps for every role, each with a place to point at', () => {
    for (const role of USER_ROLES) {
      expect(TOUR_STEPS[role].length).toBeGreaterThan(0);
      for (const step of TOUR_STEPS[role]) expect(placementOf(step.target)).toBeTruthy();
    }
  });

  it('lights the tabs the tab bar has, Schedule in Lessons, and the rest of the menu in More', () => {
    expect(placementOf('nav-dashboard')).toEqual({ kind: 'tab', index: 0, within: null });
    expect(placementOf('nav-sessions')).toEqual({ kind: 'tab', index: 1, within: null });
    expect(placementOf('nav-schedule')).toEqual({ kind: 'tab', index: 1, within: 'Lessons' });
    expect(placementOf('nav-progress')).toEqual({ kind: 'tab', index: 2, within: null });
    expect(placementOf('nav-billing')).toEqual({ kind: 'tab', index: 3, within: 'More' });
    // Phase 74 (JF25, JF31): a parent's menu has no Billing, so neither has their tour.
    expect(TOUR_STEPS.parent.map((step) => step.target)).not.toContain('nav-billing');
    expect(TOUR_STEPS.tutor.map((step) => step.target)).toContain('nav-billing');
    expect(placementOf('dash-analytics')).toEqual({ kind: 'view', id: 'dash-analytics' });
    expect(placementOf('getting-started')).toEqual({ kind: 'view', id: 'getting-started' });
  });

  it('never names an organization', () => {
    const copy = JSON.stringify(TOUR_STEPS);
    expect(copy).not.toMatch(/Chapel Hill|Riverside|Institute/);
  });
});
