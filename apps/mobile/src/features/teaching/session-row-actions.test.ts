import { session } from '@/test/fixtures';
import { sessionCardLabel } from './session-card';
import { sessionRowActions, sessionRowVerbs } from './session-row-actions';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/toast', () => ({ useToast: () => ({}) }));
jest.mock('./api', () => ({ useDeleteSession: () => ({ mutate: jest.fn(), isPending: false }) }));

const lesson = session({ assessments: [], reflection: null, write_up: null } as never);
const admin = { id: 'admin-1', roles: ['admin' as const] };
const ownTutor = { id: 'tutor-1', roles: ['tutor' as const] };
const otherTutor = { id: 'tutor-2', roles: ['tutor' as const] };
const parent = { id: 'parent-1', roles: ['parent' as const] };

describe('a lesson card’s verbs', () => {
  it('give Edit and Delete to the office and the lesson’s own tutor only, as the API does', () => {
    expect(sessionRowVerbs(lesson, admin)).toMatchObject({ edit: true, delete: true });
    expect(sessionRowVerbs(lesson, ownTutor)).toMatchObject({ edit: true, delete: true });
    expect(sessionRowVerbs(lesson, otherTutor)).toMatchObject({ edit: false, delete: false });
    expect(sessionRowVerbs(lesson, parent)).toMatchObject({ edit: false, delete: false });
    expect(sessionRowVerbs(lesson, null)).toMatchObject({ edit: false, delete: false, assess: null });
  });

  it('lists Delete last, as the destructive one, and runs the confirm it is given', () => {
    const onDelete = jest.fn();
    const actions = sessionRowActions(lesson, ownTutor, { showMoney: false, onDelete });
    expect(actions.map((a) => a.key)).toEqual(['assess', 'reflect', 'edit', 'delete']);
    expect(actions.at(-1)?.destructive).toBe(true);
    actions.at(-1)?.onPress();
    expect(onDelete).toHaveBeenCalledWith(lesson);
  });

  it('give the lesson’s own student no Assess and nothing to edit', () => {
    const student = { id: 'student-1', roles: ['student' as const] };
    const keys = sessionRowActions(lesson, student, { showMoney: false, onDelete: jest.fn() }).map(
      (a) => a.key,
    );
    expect(keys).not.toContain('assess');
    expect(keys).not.toContain('edit');
    expect(keys).not.toContain('delete');
  });
});

describe('the card’s spoken label', () => {
  it('names the lesson and its write-up, and never money', () => {
    const label = sessionCardLabel(lesson, 'Tue Oct 6');
    expect(label).toContain('Lesson with Sofia Okafor, with Alex Chen');
    expect(label).toContain('Fractions and word problems.');
    expect(label).not.toContain('$');
  });
});
