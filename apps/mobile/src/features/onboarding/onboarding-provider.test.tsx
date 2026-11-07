// Owner, 2026-11-04: the welcome wizard and the tour are Tutoring's (`tourOffered` in shared). Where Tutoring
// is off, the wizard never opens by itself and no tour is offered -- but a space just started on this device
// still opens on "Invite people", which is not the tour.
//
// Phase 74 (JF25): once per PERSON -- the server's record decides, so a new device offers nothing to somebody who
// has been through it; the one offer left (a first visit to a space by somebody who has) is a card in the home's
// flow (`TourOfferCard`), decided on entry, and closing the wizard -- which records the tour -- never brings it back.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { clearInviteStep, markInviteStep } from '@/features/organizations/invite-step';
import { OnboardingProvider, TourOfferCard, useOnboarding } from './onboarding-provider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useSegments: () => ['(org)', '(tabs)', 'index'],
}));
jest.mock('@/lib/haptics', () => ({ haptics: { selection: jest.fn() } }));
const mockRecord = jest.fn();
jest.mock('./api', () => ({ useFinishTour: () => ({ mutate: mockRecord }) }));
jest.mock('./tour', () => ({ Tour: () => null }));
jest.mock('@/providers/brand-provider', () => {
  const { PLATFORM_BRAND } = jest.requireActual('@tmi/shared');
  return { useBrand: () => ({ ...PLATFORM_BRAND, short: 'Chapel Hill' }) };
});

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));

const TUTORING = { slug: 'chmi', short_name: 'Chapel Hill', feature_tutoring: true, personal: false };
const NO_TUTORING = { ...TUTORING, slug: 'assess', feature_tutoring: false };

/** The home: it reports what it shows, and carries the offer's card at its top. */
function Home() {
  const { reportDashboard, wizardClosed } = useOnboarding();
  const [role, setRole] = useState<'admin' | 'tutor'>('admin');
  useEffect(() => reportDashboard({ role, viewingAs: false }), [reportDashboard, role]);
  return (
    <>
      <TourOfferCard />
      <Text>home</Text>
      {/* The wizard closing (its route unmounting), then a render of the provider. */}
      <Pressable
        testID="close-wizard"
        onPress={() => {
          wizardClosed();
          setRole('tutor');
        }}
      />
    </>
  );
}

function auth({
  organization,
  finished = null,
  firstVisit = false,
  roles = ['admin'],
}: {
  organization: Record<string, unknown>;
  finished?: string | null;
  firstVisit?: boolean;
  roles?: string[];
}) {
  return {
    user: { id: 'me', full_name: 'Ines Ferreira', roles },
    onboarding: { tour_finished_at: finished, tour_skipped_at: null },
    firstVisit,
    organization,
  };
}

async function show(options: Parameters<typeof auth>[0]) {
  mockAuth.mockReturnValue(auth(options));
  await renderWithProviders(
    <OnboardingProvider>
      <Home />
    </OnboardingProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  (router.navigate as jest.Mock).mockClear();
  mockRecord.mockClear();
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

  it('offers the first visit’s tour only where Tutoring is on', async () => {
    await show({ organization: NO_TUTORING, finished: '2026-10-01T00:00:00Z', firstVisit: true });
    expect(screen.queryByTestId('tour-offer')).toBeNull();
  });

  it('still opens "Invite people" in a space just started without Tutoring', async () => {
    markInviteStep('assess');
    await show({ organization: NO_TUTORING });
    expect(router.push).toHaveBeenCalledWith('/onboarding/invite');
  });
});

describe('Phase 79 (M6): no wizard or tour for a member (no role)', () => {
  it('never opens the wizard for a member, even where Tutoring is on', async () => {
    await show({ organization: TUTORING, roles: [] });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('never offers a member the first visit’s tour', async () => {
    await show({ organization: TUTORING, roles: [], finished: '2026-10-01T00:00:00Z', firstVisit: true });
    expect(screen.queryByTestId('tour-offer')).toBeNull();
  });
});

describe('Phase 74 (JF25): once per person, and in the page', () => {
  it('a new device offers nothing to somebody who has been through it', async () => {
    await show({ organization: TUTORING, finished: '2026-10-01T00:00:00Z' });
    expect(screen.queryByTestId('tour-offer')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('a first visit to a space, having been through it: a card at the top of the home; No thanks puts it away', async () => {
    await show({ organization: TUTORING, finished: '2026-10-01T00:00:00Z', firstVisit: true });
    expect(screen.getByTestId('tour-offer-title')).toHaveTextContent('Welcome to Chapel Hill');
    expect(screen.getByTestId('tour-offer')).toHaveTextContent(/A quick tour of what is where\./);
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('tour-offer-dismiss'));
    expect(screen.queryByTestId('tour-offer')).toBeNull();
  });

  it('Take the tour starts it on the home, and the card goes', async () => {
    await show({ organization: TUTORING, finished: '2026-10-01T00:00:00Z', firstVisit: true });
    await fireEvent.press(screen.getByTestId('tour-offer-take'));
    expect(router.navigate).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByTestId('tour-offer')).toBeNull();
  });

  it('closing the wizard on a first visit records the tour and never brings the offer back', async () => {
    await show({ organization: TUTORING, firstVisit: true });
    expect(router.push).toHaveBeenCalledWith('/onboarding');
    expect(screen.queryByTestId('tour-offer')).toBeNull();
    // The wizard closes: the tour is recorded as skipped, and the server's answer now says it was finished.
    mockAuth.mockReturnValue(auth({ organization: TUTORING, finished: '2026-11-05T12:00:00Z', firstVisit: true }));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('close-wizard'));
    });
    expect(mockRecord).toHaveBeenCalledWith('skipped');
    expect(screen.queryByTestId('tour-offer')).toBeNull();
  });
});
