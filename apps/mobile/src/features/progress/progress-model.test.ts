import {
  pickerLevels,
  topicsByUnit,
  type CurriculumLevel,
  type ProgressOverview,
  type ProgressStatus,
} from '@tmi/shared';

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
  // As the API sends it: levels, and topics within them, in teaching order. That order is the
  // catalog position the tie-break uses, never a number read off the id.
  const levels = [
    {
      id: 'BA3',
      topics: [
        { id: 'BA3.02', level_id: 'BA3', number: 2 },
        { id: 'BA3.10', level_id: 'BA3', number: 10 },
      ],
    },
    {
      id: 'BA4',
      topics: [
        { id: 'BA4.05', level_id: 'BA4', number: 5 },
        { id: 'BA4.08', level_id: 'BA4', number: 8 },
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

// Phase 35: the shared helpers the pickers use on the device.
describe('pickerLevels and topicsByUnit', () => {
  const topic = (id: string, level_id: string, unit: string | null) => ({
    id,
    code: id,
    level_id,
    number: 1,
    unit,
    name: id,
    description: null,
  });
  const levels = [
    { id: 'NC17.3', curriculum_id: 'nc-2017', retired: false, topics: [topic('NC17.3.OA.1', 'NC17.3', 'OA')] },
    { id: 'NC26.3', curriculum_id: 'nc-2026', retired: false, topics: [topic('NC26.3.ANR.1', 'NC26.3', 'ANR')] },
    { id: 'BA4', curriculum_id: 'ba', retired: true, topics: [topic('BA4.05', 'BA4', '4B')] },
    { id: 'BA5', curriculum_id: 'ba', retired: true, topics: [topic('BA5.02', 'BA5', '5A')] },
  ] as unknown as CurriculumLevel[];

  it('hides a retired curriculum unless something chosen is in it', () => {
    expect(pickerLevels(levels).map((level) => level.id)).toEqual(['NC17.3', 'NC26.3']);
    expect(pickerLevels(levels, ['BA4.05']).map((level) => level.id)).toEqual(['NC17.3', 'NC26.3', 'BA4']);
    expect(pickerLevels(levels, ['BA5']).map((level) => level.id)).toEqual(['NC17.3', 'NC26.3', 'BA5']);
    expect(pickerLevels(levels, [], 'nc-2026').map((level) => level.id)).toEqual(['NC26.3']);
  });

  it('groups a level’s topics in runs of one unit, keeping their order', () => {
    const topics = [topic('a', 'L', 'OA'), topic('b', 'L', 'OA'), topic('c', 'L', 'NBT'), topic('d', 'L', null)];
    expect(topicsByUnit(topics).map((group) => [group.unit, group.topics.map((t) => t.id)])).toEqual([
      ['OA', ['a', 'b']],
      ['NBT', ['c']],
      [null, ['d']],
    ]);
  });
});
