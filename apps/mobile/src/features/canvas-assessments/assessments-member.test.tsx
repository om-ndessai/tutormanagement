// Phase 79 (M6, docs/members-plan.md; owner 2026-11-06): a member -- in a shared space with no role -- plays Quest;
// assessments there are for students. Their menu leaves the page out, and a link to it says one line, reading
// nothing: no students, no levels, no list. A personal space's maker is its admin, so it never applies there.
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { MEMBER_ASSESSMENTS_LINE, assessmentsForMember } from './assessment-model';
import { AssessmentsScreen } from './assessments-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }));
jest.mock('@/lib/haptics', () => ({
  haptics: { selection: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), impact: jest.fn() },
}));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth(), useOrgTimeZone: () => 'America/New_York' }));

const mockEnabled = { list: [] as (boolean | undefined)[], levels: [] as (boolean | undefined)[], users: [] as (boolean | undefined)[] };
jest.mock('./api', () => ({
  useCanvasAssessments: (options?: { enabled?: boolean }) => {
    mockEnabled.list.push(options?.enabled);
    return { data: { data: [] }, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() };
  },
  useCanvasAssessmentLevels: (options?: { enabled?: boolean }) => {
    mockEnabled.levels.push(options?.enabled);
    return { data: { data: [] }, isPending: false, refetch: jest.fn() };
  },
  useStartCanvasAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDiscardCanvasAssessment: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/users/api', () => ({
  useUsers: (_params: unknown, options?: { enabled?: boolean }) => {
    mockEnabled.users.push(options?.enabled);
    return { data: { data: [] }, isPending: false, isSuccess: true };
  },
}));

const CHMI = { slug: 'chmi', personal: false, canvas_assessment_questions: 10 };

beforeEach(() => {
  mockEnabled.list = [];
  mockEnabled.levels = [];
  mockEnabled.users = [];
});

describe('the Assessment page for a member (Phase 79)', () => {
  it('is for a member of a shared space only', () => {
    expect(assessmentsForMember({ roles: [] }, CHMI)).toBe(true);
    expect(assessmentsForMember({ roles: [] }, { personal: true })).toBe(false);
    expect(assessmentsForMember({ roles: ['student'] }, CHMI)).toBe(false);
    expect(assessmentsForMember(null, CHMI)).toBe(false);
    expect(MEMBER_ASSESSMENTS_LINE).toBe('Assessments here are for students.');
  });

  it('says one line in place of the start card and the list, and reads nothing', async () => {
    mockAuth.mockReturnValue({ user: { id: 'mo', roles: [] }, organization: CHMI });
    await renderWithProviders(<AssessmentsScreen />);
    expect(screen.getByTestId('assessment-for-students')).toHaveTextContent('Assessments here are for students.');
    expect(screen.queryByTestId('assessment-student')).toBeNull();
    expect(screen.queryByTestId('assessment-level')).toBeNull();
    expect(screen.queryByTestId('assessment-begin')).toBeNull();
    expect(screen.queryByTestId('assessments-empty')).toBeNull();
    expect(mockEnabled.list.every((enabled) => enabled === false)).toBe(true);
    expect(mockEnabled.levels.every((enabled) => enabled === false)).toBe(true);
    expect(mockEnabled.users).toEqual([]);
  });

  it('a student there still starts their own', async () => {
    mockAuth.mockReturnValue({ user: { id: 'sofia', roles: ['student'] }, organization: CHMI });
    await renderWithProviders(<AssessmentsScreen />);
    expect(screen.queryByTestId('assessment-for-students')).toBeNull();
    expect(screen.getByTestId('assessment-level')).toBeTruthy();
    expect(screen.getByTestId('assessment-begin')).toBeTruthy();
  });
});
