import type { OrganizationListItem } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { FeaturesSection } from './features-section';
import { OrganizationFormSheet, PaletteSwatches } from './organization-form-sheet';
import { PlatformPeopleScreen } from './platform-people-screen';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), canGoBack: () => false },
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('./logo-pipeline', () => ({ pickLogo: jest.fn(), LogoError: class extends Error {} }));

const mockLookup = jest.fn();
const mockUpdate = jest.fn();
const mockFeatures = jest.fn();
const mockSave = jest.fn();
let mockOrganizations: OrganizationListItem[] = [];
const mockSetModel = jest.fn();
const mockCreate = jest.fn();
jest.mock('./api', () => ({
  useLookupPerson: () => ({ mutateAsync: mockLookup, isPending: false }),
  useUpdatePerson: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useUnpinPerson: () => ({ mutate: jest.fn(), isPending: false }),
  useOrganizations: () => ({ data: { data: mockOrganizations }, isPending: false }),
  useCreateOrganization: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateOrganization: () => ({ mutateAsync: mockSave, isPending: false }),
  useUpdateOrganizationFeatures: () => ({ mutateAsync: mockFeatures, isPending: false }),
  useSetPaymentModel: () => ({ mutateAsync: mockSetModel, isPending: false }),
}));

const ALEX = {
  id: 'u3',
  full_name: 'Alex Chen',
  email: 'alex.chen.math@gmail.com',
  phone: '(984) 555-0113',
  google_sub_pinned: true,
  organization_count: 2,
};

describe('PlatformPeopleScreen', () => {
  beforeEach(() => {
    mockLookup.mockReset();
    mockUpdate.mockReset();
  });

  it('refuses a lookup that is not an email before asking the server', async () => {
    await renderWithProviders(<PlatformPeopleScreen />);
    await fireEvent.changeText(screen.getByTestId('platform-people-query'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('platform-people-find'));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('finds a person, shows their shared fields, and puts a taken email under the email', async () => {
    mockLookup.mockResolvedValue({ data: ALEX });
    mockUpdate.mockRejectedValue(
      new ApiRequestError(409, 'conflict', 'Another person already has that email address.'),
    );
    await renderWithProviders(<PlatformPeopleScreen />);
    await fireEvent.changeText(screen.getByTestId('platform-people-query'), 'alex.chen.math@gmail.com');
    await fireEvent.press(screen.getByTestId('platform-people-find'));
    expect(await screen.findByText('Belongs to 2 spaces.')).toBeTruthy();
    expect(mockLookup).toHaveBeenCalledWith('alex.chen.math@gmail.com');
    expect(screen.getByTestId('platform-person-unpin')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('platform-person-email'), 'priya.raghavan@gmail.com');
    await fireEvent.press(screen.getByTestId('platform-person-save'));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'u3',
        input: { full_name: 'Alex Chen', email: 'priya.raghavan@gmail.com', phone: '(984) 555-0113' },
      }),
    );
    expect(await screen.findByText('Another person already has that email address.')).toBeTruthy();
  });
});

describe('PaletteSwatches', () => {
  it('is a radio group with the chosen palette checked', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <PaletteSwatches palettes={['platform', 'teal']} value="teal" onChange={onChange} />,
    );
    expect(screen.getByTestId('org-form-palette-teal').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId('org-form-palette-platform').props.accessibilityState).toEqual({
      checked: false,
    });
    expect(screen.getByText('Slate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('org-form-palette-platform'));
    expect(onChange).toHaveBeenCalledWith('platform');
  });
});

const RIVERSIDE = {
  id: 'o2',
  short_name: 'Riverside',
  archived_at: null,
  feature_tutoring: true,
  feature_assessment: true,
  feature_quest: false,
} as unknown as OrganizationListItem;

describe('FeaturesSection (Phase 50)', () => {
  beforeEach(() => mockFeatures.mockReset().mockResolvedValue({}));

  it('shows each set’s switch as allowed or not', async () => {
    await renderWithProviders(<FeaturesSection organization={RIVERSIDE} />);
    expect(screen.getByTestId('platform-org-feature-tutoring').props.value).toBe(true);
    expect(screen.getByTestId('platform-org-feature-quest').props.value).toBe(false);
    expect(screen.getByLabelText('Allow Quest')).toBeTruthy();
  });

  it('allows at once, sending all three', async () => {
    await renderWithProviders(<FeaturesSection organization={RIVERSIDE} />);
    await fireEvent(screen.getByTestId('platform-org-feature-quest'), 'valueChange', true);
    await waitFor(() =>
      expect(mockFeatures).toHaveBeenCalledWith({
        id: 'o2',
        input: { feature_tutoring: true, feature_assessment: true, feature_quest: true },
      }),
    );
  });

  it('asks before disallowing, and saves only on confirming', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<FeaturesSection organization={RIVERSIDE} />);
    await fireEvent(screen.getByTestId('platform-org-feature-tutoring'), 'valueChange', false);
    expect(alert).toHaveBeenCalledWith(
      'Disallow Tutoring in Riverside?',
      'Everyone there stops seeing it, admins included. Nothing is deleted; allowing it again brings it back.',
      expect.any(Array),
    );
    expect(mockFeatures).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Disallow')!.onPress!();
    await waitFor(() =>
      expect(mockFeatures).toHaveBeenCalledWith({
        id: 'o2',
        input: { feature_tutoring: false, feature_assessment: true, feature_quest: false },
      }),
    );
    alert.mockRestore();
  });

  it('is read-only on an archived organization', async () => {
    await renderWithProviders(
      <FeaturesSection organization={{ ...RIVERSIDE, archived_at: '2026-10-01T00:00:00Z' }} />,
    );
    expect(screen.getByTestId('platform-org-feature-quest').props.disabled).toBe(true);
  });
});

describe('OrganizationFormSheet (Phase 50)', () => {
  it('offers the three feature sets when creating, Quest alone ticked (owner, 2026-11-04)', async () => {
    await renderWithProviders(<OrganizationFormSheet />);
    for (const set of ['tutoring', 'assessment', 'quest']) {
      expect(screen.getByTestId(`org-form-feature-${set}`)).toBeTruthy();
    }
    const checked = (set: string) => screen.getByTestId(`org-form-feature-${set}`).props.accessibilityState?.checked;
    expect(checked('quest')).toBe(true);
    expect(checked('tutoring')).toBe(false);
    expect(checked('assessment')).toBe(false);
    expect(
      screen.getByText('Its name, what it may use, and its look. Its admins come next, once it exists.'),
    ).toBeTruthy();
  });

  it('asks what it may use right after the name, before the address name', async () => {
    await renderWithProviders(<OrganizationFormSheet />);
    const ids: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const id = (node as { props?: { testID?: string } }).props?.testID;
      if (id && ['org-form-name', 'org-form-short', 'org-form-feature-tutoring', 'org-form-slug', 'org-form-place'].includes(id) && !ids.includes(id))
        ids.push(id);
      walk((node as { children?: unknown }).children);
    };
    walk(screen.toJSON());
    expect(ids).toEqual(['org-form-name', 'org-form-short', 'org-form-feature-tutoring', 'org-form-slug', 'org-form-place']);
  });

  it("shows the clock, who families pay and email notifications only while Tutoring is ticked", async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ data: RIVERSIDE });
    await renderWithProviders(<OrganizationFormSheet />);
    expect(screen.queryByTestId('org-form-tz')).toBeNull();
    expect(screen.queryByTestId('org-form-payment-model')).toBeNull();
    expect(screen.queryByTestId('org-form-notifications')).toBeNull();
    await fireEvent.press(screen.getByTestId('org-form-feature-tutoring'));
    expect(screen.getByTestId('org-form-tz')).toBeTruthy();
    expect(screen.getByTestId('org-form-payment-model')).toBeTruthy();
    expect(screen.getByTestId('org-form-notifications')).toBeTruthy();
    await fireEvent(screen.getByTestId('org-form-notifications'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('org-form-feature-tutoring'));
    expect(screen.queryByTestId('org-form-tz')).toBeNull();
    expect(screen.queryByTestId('org-form-payment-model')).toBeNull();
    expect(screen.queryByTestId('org-form-notifications')).toBeNull();
    // Hidden, not dropped: what was chosen still travels.
    await fireEvent.changeText(screen.getByTestId('org-form-name'), 'Hidden Values Academy');
    await fireEvent.changeText(screen.getByTestId('org-form-short'), 'HVA');
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      email_notifications: true,
      time_zone: 'America/New_York',
      feature_tutoring: false,
      feature_quest: true,
    });
  });

  it('editing a space without Tutoring hides those three fields too', async () => {
    mockOrganizations = [{ ...RIVERSIDE, feature_tutoring: false }];
    await renderWithProviders(<OrganizationFormSheet id={RIVERSIDE.id} />);
    expect(screen.getByTestId('org-form-quest-trusted')).toBeTruthy();
    expect(screen.queryByTestId('org-form-tz')).toBeNull();
    expect(screen.queryByTestId('org-form-payment-model')).toBeNull();
    expect(screen.queryByTestId('org-form-notifications')).toBeNull();
    mockOrganizations = [RIVERSIDE];
    await renderWithProviders(<OrganizationFormSheet id={RIVERSIDE.id} />);
    expect(screen.getByTestId('org-form-tz')).toBeTruthy();
    expect(screen.getByTestId('org-form-payment-model')).toBeTruthy();
    mockOrganizations = [];
  });

  it('offers the Quest trust only when editing, and sends it with the sets as they stand (Phase 51)', async () => {
    await renderWithProviders(<OrganizationFormSheet />);
    expect(screen.queryByTestId('org-form-quest-trusted')).toBeNull();
    mockOrganizations = [RIVERSIDE];
    mockSave.mockResolvedValue({ data: RIVERSIDE });
    mockFeatures.mockReset();
    mockFeatures.mockResolvedValue({ data: RIVERSIDE });
    await renderWithProviders(<OrganizationFormSheet id={RIVERSIDE.id} />);
    expect(screen.queryByTestId('org-form-feature-quest')).toBeNull();
    await fireEvent(screen.getByTestId('org-form-quest-trusted'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() =>
      expect(mockFeatures).toHaveBeenCalledWith({
        id: RIVERSIDE.id,
        input: {
          feature_tutoring: RIVERSIDE.feature_tutoring,
          feature_assessment: RIVERSIDE.feature_assessment,
          feature_quest: RIVERSIDE.feature_quest,
          quest_trusted: false,
          checked_questions: true,
        },
      }),
    );
    mockOrganizations = [];
  });

  it('offers checked questions only when editing, on unless off, and sends it in the features PUT (Phase 62)', async () => {
    await renderWithProviders(<OrganizationFormSheet />);
    expect(screen.queryByTestId('org-checked-questions-switch')).toBeNull();
    mockOrganizations = [RIVERSIDE];
    mockSave.mockResolvedValue({ data: RIVERSIDE });
    mockFeatures.mockReset();
    mockFeatures.mockResolvedValue({ data: RIVERSIDE });
    await renderWithProviders(<OrganizationFormSheet id={RIVERSIDE.id} />);
    expect(screen.getByTestId('org-checked-questions-switch').props.value).toBe(true);
    expect(screen.getByText('Checked questions (Beta)')).toBeTruthy();
    await fireEvent(screen.getByTestId('org-checked-questions-switch'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() =>
      expect(mockFeatures).toHaveBeenCalledWith({
        id: RIVERSIDE.id,
        input: {
          feature_tutoring: RIVERSIDE.feature_tutoring,
          feature_assessment: RIVERSIDE.feature_assessment,
          feature_quest: RIVERSIDE.feature_quest,
          quest_trusted: true,
          checked_questions: false,
        },
      }),
    );
    mockOrganizations = [];
  });

  it('sends no features PUT when the trust did not change', async () => {
    mockOrganizations = [RIVERSIDE];
    mockSave.mockResolvedValue({ data: RIVERSIDE });
    mockFeatures.mockReset();
    await renderWithProviders(<OrganizationFormSheet id={RIVERSIDE.id} />);
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockFeatures).not.toHaveBeenCalled();
    mockOrganizations = [];
  });
});

describe('who families pay (Phase 59, S2)', () => {
  const PAYER = {
    name: 'Fixture Payer',
    tin: '12-3456789',
    payer_address_line1: null,
    payer_address_line2: null,
    payer_city: null,
    payer_state: null,
    payer_postal_code: null,
  };

  it('offers the two choices, shows the payer fields for "The space" only, and puts a change first', async () => {
    const run = { ...RIVERSIDE, business: { id: 'b-1', name: 'Fixture Payer' }, payer: PAYER };
    mockOrganizations = [run];
    const order: string[] = [];
    mockSave.mockReset();
    mockSave.mockImplementation(async () => {
      order.push('patch');
      return { data: run };
    });
    mockSetModel.mockReset();
    mockSetModel.mockImplementation(async () => {
      order.push('model');
      return { data: run };
    });
    await renderWithProviders(<OrganizationFormSheet id={run.id} />);
    expect(screen.getByText('Who families pay')).toBeTruthy();
    expect(screen.getByText('The space')).toBeTruthy();
    expect(screen.getByText('Each tutor, directly')).toBeTruthy();
    expect(screen.getByTestId('org-form-payer')).toBeTruthy();
    expect(screen.getByTestId('org-form-payer-tin')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('org-form-payment-direct'));
    expect(screen.queryByTestId('org-form-payer')).toBeNull();
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() => expect(mockSetModel).toHaveBeenCalledWith({ id: run.id, model: 'direct' }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(order).toEqual(['model', 'patch']);
    expect(mockSave.mock.calls[0][0].input).not.toHaveProperty('tin');
    mockOrganizations = [];
  });

  it('starting to collect puts the model, then patches the payer details typed', async () => {
    const direct = { ...RIVERSIDE, business: null, payer: null };
    mockOrganizations = [direct];
    mockSave.mockReset();
    mockSave.mockResolvedValue({ data: direct });
    mockSetModel.mockReset();
    mockSetModel.mockResolvedValue({ data: direct });
    await renderWithProviders(<OrganizationFormSheet id={direct.id} />);
    expect(screen.queryByTestId('org-form-payer')).toBeNull();
    await fireEvent.press(screen.getByTestId('org-form-payment-space'));
    await fireEvent.changeText(screen.getByTestId('org-form-payer-tin'), '12-3456789');
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() => expect(mockSetModel).toHaveBeenCalledWith({ id: direct.id, model: 'space' }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0].input).toMatchObject({ tin: '12-3456789' });
    mockOrganizations = [];
  });

  it('puts nothing when who families pay did not change', async () => {
    const run = { ...RIVERSIDE, business: { id: 'b-1', name: 'Fixture Payer' }, payer: PAYER };
    mockOrganizations = [run];
    mockSave.mockReset();
    mockSave.mockResolvedValue({ data: run });
    mockSetModel.mockReset();
    await renderWithProviders(<OrganizationFormSheet id={run.id} />);
    await fireEvent.press(screen.getByTestId('org-form-save'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSetModel).not.toHaveBeenCalled();
    mockOrganizations = [];
  });
});
