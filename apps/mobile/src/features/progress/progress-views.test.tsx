import type { ProgressCancellation, StudentProgress } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { studentProgress } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { StudentProgressView } from './student-progress-screen';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('./api', () => ({
  useTopicIndex: () => ({ levels: [], topics: new Map() }),
  useDeleteAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlan: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const cancelled: ProgressCancellation = {
  schedule_id: 'sched-1',
  occurs_on: '2026-11-24',
  start_time: '16:00',
  tutor_name: 'Alex Chen',
  cancelled_as: 'parent',
  note: null,
  cancelled_by_name: null,
};

const progress: StudentProgress = {
  ...studentProgress,
  assessments: [
    {
      id: 'as-1',
      student_user_id: 'student-1',
      student_name: 'Sofia Okafor',
      assessor_user_id: 'admin-1',
      assessor_name: 'Priya Raghavan',
      assessed_on: '2026-08-25',
      school_course: null,
      recommended_level_id: 'BA4',
      summary: 'Reads problems carefully.',
      ratings: [{ topic_id: 'BA4.05', rating: 2 }],
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
  cancellations: [cancelled],
};

const ADMIN_CONTROLS = [
  'progress-assess',
  'progress-plan-edit',
  'progress-delete-plan',
  'progress-assessment-edit',
  'progress-assessment-delete',
];

it('offers a non-admin no writes, and shows no money', async () => {
  mockAuth.mockReturnValue({ user: { id: 'tutor-1', roles: ['tutor'] } });
  await renderWithProviders(<StudentProgressView progress={progress} />);
  for (const id of ADMIN_CONTROLS) expect(screen.queryByTestId(id)).toBeNull();
  expect(screen.getByTestId('progress-chart')).toBeTruthy();
  expect(screen.getByText('Reads problems carefully.')).toBeTruthy();
  expect(screen.queryByText(/\$\d/)).toBeNull();
});

it('names a cancellation by capacity and leaves out a note the server withheld (R11)', async () => {
  mockAuth.mockReturnValue({ user: { id: 'tutor-2', roles: ['tutor'] } });
  await renderWithProviders(<StudentProgressView progress={progress} />);
  expect(screen.getByTestId('progress-cancelled-sched-1-2026-11-24')).toBeTruthy();
  expect(screen.getByText('by the family')).toBeTruthy();
  expect(screen.queryByTestId('progress-cancelled-note-sched-1-2026-11-24')).toBeNull();
});

it('shows the note and who cancelled when the server sent them', async () => {
  mockAuth.mockReturnValue({ user: { id: 'tutor-1', roles: ['tutor'] } });
  const withNote = {
    ...progress,
    cancellations: [{ ...cancelled, note: 'Thanksgiving week.', cancelled_by_name: 'Maria Okafor' }],
  };
  await renderWithProviders(<StudentProgressView progress={withNote} />);
  expect(screen.getByText('Thanksgiving week.')).toBeTruthy();
  expect(screen.getByText('by Maria Okafor')).toBeTruthy();
});

it('gives the office its writes', async () => {
  mockAuth.mockReturnValue({ user: { id: 'admin-1', roles: ['admin', 'tutor'] } });
  await renderWithProviders(<StudentProgressView progress={progress} />);
  for (const id of ADMIN_CONTROLS) expect(screen.getByTestId(id)).toBeTruthy();
  expect(screen.getByText('Reassess')).toBeTruthy();
});
