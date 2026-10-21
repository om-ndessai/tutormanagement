// The menu follows the organization's switches as the web's does (Phase 38): the Assessment item,
// with its Beta badge, only while the organization has it on -- for every role; and (Phase 42) Quest,
// only while the organization has Question Quest on.
import { visibleNavItems } from './nav-items';

describe('visibleNavItems', () => {
  const labels = (roles: string[], on: boolean) =>
    visibleNavItems(roles, { canvas_assessments: on }).map((item) => item.label);

  it('lists Assessment only while the organization has it on, for every role', () => {
    for (const roles of [['admin'], ['tutor'], ['parent'], ['student']]) {
      expect(labels(roles, true)).toContain('Assessment');
      expect(labels(roles, false)).not.toContain('Assessment');
    }
    expect(visibleNavItems(['admin'], null).map((item) => item.label)).not.toContain('Assessment');
  });

  it('places it after Progress, with its badge', () => {
    const items = visibleNavItems(['tutor'], { canvas_assessments: true });
    const at = items.findIndex((item) => item.label === 'Assessment');
    expect(items[at - 1]?.label).toBe('Progress');
    expect(items[at]).toMatchObject({ href: '/assessments', badge: 'Beta', tourId: 'nav-assessments' });
  });

  it('lists Quest only while the organization has Question Quest on, for every role', () => {
    const quest = (roles: string[], on: boolean) =>
      visibleNavItems(roles, { canvas_assessments: true, gamify_question_quest: on }).map((item) => item.label);
    for (const roles of [['admin'], ['tutor'], ['parent'], ['student']]) {
      expect(quest(roles, true)).toContain('Quest');
      expect(quest(roles, false)).not.toContain('Quest');
    }
    // Each switch on its own: Question Quest does not bring Assessment, nor the other way round.
    expect(labels(['student'], true)).not.toContain('Quest');
    const questOnly = visibleNavItems(['student'], { gamify_question_quest: true }).map((item) => item.label);
    expect(questOnly).toContain('Quest');
    expect(questOnly).not.toContain('Assessment');
  });

  it('places Quest after Assessment, as the web does, without a badge', () => {
    const items = visibleNavItems(['tutor'], { canvas_assessments: true, gamify_question_quest: true });
    const at = items.findIndex((item) => item.label === 'Quest');
    expect(items[at - 1]?.label).toBe('Assessment');
    expect(items[at]).toMatchObject({ href: '/quest', tourId: 'nav-quest' });
    expect(items[at]?.badge).toBeUndefined();
  });

  it('still leaves admin pages to admins', () => {
    expect(labels(['tutor'], true)).not.toContain('Organization');
    expect(labels(['admin'], true)).toContain('Organization');
  });
});
