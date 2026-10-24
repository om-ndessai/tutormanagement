import { quickActionItems, quickActionRoute } from './quick-actions';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-quick-actions', () => ({
  initial: null,
  setItems: jest.fn(() => Promise.resolve()),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const ORG = {};
const ASSESS_ONLY = { feature_tutoring: false, feature_assessment: true, canvas_assessments: true };

describe('home-screen quick actions', () => {
  it('are offered only to someone who teaches here, with generic verbs and nothing else', () => {
    expect(quickActionItems(['tutor'], ORG).map((item) => item.title)).toEqual([
      'Start a lesson',
      'Record a lesson',
    ]);
    expect(quickActionItems(['admin', 'tutor', 'parent'], ORG)).toHaveLength(2);
    for (const roles of [['admin'], ['parent'], ['student'], []] as const) {
      expect(quickActionItems(roles, ORG)).toEqual([]);
    }
    expect(quickActionItems(undefined, ORG)).toEqual([]);
    // A system surface: no name, no organization, no money -- only the two fixed titles.
    for (const item of quickActionItems(['tutor'], ORG)) {
      expect(Object.keys(item).sort()).toEqual(['icon', 'id', 'title']);
      expect(item.title).not.toMatch(/\$|[0-9]/);
    }
  });

  it('lead to their sheet only while the reader still teaches in this organization', () => {
    expect(quickActionRoute('start-lesson', ['tutor'], ORG)).toBe('/start-lesson');
    expect(quickActionRoute('record-session', ['tutor'], ORG)).toBe('/record-lesson');
    expect(quickActionRoute('start-lesson', ['parent'], ORG)).toBeNull();
    expect(quickActionRoute('anything-else', ['tutor'], ORG)).toBeNull();
    expect(quickActionRoute(undefined, ['tutor'], ORG)).toBeNull();
  });

  it('are cleared in a space without Tutoring (Phase 50), even for a kept tutor', () => {
    expect(quickActionItems(['tutor'], ASSESS_ONLY)).toEqual([]);
    expect(quickActionItems(['admin', 'tutor'], null)).toEqual([]);
    expect(quickActionRoute('start-lesson', ['tutor'], ASSESS_ONLY)).toBeNull();
    expect(quickActionRoute('record-session', ['tutor'], ASSESS_ONLY)).toBeNull();
  });
});
