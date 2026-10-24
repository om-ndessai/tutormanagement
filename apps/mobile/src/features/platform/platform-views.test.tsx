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
jest.mock('./api', () => ({
  useLookupPerson: () => ({ mutateAsync: mockLookup, isPending: false }),
  useUpdatePerson: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useUnpinPerson: () => ({ mutate: jest.fn(), isPending: false }),
  useOrganizations: () => ({ data: { data: [] }, isPending: false }),
  useCreateOrganization: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateOrganization: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateOrganizationFeatures: () => ({ mutateAsync: mockFeatures, isPending: false }),
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
    expect(await screen.findByText('Belongs to 2 organizations.')).toBeTruthy();
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
  it('ticks all three feature sets when creating', async () => {
    await renderWithProviders(<OrganizationFormSheet />);
    for (const set of ['tutoring', 'assessment', 'quest']) {
      expect(screen.getByTestId(`org-form-feature-${set}`)).toBeTruthy();
    }
    expect(screen.getAllByRole('checkbox', { checked: true }).length).toBeGreaterThanOrEqual(3);
  });
});
