// Phase 64 (P19): the Daily screen, with the api client mocked at the network edge -- the questions come
// without keys, one at a time (a choice chosen then Submit, a number typed, or Skip); the answers go to
// the server ONCE, at the end, in order (a skip is null); the result names the Daily, draws the grid and
// shares the shared words through the share sheet; a played Daily opens on its result; a Daily the
// console has off (403) or a level this space does not offer (404) is the calm line; a refused save
// (409) reads the Daily again.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { DailyQuestion, DailySet } from '@tmi/shared';
import { Share } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { DailyScreen } from './daily-screen';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
  },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: () => mockBack(),
    canGoBack: () => true,
    dismissTo: jest.fn(),
  },
}));

// The page cannot draw under Jest: the choices as plain rows, with the ids the screen gives them.
jest.mock('@/features/quest/quest-choices', () => ({
  QuestChoices: ({
    choices,
    onChoose,
    testIDFor,
  }: {
    choices: string[];
    onChoose: (index: number) => void;
    testIDFor: (index: number) => string;
  }) => {
    const { Pressable: MockPressable, Text: MockText } = jest.requireActual('react-native');
    return choices.map((choice, index) => (
      <MockPressable key={index} testID={testIDFor(index)} onPress={() => onChoose(index)}>
        <MockText>{choice}</MockText>
      </MockPressable>
    ));
  },
}));

const choice = (id: string): DailyQuestion => ({ id, kind: 'choice', stem: `Pick ${id}`, choices: ['1', '2', '3', '4'], beta: false });
const numeric = (id: string): DailyQuestion => ({ id, kind: 'numeric', stem: `Type ${id}`, choices: [], beta: true });
const SET: DailySet = {
  day: '2026-11-01',
  number: 1,
  level_id: 'NC26.4',
  questions: [choice('q1'), numeric('q2'), choice('q3'), choice('q4'), choice('q5')],
  result: null,
};
const PLAYED: DailySet = {
  ...SET,
  questions: SET.questions.map((q) => ({ ...q, answer: '2', solution: 'Because.' })),
  result: { right: 2, of: 5, seconds: 133, marks: [true, true, false, false, false] },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DailyScreen (Phase 64)', () => {
  it('plays one question at a time and posts the answers once, at the end', async () => {
    mockGet.mockResolvedValue({ data: SET });
    mockPost.mockResolvedValue({ data: PLAYED });
    await renderWithProviders(<DailyScreen level="NC26.4" />);
    expect(await screen.findByTestId('daily-play')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/quest/daily/NC26.4');
    expect(screen.getByTestId('daily-progress')).toHaveTextContent('Grade 4 · question 1 of 5');

    // A choice is chosen, then Submit.
    expect(screen.getByTestId('daily-submit').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('daily-choice-1'));
    await fireEvent.press(screen.getByTestId('daily-submit'));
    // A number question: a checked one (`beta`) carries no mark (Phase 78, owner 2026-11-05).
    expect(screen.getByTestId('daily-progress')).toHaveTextContent('Grade 4 · question 2 of 5');
    expect(screen.queryByTestId('daily-question-beta')).toBeNull();
    expect(screen.queryByText('Beta')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('daily-number'), ' 12 ');
    await fireEvent.press(screen.getByTestId('daily-submit'));
    // Nothing goes to the server between questions.
    expect(mockPost).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i += 1) await fireEvent.press(screen.getByTestId('daily-skip'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [path, body] = mockPost.mock.calls[0]!;
    expect(path).toBe('/quest/daily/NC26.4/result');
    expect(body).toMatchObject({ day: '2026-11-01', answers: ['2', '12', null, null, null] });
    expect(typeof body.seconds).toBe('number');

    // The result, from the server's reply.
    expect(await screen.findByTestId('daily-result')).toBeTruthy();
    // The level in words, never "G4D #1" (JF32).
    expect(screen.getByTestId('daily-heading')).toHaveTextContent('Grade 4 · 2 of 5');
    expect(screen.queryByText(/G4D/)).toBeNull();
    expect(screen.getByTestId('daily-grid')).toHaveTextContent('✓✓✗✗✗');
  });

  it('opens a played Daily on its result, and shares the grid that names nobody', async () => {
    mockGet.mockResolvedValue({ data: PLAYED });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await renderWithProviders(<DailyScreen level="NC26.4" />);
    expect(await screen.findByTestId('daily-result')).toBeTruthy();
    expect(screen.queryByTestId('daily-play')).toBeNull();
    expect(screen.getByText('A new Daily tomorrow. Same five questions for everyone today.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('daily-share'));
    expect(share).toHaveBeenCalledWith({ message: 'Aimtrue G4D #1 ✓✓✗✗✗ 2/5 · 2:13' });
    await fireEvent.press(screen.getByTestId('daily-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('says there is no Daily when the console has it off, or the level is not offered here', async () => {
    mockGet.mockRejectedValue(new ApiRequestError(403, 'feature_unavailable', 'The Daily set is off.'));
    await renderWithProviders(<DailyScreen level="NC26.4" />);
    expect(await screen.findByText('There is no Daily for Grade 4 today.')).toBeTruthy();
    expect(screen.queryByTestId('state-feature-unavailable')).toBeNull();
  });

  it('reads the Daily again when the server refuses the play (already played, or a new day)', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...SET, questions: [numeric('q1')] } }).mockResolvedValue({ data: PLAYED });
    mockPost.mockRejectedValue(new ApiRequestError(409, 'conflict', 'You have played today’s Daily.'));
    await renderWithProviders(<DailyScreen level="NC26.4" />);
    await fireEvent.press(await screen.findByTestId('daily-skip'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('You have played today’s Daily.')).toBeTruthy();
    expect(await screen.findByTestId('daily-result')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('takes the last answer back when the save fails otherwise, so it can be given again', async () => {
    mockGet.mockResolvedValue({ data: { ...SET, questions: [numeric('q1')] } });
    mockPost.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: PLAYED });
    await renderWithProviders(<DailyScreen level="NC26.4" />);
    await fireEvent.press(await screen.findByTestId('daily-skip'));
    expect(await screen.findByText('The result could not be saved.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('daily-skip'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost.mock.calls[1]![1]).toMatchObject({ answers: [null] });
  });
});
