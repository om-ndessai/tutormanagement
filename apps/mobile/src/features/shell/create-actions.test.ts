// The create button's actions follow each screen's own gating (UI upgrades U2): the office adds
// people and records payments, a tutor records, starts and schedules, a family creates nothing.
import { createActions, hasCreateActions } from './create-actions';

const ids = (...args: Parameters<typeof createActions>) => createActions(...args).map((action) => action.id);

test('an admin who does not teach: record, schedule, add people, record a payment -- no Start', () => {
  expect(ids(['admin'], { teaches: false })).toEqual([
    'record-session',
    'schedule-lesson',
    'add-student',
    'add-tutor',
    'add-person',
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
    'add-student',
    'add-tutor',
    'add-person',
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

test('Record opens the Tutoring step flow, never the money; each action routes to a screen that exists', () => {
  const all = createActions(['admin', 'tutor'], { teaches: true });
  const record = all.find((action) => action.id === 'record-session');
  // The record step flow (UI upgrades U4) has no money preview at all; Finance keeps the sheet.
  expect(record?.href).toBe('/record-lesson');
  const paths = all.map((action) => (typeof action.href === 'string' ? action.href : action.href.pathname));
  expect(paths).toEqual([
    '/record-lesson',
    '/start-lesson',
    '/schedule-lesson',
    '/add-student',
    '/add-tutor',
    '/person-form',
    '/payment-form',
  ]);
  // Adding a student or a tutor is a step flow (U3); anyone else is the full person form.
  expect(all.find((action) => action.id === 'add-student')?.href).toBe('/add-student');
  expect(all.find((action) => action.id === 'add-tutor')?.href).toBe('/add-tutor');
  expect(all.find((action) => action.id === 'add-person')?.href).toBe('/person-form');
});
