// Phase 77 (JF20, owner 2026-11-05): a guardian continues her child's assessment on her own device. Whoever opens it
// for someone else first meets "Hand the device to Noor" -- "Noor answers on this device. Answers written on another
// device stay there." -- and the questions only after "Noor is ready"; the student's own opens straight on the first
// question. Start warns when the student already has one in progress, with "Continue it", "Start another" and
// "Not now".
import { fireEvent, screen } from '@testing-library/react-native';
import type { CanvasAssessment, CanvasAssessmentDetail } from '@tmi/shared';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/render';
import { AssessmentsScreen } from './assessments-screen';
import { TakeAssessmentScreen } from './take-assessment-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a-1' }),
}));
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/haptics', () => ({
  haptics: { selection: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), impact: jest.fn() },
}));
jest.mock('@/lib/storage', () => ({
  ...jest.requireActual('@/lib/storage'),
  readCanvasWork: jest.fn(async () => null),
  writeCanvasWork: jest.fn(async () => undefined),
}));
// The page and the maths cannot draw under Jest.
jest.mock('./drawing-canvas', () => ({ DrawingCanvas: () => null }));
jest.mock('./question-view', () => ({ QuestionView: () => null }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockStart = jest.fn();
const mockState = { detail: null as CanvasAssessmentDetail | null, list: [] as CanvasAssessment[] };
jest.mock('./api', () => ({
  useCanvasAssessment: () => ({ data: mockState.detail ? { data: mockState.detail } : undefined, isPending: false }),
  useSubmitCanvasAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCanvasAssessments: () => ({
    data: { data: mockState.list },
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: jest.fn(),
  }),
  useCanvasAssessmentLevels: () => ({
    data: { data: [{ level_id: 'NC26.4', label: 'Grade 4', available: 12, unreviewed: 0 }] },
    isPending: false,
    refetch: jest.fn(),
  }),
  useStartCanvasAssessment: () => ({ mutateAsync: mockStart, isPending: false }),
  useDiscardCanvasAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/users/api', () => ({
  useUsers: () => ({ data: { data: [{ id: 'noor', full_name: 'Noor Haddad' }] }, isPending: false, isSuccess: true }),
}));

const ORG = { slug: 'assess', feature_tutoring: false, canvas_assessment_questions: 10, canvas_assessments_unreviewed: false };

function row(overrides: Partial<CanvasAssessment> = {}): CanvasAssessment {
  return {
    id: 'a-1',
    student_user_id: 'noor',
    student_name: 'Noor Haddad',
    started_by_name: null,
    level_id: 'NC26.4',
    status: 'in_progress',
    question_count: 2,
    questions_written: 0,
    choice_questions: null,
    choices_answered: null,
    choices_correct: null,
    unreviewed_questions: null,
    started_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    submitted_at: null,
    can_review: false,
    can_continue: true,
    can_discard: false,
    reviewed_at: null,
    reviewed_by_name: null,
    review_draft: null,
    ...overrides,
  };
}

function detail(): CanvasAssessmentDetail {
  return {
    ...row(),
    questions: [
      { id: 'q1', kind: 'numeric', skill: null, stem: 'What is 3 x 4?', choices: [] },
      { id: 'q2', kind: 'numeric', skill: null, stem: 'What is 5 x 6?', choices: [] },
    ],
  } as unknown as CanvasAssessmentDetail;
}

beforeEach(() => {
  mockStart.mockReset();
  (router.push as jest.Mock).mockClear();
  mockState.detail = detail();
  mockState.list = [];
});

describe('the hand-over', () => {
  it("asks a guardian to hand the device to the child before the questions", async () => {
    mockAuth.mockReturnValue({ user: { id: 'omar', roles: ['parent'] }, organization: ORG });
    await renderWithProviders(<TakeAssessmentScreen />);
    expect(await screen.findByTestId('assessment-hand-over-title')).toHaveTextContent('Hand the device to Noor');
    expect(screen.getByTestId('assessment-hand-over-body')).toHaveTextContent(
      'Noor answers on this device. Answers written on another device stay there.',
    );
    expect(screen.queryByTestId('assessment-question-card')).toBeNull();
    await fireEvent.press(screen.getByTestId('assessment-ready'));
    expect(screen.queryByTestId('assessment-hand-over')).toBeNull();
    expect(screen.getByTestId('assessment-question-card')).toBeTruthy();
  });

  it('opens straight on the questions for the student herself', async () => {
    mockAuth.mockReturnValue({ user: { id: 'noor', roles: ['student'] }, organization: ORG });
    await renderWithProviders(<TakeAssessmentScreen />);
    expect(await screen.findByTestId('assessment-question-card')).toBeTruthy();
    expect(screen.queryByTestId('assessment-hand-over')).toBeNull();
  });
});

describe("Start, when one is in progress", () => {
  async function chooseNoorAndGrade4() {
    await fireEvent.press(screen.getByTestId('assessment-student'));
    await fireEvent.press(await screen.findByTestId('assessment-student-noor'));
    await fireEvent.press(screen.getByTestId('assessment-level'));
    await fireEvent.press(await screen.findByTestId('assessment-level-NC26.4'));
  }

  it('warns first, and Continue it opens the one in progress', async () => {
    mockAuth.mockReturnValue({ user: { id: 'omar', roles: ['parent'] }, organization: ORG });
    mockState.list = [row({ id: 'a-1' })];
    await renderWithProviders(<AssessmentsScreen />);
    await chooseNoorAndGrade4();
    await fireEvent.press(screen.getByTestId('assessment-begin'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(screen.getByTestId('assessment-in-progress-words')).toHaveTextContent(
      'Noor already has a Grade 4 assessment in progress (started 8 minutes ago).',
    );
    await fireEvent.press(screen.getByTestId('assessment-continue-it'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/assessments/[id]', params: { id: 'a-1' } });
  });

  it('Start another starts a second one', async () => {
    mockAuth.mockReturnValue({ user: { id: 'omar', roles: ['parent'] }, organization: ORG });
    mockState.list = [row({ id: 'a-1' })];
    mockStart.mockResolvedValue({ data: row({ id: 'a-2' }) });
    await renderWithProviders(<AssessmentsScreen />);
    await chooseNoorAndGrade4();
    await fireEvent.press(screen.getByTestId('assessment-begin'));
    await fireEvent.press(screen.getByTestId('assessment-start-another'));
    expect(mockStart).toHaveBeenCalledWith({ student_user_id: 'noor', level_id: 'NC26.4' });
  });

  it('offers no Continue it for one the reader may not take on, and starts at once with none in progress', async () => {
    mockAuth.mockReturnValue({ user: { id: 'kwame', roles: ['tutor'] }, organization: ORG });
    mockState.list = [row({ id: 'a-1', can_continue: false })];
    await renderWithProviders(<AssessmentsScreen />);
    await chooseNoorAndGrade4();
    await fireEvent.press(screen.getByTestId('assessment-begin'));
    expect(screen.getByTestId('assessment-in-progress')).toBeTruthy();
    expect(screen.queryByTestId('assessment-continue-it')).toBeNull();
    // Not now puts the warning away; Start is back.
    await fireEvent.press(screen.getByTestId('assessment-in-progress-cancel'));
    expect(screen.queryByTestId('assessment-in-progress')).toBeNull();
    expect(screen.getByTestId('assessment-begin')).toBeTruthy();

    mockState.list = [row({ id: 'a-1', status: 'submitted' })];
    mockStart.mockResolvedValue({ data: row({ id: 'a-3' }) });
    await renderWithProviders(<AssessmentsScreen />);
    await chooseNoorAndGrade4();
    await fireEvent.press(screen.getByTestId('assessment-begin'));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("shows Discard only where the reader may discard: not to a guardian who continues it", async () => {
    mockAuth.mockReturnValue({ user: { id: 'omar', roles: ['parent'] }, organization: ORG });
    mockState.list = [row({ id: 'a-1' })];
    await renderWithProviders(<AssessmentsScreen />);
    expect(screen.getByTestId('assessment-continue-a-1')).toBeTruthy();
    expect(screen.queryByTestId('assessment-discard-a-1')).toBeNull();
  });
});
