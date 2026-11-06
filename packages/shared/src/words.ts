// ---------------------------------------------------------------------------
// One word per thing (Phase 78, docs/journey-fixes-plan.md; "space" since Phase 59)
// ---------------------------------------------------------------------------
// What a person reads -- on the web, in the app, in the API's messages, labels and new audit
// descriptions -- uses ONE word for each thing, and both clients read it from here:
//
//   a lesson   never "session" (the sign-in sense too: "You were signed out");
//   a person   people, never "user(s)" (the web's Users page is People, as in the app);
//   a quest    anything played on the board; "game" only in "Play with" and in codes ("game code").
//              A quest is named in words (`gameWords`: "Grade 7 Quick 5"), never "Quest game";
//              "Question Quest" is a proper name and stays;
//   a space    never "organization" (Phase 59).
//
// The CODE keeps its names: the `sessions` and `users` tables, routes, testIDs, query keys,
// audit action KEYS (`session.recorded`), API error CODES and the API's `beta` fields. Old audit
// lines are never rewritten. `scripts/check-ui-words.mjs` (run by `npm run typecheck`) fails on
// the old words in what a person reads; a `ui-words:` comment marks a deliberate exception.

/** One thing's word, in the four forms a sentence needs. */
export interface Term {
  /** "lesson" */
  one: string;
  /** "lessons" */
  many: string;
  /** "Lesson", to start a sentence or a label. */
  One: string;
  /** "Lessons" */
  Many: string;
}

export const TERMS = {
  lesson: { one: 'lesson', many: 'lessons', One: 'Lesson', Many: 'Lessons' },
  person: { one: 'person', many: 'people', One: 'Person', Many: 'People' },
  quest: { one: 'quest', many: 'quests', One: 'Quest', Many: 'Quests' },
  space: { one: 'space', many: 'spaces', One: 'Space', Many: 'Spaces' },
} as const satisfies Record<string, Term>;
export type TermName = keyof typeof TERMS;

/** "1 lesson", "3 lessons", "1 person", "2 people", "0 quests". */
export function countOf(count: number, term: TermName): string {
  const words = TERMS[term];
  return `${count} ${count === 1 ? words.one : words.many}`;
}

/** What the API says, and a client shows, when a sign-in has lapsed (it was "Your session has expired"). */
export const SIGNED_OUT_MESSAGE = 'You were signed out. Please sign in again.';

/**
 * The phrases both clients repeat, worded once. Each replaces what one or both said before
 * (in brackets); the tables and pages they label keep their code names.
 */
export const COMMON_COPY = {
  /** The menu item, the app's tab and the page title ("Sessions"). Its route stays /sessions. */
  lessons_page: 'Lessons',
  /** The menu item and the page title ("Users"). Its route stays /users on the web, /people in the app. */
  people_page: 'People',
  /** The sessions page's filter ("All sessions"). */
  all_lessons: 'All lessons',
  /** The dashboard's section of the last and next lessons ("Tutoring Sessions"). */
  lessons_section: 'Lessons',
  /** The admin's figure of lessons under way ("Sessions running"). */
  lessons_running: 'Lessons running',
  /** A recorded lesson's "what was covered" ("Session notes"). */
  lesson_notes: 'Lesson notes',
  /** A tutor's or a student's longest lesson, on their record ("Longest session"). */
  longest_lesson: 'Longest lesson',
  /** ("Recent sessions") */
  recent_lessons: 'Recent lessons',
  /** ("No sessions recorded yet.") */
  no_lessons_yet: 'No lessons recorded yet.',
  /** ("Schedule a session") */
  schedule_lesson: 'Schedule a lesson',
  /** ("Assess this session") */
  assess_lesson: 'Assess this lesson',
  /** ("Reflect on this session") */
  reflect_on_lesson: 'Reflect on this lesson',
  /** The people page's button ("Add user"; the app said "Add someone"). */
  add_person: 'Add a person',
  /** The record's button ("Edit user"). */
  edit_person: 'Edit details',
  /** ("Search users") */
  search_people: 'Search people',
  /** ("No users match these filters.") */
  nobody_matches: 'Nobody matches these filters.',
  /** ("Go to Users") */
  go_to_people: 'Go to People',
  /** ("Could not save the user.") */
  could_not_save_person: 'Could not save their details.',
} as const;
export type CommonCopyKey = keyof typeof COMMON_COPY;

/**
 * The Space page's note on checked questions (the platform's per-space switch, `checkedQuestionsOn`), for both
 * clients. Since Phase 78 (owner, 2026-11-05) they carry no Beta mark: served like any other, curated by the bank's
 * two-right-answers rule; the tutor's PDF still marks each one "not yet reviewed".
 */
export const CHECKED_QUESTIONS_COPY = {
  included:
    'Included: assessments and quests here also draw questions that passed every automatic check but that no person has approved yet. They are served like any other, and the bank approves them as players answer them right (the tutor’s PDF marks each one “not yet reviewed”). The platform sets this.',
  excluded: 'Not included: assessments and quests here draw approved questions only. The platform sets this.',
} as const;
