// Test fixtures for the member home (Phase 66): one MemberHome per persona of the local seed, trimmed
// from `GET /api/home` (Alex the tutor, Priya the tutor and office, Anita the parent, Sofia the learner,
// Maria the parent, Ines in a space without Tutoring). Tests only.
import type { HomeChild, HomeLesson, MemberHome, TutorHome, TutorHomeLesson } from '@tmi/shared';

export const DAY = '2026-11-03';

export function tutorLesson(overrides: Partial<TutorHomeLesson> = {}): TutorHomeLesson {
  return {
    schedule_id: 'sch-1',
    occurs_on: DAY,
    start_time: '16:00',
    end_time: '17:00',
    mode: 'in_person',
    student_user_id: 'sofia',
    student_name: 'Sofia Okafor',
    place: null,
    lessons_together: 2,
    together_since: '2026-09-08',
    ...overrides,
  };
}

export function homeLesson(overrides: Partial<HomeLesson> = {}): HomeLesson {
  return {
    schedule_id: 'sch-1',
    occurs_on: '2026-11-05',
    start_time: '17:00',
    end_time: '18:00',
    mode: 'in_person',
    student_user_id: 'sofia',
    student_name: 'Sofia Okafor',
    tutor_user_id: 'priya',
    tutor_name: 'Priya Raghavan',
    starts_in: 3000,
    ...overrides,
  };
}

export function child(overrides: Partial<HomeChild> = {}): HomeChild {
  return {
    student_user_id: 'sanjay',
    first_name: 'Sanjay',
    next_lesson: homeLesson({ student_user_id: 'sanjay', student_name: 'Sanjay Patel' }),
    cancelled: null,
    homework: 'Finish the implicit differentiation set.',
    last_lesson_on: '2026-10-29',
    lessons_this_month: 3,
    ...overrides,
  };
}

function now(overrides: Partial<TutorHome> = {}): TutorHome {
  return { part_of_day: 'afternoon', unrecorded: [], next: null, brief: null, ...overrides };
}

const base: Omit<MemberHome, 'first_name' | 'hats'> = {
  day: DAY,
  part_of_day: 'afternoon',
  personal: false,
  may_bring_people: true,
  tutor: null,
  office: null,
  parent: null,
  learner: null,
};

export const ALEX: MemberHome = {
  ...base,
  first_name: 'Alex',
  hats: ['tutor'],
  tutor: {
    now: now({ next: tutorLesson({ occurs_on: '2026-11-07', start_time: '10:00', end_time: '11:00' }) }),
    next_starts_in: 5478,
    lessons_today: 1,
    lessons_this_week: 2,
    to_record: [
      { ...tutorLesson({ schedule_id: 'sch-2', occurs_on: '2026-10-31' }), homework_last: null },
      { ...tutorLesson({ occurs_on: '2026-10-27' }), homework_last: 'pp. 22-23' },
    ],
    to_record_count: 7,
    reviews: { assessments: 5, quest: 0 },
  },
};

export const PRIYA: MemberHome = {
  ...base,
  first_name: 'Priya',
  hats: ['tutor', 'office'],
  tutor: {
    now: now({ next: tutorLesson({ occurs_on: '2026-11-05', start_time: '17:00', end_time: '18:00' }) }),
    next_starts_in: 3018,
    lessons_today: 0,
    lessons_this_week: 1,
    to_record: [],
    to_record_count: 0,
    reviews: { assessments: 0, quest: 0 },
  },
  office: {
    to_record_count: 24,
    to_record: [
      { occurs_on: '2026-11-02', start_time: '17:00', student_name: 'Milo Brooks', tutor_name: 'Imani Shaw' },
      { occurs_on: '2026-11-01', start_time: '10:00', student_name: 'Ava Lin', tutor_name: 'Imani Shaw' },
    ],
    join_requests: 0,
    invitations: 2,
    lessons_today: 6,
    lessons_this_week: 26,
  },
};

export const ANITA: MemberHome = {
  ...base,
  first_name: 'Anita',
  hats: ['parent'],
  parent: { children: [child()] },
};

export const SOFIA: MemberHome = {
  ...base,
  first_name: 'Sofia',
  hats: ['learner'],
  learner: {
    next_lesson: homeLesson({ occurs_on: '2026-11-10', start_time: '16:00', tutor_name: 'Alex Chen' }),
    assessment_in_progress: null,
    assessment_reviewed: null,
  },
};

export const MARIA: MemberHome = {
  ...base,
  first_name: 'Maria',
  hats: ['parent'],
  parent: {
    children: [
      child({
        student_user_id: 'sofia',
        first_name: 'Sofia',
        next_lesson: homeLesson({ occurs_on: '2026-11-10', start_time: '16:00', tutor_name: 'Alex Chen' }),
        homework: null,
        lessons_this_month: 1,
      }),
    ],
  },
};

export const INES: MemberHome = {
  ...base,
  first_name: 'Ines',
  hats: ['learner', 'office', 'parent'],
  office: { to_record_count: 0, to_record: [], join_requests: 0, invitations: 0, lessons_today: 0, lessons_this_week: 0 },
  parent: {
    children: [
      child({ student_user_id: 'noor', first_name: 'Noor', next_lesson: null, homework: null, lessons_this_month: 0 }),
    ],
  },
  learner: { next_lesson: null, assessment_in_progress: null, assessment_reviewed: null },
};
