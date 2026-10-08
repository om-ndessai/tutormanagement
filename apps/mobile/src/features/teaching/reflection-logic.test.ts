import type { SessionReflection } from '@tmi/shared';

import { session } from '@/test/fixtures';
import { firstName, likelyReflectorRole, mayChangeReflection } from './reflection-logic';

const student = { id: 'student-1' };
const tutor = { id: 'tutor-1' };
const parent = { id: 'parent-1' };
const stranger = { id: 'someone-else' };

function reflection(entered_as: SessionReflection['entered_as']): SessionReflection {
  return {
    session_id: 's1',
    learned_new: 4,
    difficulty: 3,
    understanding: 4,
    pace: 3,
    homework_notes: null,
    comment: null,
    entered_by_user_id: null,
    entered_by_name: null,
    entered_as,
    created_at: '2026-10-06T21:00:00Z',
  } as SessionReflection;
}

describe('who a reflection is typed by', () => {
  it('infers the capacity from the row, as the API does', () => {
    expect(likelyReflectorRole(session({ money_view: 'family' }), student)).toBe('student');
    expect(likelyReflectorRole(session({ money_view: 'tutor' }), tutor)).toBe('tutor');
    expect(likelyReflectorRole(session({ money_view: 'family' }), parent)).toBe('parent');
    expect(likelyReflectorRole(session({ money_view: 'admin' }), stranger)).toBeNull();
  });

  it('lets anybody who may enter one change it while no student has', () => {
    expect(mayChangeReflection(session({ money_view: 'family' }), parent)).toBe(true);
    expect(mayChangeReflection(session({ reflection: reflection('parent') }), tutor)).toBe(true);
    expect(mayChangeReflection(session({ money_view: 'admin' }), stranger)).toBe(false);
    expect(mayChangeReflection(session(), null)).toBe(false);
  });

  it("never lets an adult overwrite the student's own", () => {
    const own = session({ money_view: 'family', reflection: reflection('student') });
    expect(mayChangeReflection(own, parent)).toBe(false);
    expect(mayChangeReflection({ ...own, money_view: 'tutor' }, tutor)).toBe(false);
    expect(mayChangeReflection(own, student)).toBe(true);
  });

  it('addresses an adult by the first name', () => {
    expect(firstName('Sofia Okafor')).toBe('Sofia');
  });
});
