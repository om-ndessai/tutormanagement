// The menu follows the organization's switches as the web's does (Phase 38): the Assessment item,
// with its Beta badge, only while the organization has it on -- for every role.
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

  it('still leaves admin pages to admins', () => {
    expect(labels(['tutor'], true)).not.toContain('Organization');
    expect(labels(['admin'], true)).toContain('Organization');
  });
});
