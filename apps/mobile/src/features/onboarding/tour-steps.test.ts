// Phase 50: the tour follows the feature sets -- a menu step whose page is not on here is dropped,
// a space without Tutoring has its own steps, and a step lights the tab it is in among the tabs
// the bar shows here.
import { placementOf, SPACE_TOUR_STEPS, TOUR_STEPS, tourStepsFor } from './tour-steps';

jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({}) }));

const ALL = { canvas_assessments: true, gamify_question_quest: true };
const ASSESS_ONLY = {
  feature_tutoring: false,
  feature_assessment: true,
  feature_quest: false,
  canvas_assessments: true,
  gamify_question_quest: false,
};
const targets = (steps: { target: string }[]) => steps.map((step) => step.target);

describe('tourStepsFor', () => {
  it('is the Tutoring tour where every set is on', () => {
    expect(targets(tourStepsFor('admin', ALL))).toEqual(targets(TOUR_STEPS.admin));
    expect(targets(tourStepsFor('parent', ALL))).toEqual(targets(TOUR_STEPS.parent));
  });

  it('uses the space steps without Tutoring, less the pages that are not on', () => {
    const admin = targets(tourStepsFor('admin', ASSESS_ONLY));
    expect(admin).toEqual(targets(SPACE_TOUR_STEPS.admin).filter((target) => target !== 'nav-quest'));
    expect(admin).not.toContain('nav-sessions');
    expect(targets(tourStepsFor('student', ASSESS_ONLY))).toEqual([
      'dash-assess-students',
      'nav-assessments',
      'nav-profile',
    ]);
    expect(targets(tourStepsFor('parent', ASSESS_ONLY))).toContain('dash-assess-recent');
  });

  it('drops a disallowed set’s menu steps', () => {
    const neither = { ...ASSESS_ONLY, feature_assessment: false };
    expect(targets(tourStepsFor('admin', neither))).not.toContain('nav-assessments');
    // Tutoring on but Quest not allowed: no Quest step, whatever the switch says.
    expect(targets(tourStepsFor('admin', { ...ALL, feature_quest: false }))).not.toContain('nav-quest');
  });
});

describe('placementOf', () => {
  it('finds a page under More among the tabs shown here', () => {
    expect(placementOf('nav-assessments', ['dashboard', 'more'])).toEqual({
      kind: 'tab',
      index: 1,
      within: 'More',
    });
    expect(placementOf('nav-assessments')).toEqual({ kind: 'tab', index: 3, within: 'More' });
  });

  it('keeps the four tabs where Tutoring is on', () => {
    expect(placementOf('nav-sessions')).toEqual({ kind: 'tab', index: 1, within: null });
    expect(placementOf('nav-schedule')).toEqual({ kind: 'tab', index: 1, within: 'Sessions' });
    expect(placementOf('nav-dashboard', ['dashboard', 'more'])).toEqual({
      kind: 'tab',
      index: 0,
      within: null,
    });
    expect(placementOf('dash-assess-students')).toEqual({ kind: 'view', id: 'dash-assess-students' });
  });
});

describe('Phase 66: the tour starts on the member home', () => {
  it('leads each role with the home’s blocks, as the web', () => {
    expect(targets(TOUR_STEPS.tutor).slice(0, 4)).toEqual(['home-band', 'home-next-up', 'home-to-record', 'nav-analytics']);
    expect(TOUR_STEPS.tutor[0]!.title).toBe('Your teaching at a glance');
    expect(TOUR_STEPS.tutor[1]!.title).toBe('Next up');
    expect(TOUR_STEPS.tutor.at(-1)!.title).toBe('Your profile');
    expect(targets(TOUR_STEPS.admin).slice(0, 3)).toEqual(['home-band', 'home-next-up', 'nav-analytics']);
    expect(targets(TOUR_STEPS.parent).slice(0, 3)).toEqual(['home-section-parent', 'home-next-up', 'nav-analytics']);
    expect(targets(TOUR_STEPS.student).slice(0, 3)).toEqual(['home-band', 'home-next-up', 'nav-analytics']);
  });

  it('lights no dashboard section and no Tutoring/Finance tabs: those moved to More → Dashboard', () => {
    for (const steps of Object.values(TOUR_STEPS)) {
      for (const target of targets(steps)) {
        expect(target.startsWith('dash-')).toBe(false);
        expect(target).not.toBe('tabs');
      }
    }
  });

  it('finds the Dashboard step under More, and keeps it where Tutoring is on', () => {
    expect(placementOf('nav-analytics')).toEqual({ kind: 'tab', index: 3, within: 'More' });
    expect(targets(tourStepsFor('tutor', ALL))).toContain('nav-analytics');
    expect(targets(tourStepsFor('tutor', ALL))).toContain('nav-schedule');
  });
});
