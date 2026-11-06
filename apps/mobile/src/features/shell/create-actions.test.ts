// The create button's actions follow each screen's own gating (UI upgrades U2): the office adds
// people and records payments, a tutor records, starts and schedules, a family creates nothing.
import { createActions, hasCreateActions } from './create-actions';

const ids = (...args: Parameters<typeof createActions>) => createActions(...args).map((action) => action.id);

test('an admin who does not teach: record, schedule, add people, record a payment -- no Start', () => {
  expect(ids(['admin'], { teaches: false })).toEqual([
    'record-session',
    'schedule-lesson',
    'add-people',
    'record-payment',
  ]);
});

test('a tutor with students of their own: record, start, schedule', () => {
  expect(ids(['tutor'], { teaches: true })).toEqual(['record-session', 'start-lesson', 'schedule-lesson']);
});

test('Start waits for students of their own, and is gone while a lesson runs', () => {
  expect(ids(['tutor'], { teaches: false })).toEqual(['record-session', 'schedule-lesson']);
  expect(ids(['tutor'], { teaches: true, lessonRunning: true })).toEqual(['record-session', 'schedule-lesson']);
  // Nothing known yet: no Start.
  expect(ids(['tutor'])).toEqual(['record-session', 'schedule-lesson']);
});

test('an admin who also tutors gets everything', () => {
  expect(ids(['admin', 'tutor'], { teaches: true })).toEqual([
    'record-session',
    'start-lesson',
    'schedule-lesson',
    'add-people',
    'record-payment',
  ]);
});

test('a parent who also tutors gets the tutor actions only', () => {
  expect(ids(['parent', 'tutor'], { teaches: true })).toEqual([
    'record-session',
    'start-lesson',
    'schedule-lesson',
  ]);
});

test('a parent, a student, or nobody: no actions, so no create button', () => {
  for (const roles of [['parent'], ['student'], ['parent', 'student'], [], undefined] as const) {
    expect(ids(roles, { teaches: true })).toEqual([]);
    expect(hasCreateActions(roles)).toBe(false);
  }
  expect(hasCreateActions(['tutor'])).toBe(true);
  expect(hasCreateActions(['admin'])).toBe(true);
});

test('Record opens the lessons still owed, never the money; each action routes to a screen that exists', () => {
  const all = createActions(['admin', 'tutor'], { teaches: true });
  const record = all.find((action) => action.id === 'record-session');
  // Phase 75 (JF30): the lessons owed first; "Another lesson" there is the record step flow (U4), with no money.
  expect(record?.href).toBe('/lessons-owed');
  const paths = all.map((action) => (typeof action.href === 'string' ? action.href : action.href.pathname));
  expect(paths).toEqual(['/lessons-owed', '/start-lesson', '/schedule-lesson', '/add', '/payment-form']);
});

describe('Phase 76 (JF21): one Add chooser', () => {
  test('one "Add a person" row, opening the chooser -- never three separate add rows', () => {
    const all = createActions(['admin'], {});
    const add = all.filter((action) => action.id.startsWith('add-'));
    expect(add).toHaveLength(1);
    // Phase 78 (JF32): the home's quick action's words, from shared QUICK_ACTION_LABELS.
    expect(add[0]).toMatchObject({ id: 'add-people', title: 'Add a person', href: '/add' });
  });

  test('in a personal space it reads "Add my child"', () => {
    const all = createActions(['admin'], { personal: true }, { tutoring: false, assessment: true });
    expect(all.find((action) => action.id === 'add-people')).toMatchObject({ title: 'Add my child', href: '/add' });
    expect(createActions(['admin'], {}).find((action) => action.id === 'add-people')?.title).toBe('Add a person');
  });
});

describe('Phase 50: without Tutoring', () => {
  const ASSESS = { tutoring: false, assessment: true };
  const NONE = { tutoring: false, assessment: false };

  test('an admin starts an assessment, or adds people', () => {
    expect(ids(['admin'], { teaches: true }, ASSESS)).toEqual(['start-assessment', 'add-people']);
    expect(ids(['admin', 'tutor'], { teaches: true }, ASSESS)).toEqual(['start-assessment', 'add-people']);
  });

  test('without Assessment as well, only adding people', () => {
    expect(ids(['admin'], {}, NONE)).toEqual(['add-people']);
  });

  test('a parent, a student and a kept tutor get none', () => {
    for (const roles of [['parent'], ['student'], ['tutor']] as const) {
      expect(ids([...roles], { teaches: true }, ASSESS)).toEqual([]);
      expect(hasCreateActions([...roles], ASSESS)).toBe(false);
    }
  });

  test('hasCreateActions agrees with createActions', () => {
    for (const sets of [ASSESS, NONE, { tutoring: true, assessment: true }]) {
      for (const roles of [['admin'], ['tutor'], ['parent'], ['student'], ['admin', 'parent']] as const) {
        expect(hasCreateActions([...roles], sets)).toBe(ids([...roles], { teaches: true }, sets).length > 0);
      }
    }
  });

  test('Start an assessment is never offered with Tutoring on', () => {
    expect(ids(['admin'], { teaches: true }, { tutoring: true, assessment: true })).not.toContain(
      'start-assessment',
    );
  });
});

describe('UI audit (JF22): one rule for adding people', () => {
  const TEEN = { age_band: '13-17' } as const;
  const ADULT = { age_band: 'adult' } as const;

  test('a 13-17 admin is offered no add action, with Tutoring or without; the rest stays', () => {
    expect(ids(['admin'], { teaches: false, account: TEEN })).toEqual(['record-session', 'schedule-lesson', 'record-payment']);
    expect(ids(['admin'], { account: TEEN }, { tutoring: false, assessment: true })).toEqual(['start-assessment']);
  });

  test('an adult admin, or one a space added (no account), adds people as before', () => {
    for (const account of [ADULT, null, undefined]) {
      expect(ids(['admin'], { account }, { tutoring: false, assessment: true })).toEqual(['start-assessment', 'add-people']);
    }
  });

  test('nobody else adds people, whatever their account', () => {
    for (const roles of [['tutor'], ['parent'], ['student'], ['parent', 'tutor']] as const) {
      const offered = ids([...roles], { teaches: true, account: ADULT });
      expect(offered).not.toContain('add-people');
    }
  });

  test('a teen admin without Assessment has no create button at all', () => {
    expect(hasCreateActions(['admin'], { tutoring: false, assessment: false }, TEEN)).toBe(false);
    expect(hasCreateActions(['admin'], { tutoring: false, assessment: false }, ADULT)).toBe(true);
  });
});

describe('UI audit (JF7): Start a space where a teacher looks', () => {
  test('an adult’s list ends with Start a space, opening Spaces on the new space’s name', () => {
    const all = createActions(['admin'], { mayMakeSpace: true }, { tutoring: false, assessment: true });
    expect(all.map((action) => action.id)).toEqual(['start-assessment', 'add-people', 'start-space']);
    const start = all.at(-1);
    expect(start).toMatchObject({ title: 'Start a space' });
    expect(start?.href).toEqual({ pathname: '/spaces', params: { start: '1' } });
    expect(ids(['tutor'], { teaches: true, mayMakeSpace: true })).toEqual([
      'record-session',
      'start-lesson',
      'schedule-lesson',
      'start-space',
    ]);
  });

  test('never for someone who may not start one (a 13-17, a student a space added)', () => {
    expect(ids(['admin'], { account: { age_band: '13-17' }, mayMakeSpace: false })).not.toContain('start-space');
    expect(ids(['admin'])).not.toContain('start-space');
  });

  test('never a (+) of its own: a reader who creates nothing here gets none', () => {
    for (const roles of [['parent'], ['student'], []] as const) {
      expect(ids([...roles], { mayMakeSpace: true })).toEqual([]);
      expect(hasCreateActions([...roles])).toBe(false);
    }
  });
});
