// Phase 80 (A11, A15): the console's approve sheet -- Nowhere by default; a console-made space offers Member and Admin
// (Admin never for a 13-17), says the person joins at once; a self-started one says its admins are asked, and warns
// where Quest is off; Approve sends the shared decision, and a refusal stays in the sheet in the server's words.
import type { AccessAccount, AccessConsoleResponse, PlacementSpace } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { ApproveSheet } from './approve-sheet';

const mockRouter = { back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));

const CHMI: PlacementSpace = {
  id: '0a000000-0000-4000-8000-000000000001',
  name: 'Chapel Hill Math Institute',
  short_name: 'CHMI',
  created_via: 'console',
  quest_on: true,
  tutoring_on: true,
  assessment_on: true,
};
const FERREIRA: PlacementSpace = {
  id: '0d000000-0000-4000-8000-000000000001',
  name: 'Ferreira Family Practice',
  short_name: 'Ferreira',
  created_via: 'self_serve',
  quest_on: false,
  tutoring_on: false,
  assessment_on: true,
};
const PIA: AccessAccount = {
  user_id: 'u-pia',
  full_name: 'Pia Pending',
  email: 'pia@example.com',
  age_band: 'adult',
  access: 'pending',
  providers: [],
  signed_up_at: '2026-11-06T08:00:00.000Z',
  decided_at: null,
  decided_by_name: null,
};

const mockDecide = jest.fn();
const mockSpacesEnabled = jest.fn();
let mockConsole: AccessConsoleResponse;
let mockSpaces: { data?: { data: PlacementSpace[] }; isPending: boolean; isError: boolean };
jest.mock('./api', () => ({
  useAccessConsole: () => ({ data: { data: mockConsole }, isPending: false, isError: false, refetch: jest.fn() }),
  useDecideAccess: () => ({ mutateAsync: mockDecide, isPending: false }),
  usePlacementSpaces: (enabled: boolean) => {
    mockSpacesEnabled(enabled);
    return mockSpaces;
  },
}));

function setConsole(waiting: AccessAccount[], decided: AccessAccount[] = []) {
  mockConsole = { settings: { mode: 'postapproved' }, list: [], waiting, decided };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDecide.mockResolvedValue({ data: {} });
  setConsole([PIA]);
  mockSpaces = { data: { data: [CHMI, FERREIRA] }, isPending: false, isError: false };
});

describe('ApproveSheet (Phase 80)', () => {
  it('reads the spaces only while open, and starts on Nowhere', async () => {
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    expect(mockSpacesEnabled).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('access-approve-title')).toHaveTextContent('Approve Pia Pending');
    expect(screen.getByText('pia@example.com · Adult')).toBeTruthy();
    expect(screen.getByTestId('access-approve-place-label')).toHaveTextContent('Place them in a space (optional)');
    expect(screen.getByTestId('access-approve-row-nowhere').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId(`access-approve-row-${CHMI.id}`)).toHaveTextContent(/Joins at once/);
    expect(screen.getByTestId(`access-approve-row-${FERREIRA.id}`)).toHaveTextContent(/Its admins let them in · Quest off/);
    expect(screen.queryByTestId('access-approve-place')).toBeNull();
  });

  it('approves with no place: their own space, as before', async () => {
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    await fireEvent.press(screen.getByTestId('access-approve-confirm'));
    expect(mockDecide).toHaveBeenCalledWith({ userId: 'u-pia', access: 'approved' });
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockToast.success).toHaveBeenCalledWith('Pia Pending approved.');
  });

  it('places an adult in a console-made space, as Member or Admin, and says they join at once', async () => {
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    await fireEvent.press(screen.getByTestId(`access-approve-row-${CHMI.id}`));
    expect(screen.getByTestId('access-approve-role-member').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('access-approve-role-admin')).toBeTruthy();
    expect(screen.getByTestId('access-approve-role-hint')).toHaveTextContent(
      'Plays Quest there, with no role until its admins give one.',
    );
    expect(screen.getByTestId('access-approve-words')).toHaveTextContent(
      'Pia joins Chapel Hill Math Institute at once, and lands there when they sign in.',
    );
    expect(screen.queryByTestId('access-approve-quest-off')).toBeNull();
    await fireEvent.press(screen.getByTestId('access-approve-role-admin'));
    expect(screen.getByTestId('access-approve-role-hint')).toHaveTextContent(
      'Helps run the space: adds people, starts assessments.',
    );
    await fireEvent.press(screen.getByTestId('access-approve-confirm'));
    expect(mockDecide).toHaveBeenCalledWith({
      userId: 'u-pia',
      access: 'approved',
      space: { organization_id: CHMI.id, role: 'admin' },
    });
  });

  it('offers a 13-17 no Admin', async () => {
    setConsole([{ ...PIA, age_band: '13-17' }]);
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    expect(screen.getByText('pia@example.com · Age 13-17')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`access-approve-row-${CHMI.id}`));
    expect(screen.getByTestId('access-approve-role-member')).toBeTruthy();
    expect(screen.queryByTestId('access-approve-role-admin')).toBeNull();
  });

  it('a self-started space: Member only, its admins asked, the warning where Quest is off; another space puts the role back', async () => {
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    await fireEvent.press(screen.getByTestId(`access-approve-row-${CHMI.id}`));
    await fireEvent.press(screen.getByTestId('access-approve-role-admin'));
    await fireEvent.press(screen.getByTestId(`access-approve-row-${FERREIRA.id}`));
    expect(screen.queryByTestId('access-approve-role-admin')).toBeNull();
    expect(screen.getByTestId('access-approve-words')).toHaveTextContent(
      "Ferreira Family Practice's admins are asked to let Pia in. Until they answer, Pia can make a space of their own.",
    );
    expect(screen.getByTestId('access-approve-quest-off')).toHaveTextContent(
      /Quest is off there, so a member has nothing to do until the space's admins give them a role\.$/,
    );
    await fireEvent.press(screen.getByTestId('access-approve-confirm'));
    expect(mockDecide).toHaveBeenCalledWith({
      userId: 'u-pia',
      access: 'approved',
      space: { organization_id: FERREIRA.id, role: 'member' },
    });
  });

  it('narrows the list by name or short name, Nowhere always listed', async () => {
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    await fireEvent.changeText(screen.getByTestId('access-approve-input'), 'chmi');
    expect(screen.getByTestId(`access-approve-row-${CHMI.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`access-approve-row-${FERREIRA.id}`)).toBeNull();
    expect(screen.getByTestId('access-approve-row-nowhere')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('access-approve-input'), 'nothing like it');
    expect(screen.getByTestId('access-approve-list-note')).toHaveTextContent('No space has that name.');
  });

  it('keeps a refusal in the sheet, in the server’s words', async () => {
    mockDecide.mockRejectedValueOnce(
      new ApiRequestError(409, 'conflict', "Already approved: add them from the space's People."),
    );
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    await fireEvent.press(screen.getByTestId(`access-approve-row-${CHMI.id}`));
    await fireEvent.press(screen.getByTestId('access-approve-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('access-approve-problem')).toHaveTextContent(
        "Already approved: add them from the space's People.",
      ),
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('says so when the spaces cannot be read: approving gives them their own', async () => {
    mockSpaces = { data: undefined, isPending: false, isError: true };
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    expect(screen.getByTestId('access-approve-list-note')).toHaveTextContent(
      'The spaces could not be loaded. Approving now gives them a space of their own.',
    );
  });

  it('approves a declined account again; an approved one is not waiting', async () => {
    setConsole([], [{ ...PIA, access: 'declined' }]);
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    expect(screen.getByTestId('access-approve-sheet')).toBeTruthy();
    await screen.unmount();
    setConsole([], [{ ...PIA, access: 'approved' }]);
    await renderWithProviders(<ApproveSheet userId="u-pia" />);
    expect(screen.getByTestId('access-approve-missing')).toBeTruthy();
  });
});
