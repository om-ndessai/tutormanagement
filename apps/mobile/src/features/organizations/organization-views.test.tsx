import { SSN_REJECTED_MESSAGE, type CurriculumOffering, type NotificationLogEntry } from '@tmi/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { featureSetsLabel, OrganizationSettingsScreen } from './organization-settings-screen';
import { validateForm } from './settings-form';

const mockTitles: string[] = [];
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options?: { title?: string } }) => {
      if (options?.title) mockTitles.push(options.title);
      return null;
    },
  },
  router: { replace: jest.fn(), dismissAll: jest.fn(), canDismiss: () => false },
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockSettings = jest.fn();
const mockNotifications = jest.fn();
const mockPatch = jest.fn();
const mockOfferings = jest.fn();
const mockPut = jest.fn();
jest.mock('./api', () => ({
  useOrganizationSettings: (enabled: boolean) => mockSettings(enabled),
  useOrganizationNotifications: (enabled: boolean) => mockNotifications(enabled),
  useUpdateOrganizationSettings: () => ({ mutateAsync: mockPatch, isPending: false }),
  useCurriculumOfferings: (enabled: boolean) => mockOfferings(enabled),
  useUpdateCurriculumOffering: () => ({ mutateAsync: mockPut, isPending: false }),
  // Phase 52: the space code and the danger panel.
  useSpaceCode: (enabled: boolean) => mockCode(enabled),
  useRenewSpaceCode: () => ({ mutate: jest.fn(), isPending: false }),
  useSetJoinByCode: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useLeaveSpace: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteSpace: () => ({ mutate: jest.fn(), isPending: false }),
}));
const mockCode = jest.fn();

const offering = (id: string, name: string, flags: Partial<CurriculumOffering>): CurriculumOffering => ({
  id,
  name,
  source: null,
  edition: null,
  description: null,
  source_url: null,
  is_default: false,
  retired: false,
  offered: false,
  level_count: 8,
  topic_count: 116,
  ...flags,
});
const OFFERINGS: CurriculumOffering[] = [
  offering('ba', 'Beast Academy', { is_default: true, offered: true }),
  offering('nc-2017', 'NC Math (2017)', {}),
  offering('nc-2026', 'NC Math (2026)', { retired: true }),
];

const ORGANIZATION = { name: 'Chapel Hill Math', palette: 'indigo', time_zone: 'America/New_York' };
const SETTINGS = {
  tin: '47-2019388',
  payer_address_line1: '100 Franklin Street',
  payer_address_line2: null,
  payer_city: 'Chapel Hill',
  payer_state: 'NC',
  payer_postal_code: '27514',
  email_notifications: true,
  canvas_assessments: false,
  canvas_assessments_unreviewed: false,
  canvas_assessment_questions: 10,
};
const LOG: NotificationLogEntry[] = [
  {
    id: 'n1',
    kind: 'session_recorded',
    subject_user_id: 's',
    subject_name: 'Sofia Okafor',
    recipient_user_id: 'm',
    recipient_name: 'Maria Okafor',
    status: 'skipped',
    detail: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'n2',
    kind: 'user_added',
    subject_user_id: 'b',
    subject_name: 'Ben Whitfield',
    recipient_user_id: 'b',
    recipient_name: 'Ben Whitfield',
    status: 'failed',
    detail: 'destination not verified',
    created_at: new Date().toISOString(),
  },
];

function asAdmin(isAdmin = true, organization: Record<string, unknown> = ORGANIZATION) {
  mockCode.mockReturnValue({
    data: { data: { code: 'FMXY-2345', join_by_code: true } },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockAuth.mockReturnValue({
    leaveOrganization: jest.fn(),
    refreshSession: jest.fn(),
    organization,
    user: { id: 'p', roles: isAdmin ? ['admin', 'tutor'] : ['tutor'] },
  });
  mockSettings.mockReturnValue({
    data: isAdmin ? { data: SETTINGS } : undefined,
    isPending: !isAdmin,
    isError: false,
    dataUpdatedAt: 1,
    refetch: jest.fn(),
  });
  mockNotifications.mockReturnValue({ data: isAdmin ? { data: LOG } : undefined, refetch: jest.fn() });
  mockOfferings.mockReturnValue({
    data: isAdmin ? { data: OFFERINGS } : undefined,
    isPending: !isAdmin,
    dataUpdatedAt: 1,
    refetch: jest.fn(),
  });
}

beforeEach(() => {
  mockTitles.length = 0;
  mockCode.mockReset();
  mockPatch.mockReset();
  mockPut.mockReset();
  mockOfferings.mockReset();
  mockSettings.mockReset();
  mockNotifications.mockReset();
});

describe('OrganizationSettingsScreen', () => {
  it('shows a non-admin the stub, and asks for nothing', async () => {
    asAdmin(false);
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByText('Only an administrator can see the space’s settings.')).toBeTruthy();
    expect(mockTitles).toContain('Space');
    expect(mockCode).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('space-code')).toBeNull();
    expect(mockSettings).toHaveBeenCalledWith(false);
    expect(mockNotifications).toHaveBeenCalledWith(false);
    expect(mockOfferings).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('org-tin')).toBeNull();
    expect(screen.queryByTestId('org-curricula')).toBeNull();
  });

  it('prefills the payer box and shows what the platform sets', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByTestId('org-tin').props.value).toBe('47-2019388');
    expect(screen.getByTestId('org-payer_city').props.value).toBe('Chapel Hill');
    expect(screen.getByText('Eastern time', { exact: false })).toBeTruthy();
  });

  it('refuses an SSN-shaped TIN on the device, with the shared sentence and no request', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    await fireEvent.changeText(screen.getByTestId('org-tin'), '123-45-6789');
    await fireEvent.press(screen.getByTestId('org-save'));
    expect(await screen.findByText(SSN_REJECTED_MESSAGE)).toBeTruthy();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('saves the payer fields only', async () => {
    asAdmin();
    mockPatch.mockResolvedValue({});
    await renderWithProviders(<OrganizationSettingsScreen />);
    await fireEvent.changeText(screen.getByTestId('org-payer_address_line1'), '200 Rosemary Street');
    await fireEvent.press(screen.getByTestId('org-save'));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({
        tin: '47-2019388',
        payer_address_line1: '200 Rosemary Street',
        payer_address_line2: '',
        payer_city: 'Chapel Hill',
        payer_state: 'NC',
        payer_postal_code: '27514',
      }),
    );
  });

  it('lists recent emails by name, kind and outcome', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByText('Maria Okafor')).toBeTruthy();
    expect(screen.getByText(/Session recorded · Sofia Okafor/)).toBeTruthy();
    expect(screen.getByText('Not sent here')).toBeTruthy();
    expect(screen.getByText('Not delivered')).toBeTruthy();
    // The subject is not repeated when the email went to them.
    expect(screen.queryByText(/Added to the organization · Ben Whitfield/)).toBeNull();
  });

  it('shows every card, and every set, where all three are allowed', async () => {
    asAdmin(true, { ...ORGANIZATION, feature_tutoring: true, feature_assessment: true, feature_quest: true });
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByTestId('org-payer')).toBeTruthy();
    expect(screen.getByTestId('org-assessments')).toBeTruthy();
    expect(screen.getByTestId('org-gamification')).toBeTruthy();
    expect(within(screen.getByTestId('org-features')).getByText('Tutoring, Assessment and Quest')).toBeTruthy();
  });

  it('shows only the allowed sets’ cards: Assessment alone has no payer and no money', async () => {
    asAdmin(true, { ...ORGANIZATION, feature_tutoring: false, feature_assessment: true, feature_quest: false });
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.queryByTestId('org-payer')).toBeNull();
    expect(screen.queryByTestId('org-tin')).toBeNull();
    expect(screen.queryByTestId('org-gamification')).toBeNull();
    expect(screen.getByTestId('org-assessments')).toBeTruthy();
    expect(screen.getByTestId('org-notifications')).toBeTruthy();
    expect(screen.getByTestId('org-curricula')).toBeTruthy();
    expect(within(screen.getByTestId('org-features')).getByText('Assessment')).toBeTruthy();
  });

  it('says so when nothing has been sent yet', async () => {
    asAdmin();
    mockNotifications.mockReturnValue({ data: { data: [] }, refetch: jest.fn() });
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByText('Recent emails')).toBeTruthy();
    expect(screen.getByTestId('org-notifications-empty')).toBeTruthy();
    expect(screen.getByText('Nothing sent yet.')).toBeTruthy();
    expect(screen.queryByText('Maria Okafor')).toBeNull();
  });
});

describe('CurriculaCard', () => {
  it('lists every curriculum with its standing; the default cannot be switched off', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.getByTestId('org-curriculum-ba')).toBeTruthy();
    expect(screen.getByText('NC Math (2017)')).toBeTruthy();
    expect(screen.getByText('Retired')).toBeTruthy();
    expect(screen.getByTestId('org-curriculum-offer-ba').props.accessibilityState.disabled).toBe(true);
    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByTestId('org-curricula-save').props.accessibilityState.disabled).toBe(true);
  });

  it('offers one more, moves the default to it, and saves the whole choice', async () => {
    asAdmin();
    mockPut.mockResolvedValue({ data: OFFERINGS });
    await renderWithProviders(<OrganizationSettingsScreen />);
    await fireEvent(screen.getByTestId('org-curriculum-offer-nc-2017'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('org-curriculum-default-nc-2017'));
    await fireEvent(screen.getByTestId('org-curriculum-offer-ba'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('org-curricula-save'));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith({ offered: ['nc-2017'], default_curriculum_id: 'nc-2017' }),
    );
  });

  it('says what the server refused, under the card', async () => {
    asAdmin();
    mockPut.mockRejectedValue(
      new ApiRequestError(422, 'validation_failed', 'Please correct the highlighted fields.', {
        offered: ['Not a curriculum this organization can offer: x.'],
      }),
    );
    await renderWithProviders(<OrganizationSettingsScreen />);
    await fireEvent(screen.getByTestId('org-curriculum-offer-nc-2026'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('org-curricula-save'));
    expect(await screen.findByText('Not a curriculum this organization can offer: x.')).toBeTruthy();
  });
});

describe('validateForm', () => {
  it('passes blanks and a ZIP, refuses a bad ZIP', () => {
    expect(
      validateForm({
        tin: '',
        payer_address_line1: '',
        payer_address_line2: '',
        payer_city: '',
        payer_state: '',
        payer_postal_code: '27514',
      }).ok,
    ).toBe(true);
    const verdict = validateForm({
      tin: '',
      payer_address_line1: '',
      payer_address_line2: '',
      payer_city: '',
      payer_state: '',
      payer_postal_code: '275',
    });
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.errors.payer_postal_code).toBe('Use a 5-digit ZIP code.');
  });
});

describe('featureSetsLabel', () => {
  it('joins the allowed sets in words', () => {
    expect(featureSetsLabel([])).toBe('None yet');
    expect(featureSetsLabel(['assessment'])).toBe('Assessment');
    expect(featureSetsLabel(['tutoring', 'assessment'])).toBe('Tutoring and Assessment');
    expect(featureSetsLabel(['tutoring', 'assessment', 'quest'])).toBe('Tutoring, Assessment and Quest');
  });
});

describe('OrganizationSettingsScreen: spaces (Phase 52)', () => {
  it('is titled Space, and leads with the code, ends with leaving', async () => {
    asAdmin();
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(mockTitles).toContain('Space');
    expect(screen.getByTestId('space-code-value')).toHaveTextContent('FMXY-2345');
    expect(screen.getByTestId('space-code-value').props.accessibilityLabel).toBe('Code F M X Y, 2 3 4 5');
    expect(screen.getByTestId('space-leave')).toBeTruthy();
    // A console-made space: no delete, and its email card.
    expect(screen.queryByTestId('space-delete')).toBeNull();
    expect(screen.getByTestId('org-notifications')).toBeTruthy();
  });

  it('has no email card in a self-serve space, and does not ask for its log; its admin may delete it', async () => {
    asAdmin(true, { ...ORGANIZATION, created_via: 'self_serve', feature_tutoring: false, feature_assessment: true });
    await renderWithProviders(<OrganizationSettingsScreen />);
    expect(screen.queryByTestId('org-notifications')).toBeNull();
    expect(mockNotifications).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('space-delete')).toBeTruthy();
  });
});

