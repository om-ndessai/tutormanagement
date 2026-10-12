import type { CurriculumLevel, ProgressOverview, ProgressStatus } from '@tmi/shared';

import { studentProgress } from '@/test/fixtures';
import {
  aYearOn,
  filterOverview,
  lessonRows,
  moveTopic,
  overviewLine,
  statusCounts,
  toggleTopic,
  tutorsFromPairings,
  weakestTopics,
} from './progress-model';

function row(name: string, status: ProgressStatus, id = name): ProgressOverview {
  return {
    student_user_id: id,
    student_name: name,
    goal: null,
    starts_on: null,
    target_on: null,
    last_assessed_on: null,
    summary: { ...studentProgress.summary, status },
  };
}

const rows = [
  row('Zed', 'ahead'),
  row('Ben', 'behind'),
  row('Amy', 'on_track'),
  row('Cal', 'behind'),
  row('Dee', 'no_plan'),
];
const none = { search: '', status: 'all' as const, student: 'all', tutorStudents: null };

describe('filterOverview', () => {
  it('puts trouble first, then orders by name', () => {
    expect(filterOverview(rows, none).map((r) => r.student_name)).toEqual([
      'Ben',
      'Cal',
      'Dee',
      'Amy',
      'Zed',
    ]);
  });

  it('narrows by status, student, tutor and search, never widening', () => {
    expect(filterOverview(rows, { ...none, status: 'behind' }).map((r) => r.student_name)).toEqual([
      'Ben',
      'Cal',
    ]);
    expect(filterOverview(rows, { ...none, student: 'Amy' }).map((r) => r.student_name)).toEqual(['Amy']);
    expect(
      filterOverview(rows, { ...none, tutorStudents: new Set(['Zed', 'Nobody']) }).map((r) => r.student_name),
    ).toEqual(['Zed']);
    expect(filterOverview(rows, { ...none, search: ' ca ' }).map((r) => r.student_name)).toEqual(['Cal']);
    expect(filterOverview(rows, { ...none, student: 'someone-not-listed' })).toEqual([]);
  });

  it('counts the students at each status', () => {
    const counts = statusCounts(rows);
    expect(counts.get('behind')).toBe(2);
    expect(counts.has('achieved')).toBe(false);
  });
});

it('lists tutors by name with their students', () => {
  const tutors = tutorsFromPairings([
    { tutor_user_id: 't2', tutor_name: 'Priya', student_user_id: 's1' },
    { tutor_user_id: 't1', tutor_name: 'Alex', student_user_id: 's1' },
    { tutor_user_id: 't1', tutor_name: 'Alex', student_user_id: 's2' },
  ]);
  expect(tutors.map((t) => t.name)).toEqual(['Alex', 'Priya']);
  expect([...tutors[0]!.students]).toEqual(['s1', 's2']);
});

it('words the line under a name', () => {
  expect(overviewLine({ ...row('A', 'on_track'), goal: 'Ready for PRE', target_on: '2027-06-15' })).toBe(
    'Ready for PRE · by Jun 15, 2027',
  );
  expect(overviewLine({ ...row('A', 'no_plan'), last_assessed_on: '2026-09-02' })).toBe(
    'Assessed Sep 2, 2026 · no plan yet',
  );
  expect(overviewLine(row('A', 'no_plan'))).toBe('Not assessed yet');
});

describe('a new plan', () => {
  const levels = [
    {
      id: 'BA4',
      stage: 4,
      topics: [
        { id: 'BA4.05', number: 5 },
        { id: 'BA4.08', number: 8 },
      ],
    },
    {
      id: 'BA3',
      stage: 3,
      topics: [
        { id: 'BA3.10', number: 10 },
        { id: 'BA3.02', number: 2 },
      ],
    },
  ] as unknown as CurriculumLevel[];

  it('pre-selects the topics the assessment scored 3 or below, weakest first, then in catalog order', () => {
    const assessment = {
      ratings: [
        { topic_id: 'BA4.08', rating: 2 as const },
        { topic_id: 'BA4.05', rating: 4 as const },
        { topic_id: 'BA3.10', rating: 2 as const },
        { topic_id: 'BA3.02', rating: 3 as const },
      ],
    };
    expect(weakestTopics(assessment, levels)).toEqual(['BA3.10', 'BA4.08', 'BA3.02']);
    expect(weakestTopics(null, levels)).toEqual([]);
  });

  it('defaults its goal date to a year on', () => {
    expect(aYearOn('2026-10-08')).toBe('2027-10-08');
  });

  it('reorders and toggles topics in teaching order', () => {
    expect(moveTopic(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveTopic(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(toggleTopic(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleTopic(['a', 'b'], 'a')).toEqual(['b']);
  });
});

it('lists lessons newest first with cancelled ones in place', () => {
  const lessons = [
    { ...studentProgress.timeline[0]!, session_id: 'old', occurred_on: '2026-09-08' },
    { ...studentProgress.timeline[0]!, session_id: 'new', occurred_on: '2026-09-29' },
  ];
  const cancelled = [
    {
      schedule_id: 's',
      occurs_on: '2026-09-15',
      start_time: '16:00',
      tutor_name: 'Alex Chen',
      cancelled_as: 'parent' as const,
      note: null,
      cancelled_by_name: null,
    },
  ];
  expect(lessonRows(lessons, cancelled).map((r) => r.day)).toEqual([
    '2026-09-29',
    '2026-09-15',
    '2026-09-08',
  ]);
});
