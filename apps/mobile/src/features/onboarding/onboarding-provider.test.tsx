// Owner, 2026-11-04: the welcome wizard and the tour are Tutoring's (`tourOffered` in shared). Where Tutoring
// is off, the wizard never opens by itself and no tour is offered -- but a space just started on this device
// still opens on "Invite people", which is not the tour.
import { act, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { clearInviteStep, markInviteStep } from '@/features/organizations/invite-step';
import { OnboardingProvider, useOnboarding } from './onboarding-provider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useSegments: () => ['(org)', '(tabs)', 'index'],
}));
jest.mock('@/lib/storage', () => ({
  STORAGE_KEYS: { tourSeen: 'tourSeen' },
  readPref: jest.fn(async () => mockSeen.current),
  writePref: jest.fn(async () => undefined),
}));
const mockSeen = { current: null as string | null };
jest.mock('./api', () => ({ useFinishTour: () => ({ mutate: jest.fn() }) }));
jest.mock('./tour', () => ({ Tour: () => null }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));

const TUTORING = { slug: 'chmi', short_name: 'Chapel Hill', feature_tutoring: true, personal: false };
const NO_TUTORING = { ...TUTORING, slug: 'assess', feature_tutoring: false };

function Dashboard() {
  const { reportDashboard } = useOnboarding();
  useEffect(() => reportDashboard({ role: 'admin', viewingAs: false }), [reportDashboard]);
  return <Text>home</Text>;
}

async function show({
  organization,
  finished = null,
  firstVisit = false,
}: {
  organization: Record<string, unknown>;
  finished?: string | null;
  firstVisit?: boolean;
}) {
  mockAuth.mockReturnValue({
    user: { id: 'me', full_name: 'Ines Ferreira', roles: ['admin'] },
    onboarding: { tour_finished_at: finished, tour_skipped_at: null },
    firstVisit,
    organization,
  });
  await renderWithProviders(
    <OnboardingProvider>
      <Dashboard />
    </OnboardingProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  mockSeen.current = null;
  clearInviteStep();
});

describe('OnboardingProvider: the tour is Tutoring’s', () => {
  it('opens the wizard by itself where Tutoring is on', async () => {
    await show({ organization: TUTORING });
    expect(router.push).toHaveBeenCalledWith('/onboarding');
  });

  it('never opens the wizard where Tutoring is off', async () => {
    await show({ organization: NO_TUTORING });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('offers the tour on a new device only where Tutoring is on', async () => {
    await show({ organization: TUTORING, finished: '2026-10-01T00:00:00Z' });
    expect(screen.getByTestId('tour-offer')).toBeTruthy();
    await show({ organization: NO_TUTORING, finished: '2026-10-01T00:00:00Z', firstVisit: true });
    expect(screen.queryByTestId('tour-offer')).toBeNull();
  });

  it('still opens "Invite people" in a space just started without Tutoring', async () => {
    markInviteStep('assess');
    await show({ organization: NO_TUTORING });
    expect(router.push).toHaveBeenCalledWith('/onboarding/invite');
  });
});
