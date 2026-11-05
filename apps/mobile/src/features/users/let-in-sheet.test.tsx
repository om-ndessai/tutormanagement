// UI audit (JF1; owner, 2026-11-04): Let in is a short sheet -- the role (a parent by default; Tutor only
// where Tutoring is on), the one request the web sends, and for a parent "Which child is theirs?": a student
// here linked with their guardians kept and the parent added, their child added now with the parent preset,
// or later. The request leaves the list as soon as they are in; anything else is the full form.
import type { UserDetail } from '@tmi/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { askedAsLine, guardiansWith, initialLetInRole, letInChoices, letInRequest, requestAskedLine } from './let-in-model';
import { LetInSheet } from './let-in-sheet';

const mockRouter = { back: jest.fn(), push: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useDirty: () => false,
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const JO = {
  user_id: '00000000-0000-4000-8000-0000000000a1',
  full_name: 'Jo Joiner',
  email: 'spaces.joiner@example.com',
  requested_at: new Date(Date.now() - 5 * 60_000).toISOString(),
};
const mockRequests = { rows: [JO] as (typeof JO & { role?: string | null; note?: string | null })[] };
const mockRefresh = jest.fn();
jest.mock('@/features/organizations/api', () => ({
  useJoinRequests: (enabled: boolean) => ({
    data: enabled ? { data: mockRequests.rows } : undefined,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useRefreshJoinRequests: () => mockRefresh,
}));

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const NOOR = { id: '00000000-0000-4000-8000-0000000000b1', full_name: 'Noor Ferreira' };
jest.mock('./api', () => ({
  useCreateUser: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateUser: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useUsers: () => ({ data: { data: [NOOR] }, isPending: false, isSuccess: true }),
}));
const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

const NEW_PARENT = { id: '00000000-0000-4000-8000-0000000000c1', full_name: 'Jo Joiner' } as UserDetail;

function as({ tutoring = false, account = { age_band: 'adult' } as unknown } = {}) {
  mockAuth.mockReturnValue({
    user: { id: 'ines', full_name: 'Ines Ferreira', roles: ['admin'] },
    account,
    organization: { feature_tutoring: tutoring, feature_assessment: true, feature_quest: true },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequests.rows = [JO];
  as();
});

describe('the Let in model', () => {
  it('offers Parent and Admin, and Tutor only where Tutoring is on', () => {
    expect(letInChoices(false).map((c) => c.role)).toEqual(['parent', 'admin']);
    expect(letInChoices(true).map((c) => c.role)).toEqual(['parent', 'admin', 'tutor']);
  });

  it('sends the web’s request: the person as asked, one role, active, tied to the request', () => {
    expect(letInRequest(JO, 'parent')).toEqual({
      full_name: 'Jo Joiner',
      email: 'spaces.joiner@example.com',
      phone: null,
      roles: ['parent'],
      status: 'active',
      join_request_user_id: JO.user_id,
    });
  });

  it('starts on the role asked for when the sheet offers it, else a parent (Phase 72, JF26)', () => {
    expect(initialLetInRole('admin', false)).toBe('admin');
    expect(initialLetInRole('tutor', true)).toBe('tutor');
    // No Tutoring here: a tutor's ask starts on a parent, as a learner's does (they join with their parent).
    expect(initialLetInRole('tutor', false)).toBe('parent');
    expect(initialLetInRole('student', true)).toBe('parent');
    expect(initialLetInRole(null, true)).toBe('parent');
    expect(initialLetInRole(undefined, false)).toBe('parent');
  });

  it('says what they asked, and how a learner joins (the web’s words)', () => {
    expect(askedAsLine('parent')).toBe('Asked as a parent.');
    expect(askedAsLine('admin')).toBe('Asked as helping run it.');
    expect(askedAsLine('student')).toBe('Asked as a learner. A learner joins with their parent: use the full form.');
    expect(askedAsLine(null)).toBeNull();
    const at = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(requestAskedLine({ requested_at: at, role: 'tutor' })).toMatch(/^asked .+ · as a tutor$/);
    expect(requestAskedLine({ requested_at: at, role: null })).toMatch(/^asked [^·]+$/);
  });

  it('keeps a student’s guardians and adds the parent, primary only when there was nobody', () => {
    const had = {
      guardians: [
        { user_id: 'mum', full_name: 'Mum', email: null, relationship: 'mother' as const, is_primary: true },
      ],
    };
    expect(guardiansWith(had, 'jo')).toEqual([
      { guardian_user_id: 'mum', relationship: 'mother', is_primary: true },
      { guardian_user_id: 'jo', relationship: 'guardian', is_primary: false },
    ]);
    expect(guardiansWith({ guardians: [] }, 'jo')).toEqual([
      { guardian_user_id: 'jo', relationship: 'guardian', is_primary: true },
    ]);
  });
});

describe('LetInSheet', () => {
  it('asks the role, a parent by default, with the whole address and when they asked', async () => {
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.getByText('Let Jo Joiner in')).toBeTruthy();
    expect(screen.getByText(/spaces\.joiner@example\.com · asked/)).toBeTruthy();
    expect(screen.getByTestId('let-in-role-parent')).toHaveProp('accessibilityState', { checked: true, selected: true });
    expect(screen.getByTestId('let-in-role-admin')).toHaveProp('accessibilityState', { checked: false, selected: false });
    expect(screen.getByText('Their child is, or will be, in this space.')).toBeTruthy();
    expect(screen.queryByTestId('let-in-role-tutor')).toBeNull();
    expect(screen.getByTestId('let-in-submit')).toHaveTextContent(/Let in$/);
  });

  it('starts on the role they asked for, and shows it with their note (Phase 72, JF26)', async () => {
    as({ tutoring: true });
    mockRequests.rows = [{ ...JO, role: 'tutor', note: 'I teach Grade 4 on Tuesdays.' }];
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.getByTestId('let-in-role-tutor')).toHaveProp('accessibilityState', { checked: true, selected: true });
    expect(screen.getByTestId('let-in-role-parent')).toHaveProp('accessibilityState', { checked: false, selected: false });
    const asked = screen.getByTestId('let-in-asked');
    expect(asked).toHaveTextContent(/Asked as a tutor\./);
    expect(asked).toHaveTextContent(/“I teach Grade 4 on Tuesdays\.”/);
  });

  it('a learner’s ask starts on a parent and points to the full form; an older app’s ask says nothing', async () => {
    mockRequests.rows = [{ ...JO, role: 'student', note: null }];
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.getByTestId('let-in-role-parent')).toHaveProp('accessibilityState', { checked: true, selected: true });
    expect(screen.getByTestId('let-in-asked')).toHaveTextContent(
      'Asked as a learner. A learner joins with their parent: use the full form.',
    );
    await screen.unmount();
    mockRequests.rows = [JO];
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.queryByTestId('let-in-asked')).toBeNull();
  });

  it('offers Tutor where Tutoring is on', async () => {
    as({ tutoring: true });
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.getByTestId('let-in-role-tutor')).toBeTruthy();
    expect(screen.getByText('Teaches students here.')).toBeTruthy();
  });

  it('an admin is let in at once and the sheet closes', async () => {
    mockCreate.mockResolvedValue({ data: NEW_PARENT });
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    await fireEvent.press(screen.getByTestId('let-in-role-admin'));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('let-in-submit'));
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['admin'], join_request_user_id: JO.user_id }),
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Jo Joiner is in.');
    expect(mockRouter.back).toHaveBeenCalled();
    expect(screen.queryByTestId('let-in-child')).toBeNull();
  });

  it('a parent goes on to their child, and stays there once the request has left the list', async () => {
    mockCreate.mockResolvedValue({ data: NEW_PARENT });
    // Answered: refreshing the list takes the request out of it; the sheet keeps it.
    mockRefresh.mockImplementation(() => {
      mockRequests.rows = [];
    });
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('let-in-submit'));
    });
    expect(mockCreate).toHaveBeenCalledWith(letInRequest(JO, 'parent'));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Jo Joiner is in.');
    expect(screen.getByText("Which child is Jo's?")).toBeTruthy();
    expect(screen.getByTestId('let-in-add-child')).toHaveTextContent(/Add Jo's child now$/);
    expect(screen.getByTestId('let-in-later')).toHaveTextContent('Later');
    expect(screen.queryByTestId('let-in-missing')).toBeNull();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('Link saves the student’s guardians with the parent added', async () => {
    mockCreate.mockResolvedValue({ data: NEW_PARENT });
    mockGet.mockResolvedValue({
      data: {
        id: NOOR.id,
        full_name: NOOR.full_name,
        guardians: [
          {
            user_id: 'ines',
            full_name: 'Ines Ferreira',
            email: null,
            relationship: 'mother',
            is_primary: true,
          },
        ],
      },
    });
    mockUpdate.mockResolvedValue({ data: {} });
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('let-in-submit'));
    });
    expect(screen.getByTestId('let-in-link')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('let-in-student'));
    await fireEvent.press(screen.getByTestId(`let-in-student-${NOOR.id}`));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('let-in-link'));
    });
    expect(mockGet).toHaveBeenCalledWith(`/users/${NOOR.id}`);
    expect(mockUpdate).toHaveBeenCalledWith({
      id: NOOR.id,
      input: {
        guardians: [
          { guardian_user_id: 'ines', relationship: 'mother', is_primary: true },
          { guardian_user_id: NEW_PARENT.id, relationship: 'guardian', is_primary: false },
        ],
      },
    });
    expect(mockToast.success).toHaveBeenLastCalledWith('Noor Ferreira is linked to Jo.');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('Add their child now opens Add a student with the parent chosen', async () => {
    mockCreate.mockResolvedValue({ data: NEW_PARENT });
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('let-in-submit'));
    });
    await fireEvent.press(screen.getByTestId('let-in-add-child'));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/add-student',
      params: { guardian: NEW_PARENT.id, guardianName: 'Jo Joiner' },
    });
  });

  it('a refusal is said above the button, and nobody moves on', async () => {
    const { ApiRequestError } = jest.requireActual('@/lib/api-client');
    mockCreate.mockRejectedValue(new ApiRequestError(409, 'conflict', 'They are already in this space.'));
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('let-in-submit'));
    });
    expect(screen.getByTestId('let-in-error')).toHaveTextContent('They are already in this space.');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.queryByTestId('let-in-child')).toBeNull();
  });

  it('the full form is one tap away, on the same request', async () => {
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    await fireEvent.press(screen.getByTestId('let-in-full-form'));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/person-form',
      params: { request: JO.user_id },
    });
  });

  it('a request answered elsewhere says so', async () => {
    mockRequests.rows = [];
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.getByTestId('let-in-missing')).toBeTruthy();
  });

  it('a 13-17 or a non-admin is not offered it (JF22)', async () => {
    as({ account: { age_band: '13-17' } });
    await renderWithProviders(<LetInSheet requestId={JO.user_id} />);
    expect(screen.getByText('Only an admin can let people in.')).toBeTruthy();
    expect(screen.queryByTestId('let-in-submit')).toBeNull();
  });
});
