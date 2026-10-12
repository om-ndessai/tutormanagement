import { quickActionItems, quickActionRoute } from './quick-actions';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-quick-actions', () => ({
  initial: null,
  setItems: jest.fn(() => Promise.resolve()),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

describe('home-screen quick actions', () => {
  it('are offered only to someone who teaches here, with generic verbs and nothing else', () => {
    expect(quickActionItems(['tutor']).map((item) => item.title)).toEqual([
      'Start a lesson',
      'Record a lesson',
    ]);
    expect(quickActionItems(['admin', 'tutor', 'parent'])).toHaveLength(2);
    for (const roles of [['admin'], ['parent'], ['student'], []] as const) {
      expect(quickActionItems(roles)).toEqual([]);
    }
    expect(quickActionItems(undefined)).toEqual([]);
    // A system surface: no name, no organization, no money -- only the two fixed titles.
    for (const item of quickActionItems(['tutor'])) {
      expect(Object.keys(item).sort()).toEqual(['icon', 'id', 'title']);
      expect(item.title).not.toMatch(/\$|[0-9]/);
    }
  });

  it('lead to their sheet only while the reader still teaches in this organization', () => {
    expect(quickActionRoute('start-lesson', ['tutor'])).toBe('/start-lesson');
    expect(quickActionRoute('record-session', ['tutor'])).toBe('/record-session');
    expect(quickActionRoute('start-lesson', ['parent'])).toBeNull();
    expect(quickActionRoute('anything-else', ['tutor'])).toBeNull();
    expect(quickActionRoute(undefined, ['tutor'])).toBeNull();
  });
});
