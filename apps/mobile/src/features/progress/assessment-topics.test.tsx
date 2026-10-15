// The assessment's topics (UI upgrades U5): the plan's first, every level closed until opened, a
// five-step pill per topic whose word shows once chosen, and a second tap clearing it.
import type { CurriculumLevel, Rating } from '@tmi/shared';
import { TOPIC_RATING_LABELS } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithProviders } from '@/test/render';
import { AssessmentTopicsEditor } from './topic-pickers';

function level(id: string, name: string, topics: [string, string][]): CurriculumLevel {
  return {
    id,
    program: 'beast_academy' as CurriculumLevel['program'],
    name,
    stage: 1,
    grade_band: null,
    description: null,
    topics: topics.map(([topicId, topicName]) => ({ id: topicId, name: topicName }) as CurriculumLevel['topics'][number]),
  };
}

const LEVELS = [
  level('BA3', 'Beast Academy Level 3', [
    ['BA3.01', 'Shapes'],
    ['BA3.02', 'Counting'],
  ]),
  level('BA4', 'Beast Academy Level 4', [['BA4.01', 'Multiplication']]),
];

const latest = { ratings: new Map<string, Rating>() };
function Harness({ planned }: { planned: string[] }) {
  const [ratings, setRatings] = useState(new Map<string, Rating>());
  const change = (next: Map<string, Rating>) => {
    latest.ratings = next;
    setRatings(next);
  };
  return <AssessmentTopicsEditor levels={LEVELS} ratings={ratings} onChange={change} plannedIds={planned} />;
}

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
