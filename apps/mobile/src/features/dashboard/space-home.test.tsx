// Phase 50 (build-log entry 62): the space home, Home in a space without Tutoring. It never reads
// Tutoring's routes, and shows the Assessment home, the Quest card, the switched-off card or the empty
// state as the space's sets say.
import type { CanvasAssessment } from '@tmi/shared';
import { screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { SpaceHomeScreen } from './space-home-screen';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/lib/haptics', () => ({ haptics: { selection: jest.fn(), warning: jest.fn() } }));
jest.mock('./home-top', () => ({ Greeting: () => null }));
jest.mock('@/providers/brand-provider', () => {
  const { PLATFORM_BRAND } = jest.requireActual('@tmi/shared');
  return { useBrand: () => ({ ...PLATFORM_BRAND, short: 'Ferreira' }) };
});

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));

const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: (path: string) => mockGet(path) },
}));

const ASSESS = {
  feature_tutoring: false,
  feature_assessment: true,
  feature_quest: false,
  canvas_assessments: true,
  gamify_question_quest: false,
  time_zone: 'America/New_York',
};

const NOOR = { id: 'noor', full_name: 'Noor Haddad' };
const SUBMITTED: CanvasAssessment = {
  id: 'a1',
  student_user_id: 'noor',
  student_name: 'Noor Haddad',
  started_by_name: 'Ines Ferreira',
  level_id: 'NC26.4',
  status: 'submitted',
  question_count: 10,
  questions_written: 10,
  choice_questions: null,
  choices_answered: null,
  choices_correct: null,
  unreviewed_questions: null,
  started_at: '2026-10-22T15:00:00.000Z',
  submitted_at: '2026-10-22T16:00:00.000Z',
  can_review: true,
  can_continue: false,
  reviewed_at: null,
  reviewed_by_name: null,
  review_draft: false,
};

function signIn(roles: string[], organization: Record<string, unknown> = ASSESS) {
  mockAuth.mockReturnValue({ user: { id: 'me', full_name: 'Ines Ferreira', roles }, organization });
}

function serve(rows: CanvasAssessment[]) {
  mockGet.mockImplementation((path: string) => {
    if (path.startsWith('/canvas-assessments')) return Promise.resolve({ data: rows });
    if (path.startsWith('/users')) return Promise.resolve({ data: [NOOR], meta: { total: 1 } });
    return Promise.reject(new Error(`unexpected read ${path}`));
  });
}

beforeEach(() => {
  mockGet.mockReset();
});

describe('SpaceHomeScreen', () => {
  it('gives an Assessment-only admin the three panels, and never reads Tutoring', async () => {
    signIn(['admin', 'parent']);
    serve([SUBMITTED]);
    await renderWithProviders(<SpaceHomeScreen />);
    expect(screen.getByTestId('space-home')).toBeTruthy();
    expect(await screen.findByTestId('assess-home-student-noor')).toBeTruthy();
    expect(screen.getByTestId('assess-home-students')).toHaveTextContent(/Students/);
    expect(screen.getByTestId('assess-home-status-noor')).toHaveTextContent(
      'Submitted Oct 22, waiting for review',
    );
    expect(screen.getByTestId('assess-home-waiting')).toBeTruthy();
    expect(await screen.findByTestId('assess-home-review-a1')).toHaveTextContent(/Review/);
    expect(screen.getByTestId('assess-home-recent')).toBeTruthy();
    expect(screen.getByTestId('assessment-row-a1')).toBeTruthy();
    const paths = mockGet.mock.calls.map(([path]) => path as string);
    for (const banned of ['/dashboard', '/sessions', '/home', '/schedules', '/assignments']) {
      expect(paths.some((path) => path.startsWith(banned))).toBe(false);
    }
    expect(screen.queryByTestId('space-home-quest')).toBeNull();
  });

  it('gives a parent their children and no Waiting panel', async () => {
    signIn(['parent']);
    serve([]);
    await renderWithProviders(<SpaceHomeScreen />);
    expect(await screen.findByTestId('assess-home-status-noor')).toHaveTextContent('No assessment yet');
    expect(screen.getByTestId('assess-home-students')).toHaveTextContent(/Your children/);
    expect(screen.getByTestId('assess-home-start-noor')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('assess-home-waiting')).toBeNull());
  });

  it('says Assessment is switched off, with Open Space for an admin', async () => {
    serve([]);
    signIn(['admin'], { ...ASSESS, canvas_assessments: false });
    await renderWithProviders(<SpaceHomeScreen />);
    expect(screen.getByTestId('space-home-assessment-off')).toBeTruthy();
    expect(screen.getByTestId('space-home-organization')).toBeTruthy();
    expect(screen.queryByTestId('assess-home-students')).toBeNull();
    expect(screen.queryByTestId('space-home-empty')).toBeNull();
  });

  it('tells anyone else the office can switch Assessment on', async () => {
    serve([]);
    signIn(['parent'], { ...ASSESS, canvas_assessments: false });
    await renderWithProviders(<SpaceHomeScreen />);
    expect(screen.getByTestId('space-home-assessment-off')).toHaveTextContent(/The office can switch it on\./);
    expect(screen.queryByTestId('space-home-organization')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is empty when nothing is on', async () => {
    serve([]);
    signIn(['admin'], { ...ASSESS, feature_assessment: false, canvas_assessments: false });
    await renderWithProviders(<SpaceHomeScreen />);
    expect(screen.getByTestId('space-home-empty')).toHaveTextContent(/Nothing is switched on in Ferreira yet\./);
    expect(screen.queryByTestId('space-home-organization')).toBeNull();
  });

  it('shows the Quest card while Quest is on', async () => {
    serve([]);
    signIn(['student'], {
      ...ASSESS,
      feature_assessment: false,
      feature_quest: true,
      gamify_question_quest: true,
    });
    await renderWithProviders(<SpaceHomeScreen />);
    expect(screen.getByTestId('space-home-quest')).toBeTruthy();
    expect(screen.getByTestId('space-home-quest-open')).toBeTruthy();
    expect(screen.queryByTestId('space-home-empty')).toBeNull();
  });
});
