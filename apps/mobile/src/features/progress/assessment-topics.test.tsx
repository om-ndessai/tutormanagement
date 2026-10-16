// The assessment's topics (UI upgrades U5): the plan's first, every level closed until opened, a
// five-step pill per topic whose word shows once chosen, and a second tap clearing it. With Phase
// 34 (the catalog's code, a level from the row) and Phase 35 (the curriculum switch only for two or
// more, unit headings, descriptions, retired levels hidden unless something rated is in them).
import type { Curriculum, CurriculumLevel, Rating } from '@tmi/shared';
import { TOPIC_RATING_LABELS } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithProviders } from '@/test/render';
import { AssessmentTopicsEditor } from './topic-pickers';

const mockCurricula = jest.fn<{ data?: { data: Curriculum[] } }, []>(() => ({ data: undefined }));
jest.mock('./api', () => ({ useCurricula: () => mockCurricula() }));

type TopicRow = [id: string, name: string, extra?: { code?: string; unit?: string; description?: string }];

function level(
  id: string,
  name: string,
  topics: TopicRow[],
  { curriculum = 'ba', retired = false, code = id }: { curriculum?: string; retired?: boolean; code?: string } = {},
): CurriculumLevel {
  return {
    id,
    code,
    curriculum_id: curriculum,
    name,
    grade_band: null,
    description: null,
    retired,
    topics: topics.map(([topicId, topicName, extra], index) => ({
      id: topicId,
      code: extra?.code ?? topicId,
      level_id: id,
      number: index + 1,
      unit: extra?.unit ?? null,
      name: topicName,
      description: extra?.description ?? null,
    })),
  };
}

function curriculum(id: string, name: string, retired = false): Curriculum {
  return { id, name, source: null, edition: null, description: null, source_url: null, is_default: false, retired };
}

const LEVELS = [
  level('BA3', 'Beast Academy Level 3', [
    ['BA3.01', 'Shapes'],
    ['BA3.02', 'Counting'],
  ]),
  level('BA4', 'Beast Academy Level 4', [['BA4.01', 'Multiplication']]),
];

const latest = { ratings: new Map<string, Rating>() };
function Harness({
  planned,
  levels = LEVELS,
  initial = new Map<string, Rating>(),
}: {
  planned: string[];
  levels?: CurriculumLevel[];
  initial?: Map<string, Rating>;
}) {
  const [ratings, setRatings] = useState(initial);
  const change = (next: Map<string, Rating>) => {
    latest.ratings = next;
    setRatings(next);
  };
  return <AssessmentTopicsEditor levels={levels} ratings={ratings} onChange={change} plannedIds={planned} />;
}

beforeEach(() => mockCurricula.mockReturnValue({ data: undefined }));

it('puts the plan’s topics first, and keeps the levels closed until opened', async () => {
  await renderWithProviders(<Harness planned={['BA3.02']} />);
  expect(screen.getByTestId('assessment-planned')).toBeTruthy();
  expect(screen.getByTestId('assessment-topic-BA3.02-1')).toBeTruthy();
  // Closed: no pills for the rest yet, and the planned topic is not offered twice.
  expect(screen.queryByTestId('assessment-topic-BA3.01-1')).toBeNull();
  await fireEvent.press(screen.getByTestId('assessment-group-BA3'));
  expect(screen.getByTestId('assessment-topic-BA3.01-1')).toBeTruthy();
  expect(screen.getAllByTestId('assessment-topic-BA3.02-1')).toHaveLength(1);
  expect(screen.queryByTestId('assessment-topic-BA4.01-1')).toBeNull();
});

it('shows the chosen step’s word, counts it on its level, and clears it on a second tap', async () => {
  await renderWithProviders(<Harness planned={[]} />);
  expect(screen.getByTestId('assessment-no-plan')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('assessment-group-BA4'));
  await fireEvent.press(screen.getByTestId('assessment-topic-BA4.01-2'));
  expect(screen.getByTestId('assessment-topic-BA4.01-word')).toHaveTextContent(TOPIC_RATING_LABELS[2]);
  expect(latest.ratings.get('BA4.01')).toBe(2);
  // Closing the level keeps the score, and its header says so.
  await fireEvent.press(screen.getByTestId('assessment-group-BA4'));
  expect(screen.getByLabelText('Beast Academy Level 4, 1 rated')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('assessment-group-BA4'));
  await fireEvent.press(screen.getByTestId('assessment-topic-BA4.01-2'));
  expect(latest.ratings.has('BA4.01')).toBe(false);
  expect(screen.queryByTestId('assessment-topic-BA4.01-word')).toBeNull();
});

describe('several curricula (Phases 34 and 35)', () => {
  const NC = [
    level(
      'NC17.3',
      'Grade 3',
      [
        ['NC17.3.OA.1', 'Interpret products', { code: '3.OA.1', unit: 'OA', description: 'Groups of objects' }],
        ['NC17.3.NBT.2', 'Add within 1000', { code: '3.NBT.2', unit: 'NBT' }],
      ],
      { curriculum: 'nc-2017', code: 'Grade 3' },
    ),
    level('NC26.3', 'Grade 3 (2026)', [['NC26.3.ANR.1', 'Represent numbers', { code: '3.ANR.1', unit: 'ANR' }]], {
      curriculum: 'nc-2026',
    }),
    level('BA4', 'Beast Academy Level 4', [['BA4.01', 'Multiplication']], { retired: true }),
  ];

  it('prints the code, groups an opened level by unit with descriptions, and hides a retired level', async () => {
    await renderWithProviders(<Harness planned={['NC17.3.NBT.2']} levels={NC} />);
    // The plan's topic by its code, never its id.
    expect(screen.getAllByText(/3\.NBT\.2/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/NC17\.3\.NBT\.2/)).toBeNull();
    // No switch while only one curriculum is offered (none answered here).
    expect(screen.queryByTestId('assessment-curriculum-nc-2017')).toBeNull();
    // Retired Beast Academy holds nothing rated, so it is not offered.
    expect(screen.queryByTestId('assessment-group-BA4')).toBeNull();
    await fireEvent.press(screen.getByTestId('assessment-group-NC17.3'));
    expect(screen.getByText('OA')).toBeTruthy();
    expect(screen.getByText('Groups of objects')).toBeTruthy();
    expect(screen.getByTestId('assessment-topic-NC17.3.OA.1-1')).toBeTruthy();
  });

  it('switches curricula when two or more are offered, and keeps a retired level holding a score', async () => {
    mockCurricula.mockReturnValue({
      data: {
        data: [curriculum('nc-2017', 'NC Math 2017'), curriculum('nc-2026', 'NC Math 2026'), curriculum('ba', 'Beast Academy', true)],
      },
    });
    await renderWithProviders(
      <Harness planned={[]} levels={NC} initial={new Map<string, Rating>([['BA4.01', 3]])} />,
    );
    // It opens on the curriculum of what is already rated: retired Beast Academy, kept for its score.
    expect(screen.getByTestId('assessment-curriculum-ba')).toBeTruthy();
    expect(screen.getByLabelText('Beast Academy Level 4, 1 rated')).toBeTruthy();
    expect(screen.queryByTestId('assessment-group-NC17.3')).toBeNull();
    await fireEvent.press(screen.getByTestId('assessment-curriculum-nc-2026'));
    expect(screen.getByTestId('assessment-group-NC26.3')).toBeTruthy();
    expect(screen.queryByTestId('assessment-group-BA4')).toBeNull();
  });
});
