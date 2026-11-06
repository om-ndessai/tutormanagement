// Phase 75 (docs/journey-fixes-plan.md JF18, JF30): the Start and Stop sheets and the lessons-owed sheet.
// - Start says a refusal once, in place (never a toast under the sheet), and with a lesson running says which.
// - Stop prints every refusal line as text and loses nothing: Keep going keeps a changed note on the lesson.
// - The lessons owed: each with Record (or its draft's Continue), then "Another lesson", a blank record.
import type { ActiveSession, Assignment, LessonOwed } from '@tmi/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { LessonsOwedSheet } from './lessons-owed';
import { StartLessonSheet } from './start-lesson-sheet';
import { StopLessonSheet } from './stop-lesson-sheet';

const TUTOR = '00000000-0000-4000-8000-000000000003';
const STUDENT = '00000000-0000-4000-8000-000000000009';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => undefined }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useDirty: () => false,
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: TUTOR, roles: ['tutor'] } }),
  useOrgTimeZone: () => 'America/New_York',
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
jest.mock('./live-surface', () => ({ askForLiveSurfacePermission: jest.fn() }));

let mockActive: ActiveSession | null = null;
let mockOwedRows: LessonOwed[] = [];
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockUpdate = jest.fn();
const mockPairing = {
  id: 'pair-1',
  tutor_user_id: TUTOR,
  tutor_name: 'Alex Chen',
  student_user_id: STUDENT,
  student_name: 'Yusuf Haddad',
} as Assignment;
jest.mock('./api', () => ({
  useActiveSession: () => ({ isPending: false, isSuccess: true, data: { data: { mine: mockActive, all: [] } } }),
  useAssignments: () => ({ isPending: false, isError: false, data: { data: [mockPairing] } }),
  useStartSession: () => ({ mutateAsync: mockStart, isPending: false }),
  useStopSession: () => ({ mutateAsync: mockStop, isPending: false }),
  useUpdateActiveSession: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useLessonsOwed: () => ({ isPending: false, isError: false, data: { data: mockOwedRows } }),
}));

const running = (overrides: Partial<ActiveSession> = {}): ActiveSession =>
  ({
    tutor_user_id: TUTOR,
    tutor_name: 'Alex Chen',
    student_user_id: STUDENT,
    student_name: 'Yusuf Haddad',
    mode: 'in_person',
    started_at: '2026-11-05T21:00:00Z',
    rounded_start: '16:00',
    max_minutes: 120,
    notes: null,
    ...overrides,
  }) as ActiveSession;

const PRICE = "Ask the office to set Yusuf's price.";
const refusal = () => new ApiRequestError(422, 'validation_failed', PRICE, { mode: [PRICE] });

beforeEach(() => {
  mockActive = null;
  mockOwedRows = [];
  [mockStart, mockStop, mockUpdate, mockToast.success, mockToast.error, mockToast.info].forEach((fn) => fn.mockReset());
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.back).mockClear();
});

describe('Start', () => {
  it('opens with the lesson’s student and mode, and says a price refusal once, in place', async () => {
    mockStart.mockRejectedValue(refusal());
    await renderWithProviders(<StartLessonSheet initialStudent={STUDENT} initialMode="virtual" />);
    expect(screen.getByText('Start a lesson')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('start-submit'));
    });
    expect(mockStart).toHaveBeenCalledWith({ student_user_id: STUDENT, mode: 'virtual' });
    expect(screen.getByTestId('start-error')).toHaveTextContent(PRICE);
    expect(screen.getAllByText(PRICE)).toHaveLength(1);
    // Never a toast under the sheet.
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('with a lesson running, says which and offers to stop it', async () => {
    mockActive = running();
    await renderWithProviders(<StartLessonSheet />);
    expect(screen.getByText(/Your lesson with Yusuf Haddad is still running/)).toBeTruthy();
    expect(screen.queryByTestId('start-submit')).toBeNull();
    await fireEvent.press(screen.getByTestId('start-stop-running'));
    expect(router.replace).toHaveBeenCalledWith('/stop-lesson');
  });
});

describe('Stop', () => {
  it('prints the refusal once as text, and keeps the sheet (and the note) open', async () => {
    mockActive = running({ notes: 'Fractions' });
    mockStop.mockRejectedValue(refusal());
    await renderWithProviders(<StopLessonSheet />);
    expect(screen.getByText('End the lesson with Yusuf Haddad?')).toBeTruthy();
    expect(screen.getByDisplayValue('Fractions')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('stop-submit'));
    });
    expect(screen.getByTestId('stop-error')).toHaveTextContent(PRICE);
    expect(screen.getAllByText(PRICE)).toHaveLength(1);
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Fractions')).toBeTruthy();
  });

  it('"Keep going" keeps a changed note on the running lesson before it closes', async () => {
    mockActive = running({ notes: null });
    mockUpdate.mockResolvedValue({ data: running({ notes: 'Long division' }) });
    await renderWithProviders(<StopLessonSheet />);
    await fireEvent.changeText(screen.getByTestId('stop-notes'), 'Long division');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('stop-keep-going'));
    });
    expect(mockUpdate).toHaveBeenCalledWith({ notes: 'Long division' });
    expect(router.back).toHaveBeenCalled();
  });

  it('"Keep going" with nothing changed just closes', async () => {
    mockActive = running({ notes: 'Fractions' });
    await renderWithProviders(<StopLessonSheet />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('stop-keep-going'));
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});

describe('the lessons still owed', () => {
  const row = (overrides: Partial<LessonOwed> = {}): LessonOwed => ({
    schedule_id: 'sch-1',
    occurs_on: '2026-11-03',
    start_time: '16:00',
    end_time: '17:00',
    mode: 'in_person',
    tutor_user_id: TUTOR,
    tutor_name: 'Alex Chen',
    student_user_id: STUDENT,
    student_name: 'Yusuf Haddad',
    place: null,
    draft: null,
    ...overrides,
  });

  it('lists each with Record (the sheet gives way to it), then "Another lesson", a blank record', async () => {
    mockOwedRows = [row(), row({ schedule_id: 'sch-2', draft: { id: 'd-9', updated_at: '2026-11-03T17:43:00Z' } })];
    await renderWithProviders(<LessonsOwedSheet />);
    expect(screen.getByText('Record a lesson')).toBeTruthy();
    expect(screen.getByTestId('lessons-owed-sch-2-2026-11-03-record')).toHaveTextContent('Continue');
    await fireEvent.press(screen.getByTestId('lessons-owed-sch-1-2026-11-03-record'));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/record-as-planned',
      params: expect.objectContaining({ student: STUDENT, date: '2026-11-03' }),
    });
    await fireEvent.press(screen.getByTestId('lessons-owed-sch-2-2026-11-03-record'));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/record-lesson', params: { draft: 'd-9' } });
    await fireEvent.press(screen.getByTestId('lessons-owed-another'));
    // No date, no params: the blank record dates nothing by default.
    expect(router.replace).toHaveBeenLastCalledWith('/record-lesson');
  });

  it('with nothing owed, says so, and still offers Another lesson', async () => {
    await renderWithProviders(<LessonsOwedSheet />);
    expect(screen.getByTestId('lessons-owed-empty')).toBeTruthy();
    expect(screen.getByTestId('lessons-owed-another')).toBeTruthy();
  });
});
