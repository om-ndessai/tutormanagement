import type { SessionAssessment, SessionReflection } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AssessForm } from './assess-session-sheet';
import { assessLabel, reflectLabel } from './session-actions';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('./api', () => ({
  useSaveSessionAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useWithdrawSessionAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const TUTOR = { id: 'tutor-1', roles: ['tutor'] };
const PARENT = { id: 'parent-1', roles: ['parent'] };
const STUDENT = { id: 'student-1', roles: ['student'] };

function assessment(author: string, role: SessionAssessment['author_role'], rating = 4): SessionAssessment {
  return {
    author_user_id: author,
    author_name: author === 'tutor-1' ? 'Alex Chen' : 'Maria Okafor',
    author_role: role,
    rating,
    body: `${role} words`,
    created_at: '2026-10-07T20:00:00Z',
    updated_at: '2026-10-07T20:00:00Z',
  } as SessionAssessment;
}

const reflection = (entered_as: SessionReflection['entered_as']) =>
  ({ learned_new: 4, difficulty: 3, understanding: 4, pace: 3, entered_as }) as SessionReflection;

describe('assess and reflect on a lesson', () => {
  it('offers Assess to everyone the lesson concerns but its student, and says when it is theirs', () => {
    const lesson = session({ assessments: [assessment('tutor-1', 'tutor')], money_view: 'tutor' });
    expect(assessLabel(lesson, TUTOR)?.label).toBe('Your assessment');
    expect(assessLabel({ ...lesson, money_view: 'family' }, PARENT)?.label).toBe('Assess');
    expect(assessLabel(lesson, STUDENT)).toBeNull();
  });

  it('offers Reflect by capacity, and never lets an adult change what the student entered', () => {
    const lesson = session({ assessments: [], reflection: null, money_view: 'family' });
    expect(reflectLabel(lesson, STUDENT)?.label).toBe('Reflect');
    expect(reflectLabel(lesson, PARENT)?.label).toBe('Add Sofia’s reflection');
    expect(reflectLabel({ ...lesson, reflection: reflection('parent') }, PARENT)?.label).toBe(
      'Edit reflection',
    );
    expect(reflectLabel({ ...lesson, reflection: reflection('student') }, PARENT)).toBeNull();
    expect(reflectLabel({ ...lesson, reflection: reflection('student') }, STUDENT)?.label).toBe(
      'Your reflection',
    );
  });

  it('a parent assesses as a parent; Withdraw only appears for their own; no money', async () => {
    mockAuth.mockReturnValue({ user: PARENT });
    const lesson = session({ assessments: [assessment('tutor-1', 'tutor')], money_view: 'family' });
    await renderWithProviders(<AssessForm session={lesson} />);
    expect(screen.getByText('Assess this session')).toBeOnTheScreen();
    expect(screen.queryByTestId('assess-withdraw')).toBeNull();
    // The tutor's words are not in the parent's fields.
    expect(screen.queryByDisplayValue('tutor words')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('holds the reader’s own assessment, with Withdraw', async () => {
    mockAuth.mockReturnValue({ user: PARENT });
    const lesson = session({
      assessments: [assessment('tutor-1', 'tutor'), assessment('parent-1', 'parent', 2)],
      money_view: 'family',
    });
    await renderWithProviders(<AssessForm session={lesson} />);
    expect(screen.getByText('Your assessment')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('parent words')).toBeOnTheScreen();
    expect(screen.getByTestId('assess-withdraw')).toBeOnTheScreen();
  });

  it('a student is pointed to Reflect instead', async () => {
    mockAuth.mockReturnValue({ user: STUDENT });
    await renderWithProviders(<AssessForm session={session({ assessments: [], money_view: 'family' })} />);
    expect(screen.getByTestId('assess-student-note')).toBeOnTheScreen();
    expect(screen.queryByTestId('assess-save')).toBeNull();
  });
});
