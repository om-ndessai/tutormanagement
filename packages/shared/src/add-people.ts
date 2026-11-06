import type { UserRole } from './users.js';

// ---------------------------------------------------------------------------
// Adding people one way (Phase 76, JF21, docs/journey-fixes-plan.md)
// ---------------------------------------------------------------------------
// One "Add" chooser on both clients -- opened by the home's quick action, the
// People header and the app's (+) -- and, after each save, the next step. The
// choices and their words live here so the web and the app cannot drift.

export const ADD_CHOICES = ['family', 'tutor', 'someone', 'invite'] as const;
export type AddChoice = (typeof ADD_CHOICES)[number];

export interface AddChoiceOption {
  id: AddChoice;
  label: string;
  description: string;
}

/**
 * The chooser's choices, first to last: "A family (parent and child)" -- in a personal space "My
 * child", where the signed-in adult is the parent -- then "A tutor" where Tutoring is on, "Someone
 * else" and "Invite by email". Nothing for a reader who may not add people (not an admin, or a teen,
 * Phase 63).
 */
export function addChoices(input: { tutoring: boolean; personal: boolean; mayAdd: boolean }): AddChoiceOption[] {
  if (!input.mayAdd) return [];
  const out: AddChoiceOption[] = [
    input.personal
      ? { id: 'family', label: 'My child', description: 'Add your child: you are their parent.' }
      : { id: 'family', label: 'A family (parent and child)', description: 'A parent and their child, added together.' },
  ];
  if (input.tutoring) out.push({ id: 'tutor', label: 'A tutor', description: 'Someone who teaches here.' });
  out.push(
    { id: 'someone', label: 'Someone else', description: 'Another adult, or a student whose parent is already here.' },
    { id: 'invite', label: 'Invite by email', description: 'They join when they sign in with that address.' },
  );
  return out;
}

export const NEXT_STEPS_AFTER_ADD = ['pair_tutor', 'weekly_lesson', 'assessment', 'pair_student', 'tax_setup'] as const;
export type NextStepAfterAddId = (typeof NEXT_STEPS_AFTER_ADD)[number];

export interface NextStepAfterAdd {
  id: NextStepAfterAddId;
  label: string;
}

/**
 * What to do next with someone just added, in order: for a student "Pair <first name> with a tutor"
 * and "Set a weekly lesson" (Tutoring only) and "Record an assessment" (where Tutoring or Assessment is on); for a
 * tutor "Pair <first name> with a student" and, where the space pays its tutors (it is not paid
 * directly), "Finish tax setup". Someone with both roles gets both lists; anyone else none.
 */
export function nextStepsAfterAdd(
  person: { full_name: string; roles: readonly UserRole[] },
  space: { tutoring: boolean; assessment: boolean; paysTutors: boolean },
): NextStepAfterAdd[] {
  const first = person.full_name.trim().split(/\s+/)[0] || person.full_name;
  const out: NextStepAfterAdd[] = [];
  if (person.roles.includes('student')) {
    if (space.tutoring) {
      out.push({ id: 'pair_tutor', label: `Pair ${first} with a tutor` }, { id: 'weekly_lesson', label: 'Set a weekly lesson' });
    }
    // Where Tutoring is on it is the progress assessment; where Assessment is on, the handwritten one (each client
    // opens the one the space has).
    if (space.assessment || space.tutoring) out.push({ id: 'assessment', label: 'Record an assessment' });
  }
  if (person.roles.includes('tutor') && space.tutoring) {
    out.push({ id: 'pair_student', label: `Pair ${first} with a student` });
    if (space.paysTutors) out.push({ id: 'tax_setup', label: 'Finish tax setup' });
  }
  return out;
}
