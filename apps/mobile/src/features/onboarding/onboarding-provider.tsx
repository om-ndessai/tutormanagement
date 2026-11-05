// Ported from apps/web/src/features/onboarding/onboarding-provider.tsx @ 1132322.
//
// The welcome wizard and feature tour (Phase 26), for everything inside an organization. Opens by
// itself once per PERSON: the database says whether they have been through it (`tour_finished_at`).
// Never while an admin is viewing somebody else's dashboard: the dashboard reports what it shows, and
// the decision waits for that report.
//
// Phase 74 (JF25, docs/journey-fixes-plan.md): a new device no longer offers the tour again -- the
// server alone decides, so it is offered once per person (the device's `tourSeen` flag is gone). The
// one offer left is a first visit to a space by somebody who had been through it before (the people
// and roles are new there), decided once on entry: closing the wizard -- which records the tour --
// never brings it back. And the offer is a card at the top of the home (`TourOfferCard`), in the page's
// flow, not a layer over the work.
//
// The wizard is a route (`(org)/onboarding/*`, a full-screen modal) so that the app's own form
// sheets can open over it; the tour is an overlay over the dashboard, drawn here.
import { tourOffered, type TourOutcome, type UserRole } from '@tmi/shared';
import { router } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { clearInviteStep, hasInviteStep } from '@/features/organizations/invite-step';
import { useFinishTour } from './api';
import { decideOnboarding, primaryRole, screenAfterTour } from './onboarding-model';
import { Tour } from './tour';
import { TourTargetsProvider } from './tour-targets';
import { tourStepsFor } from './tour-steps';

export type WizardScreen = 'invite' | 'welcome' | 'student' | 'tutor' | 'confirm' | 'done';

const WIZARD_HREF = {
  invite: '/onboarding/invite',
  welcome: '/onboarding',
  student: '/onboarding/student',
  tutor: '/onboarding/tutor',
  confirm: '/onboarding/confirm',
  done: '/onboarding/done',
} as const;

interface DashboardReport {
  role: UserRole | null;
  viewingAs: boolean;
}

interface OnboardingContextValue {
  /** Opens the welcome wizard -- the account menu's and Search's "Take the tour". */
  openWizard: (screen?: WizardScreen) => void;
  /** The wizard's "Take the tour": the wizard then closes itself, and the dashboard is toured. */
  startTour: () => void;
  /** The wizard route has closed, however it was closed. */
  wizardClosed: () => void;
  /** The dashboard says which role it is showing, and whether it is somebody else's. */
  reportDashboard: (report: DashboardReport) => void;
  /** Whether the tour has been taken in this run (the wizard ticks its choice). */
  tourDone: boolean;
  /** Phase 74 (JF25): the first-visit offer is waiting for its card at the top of the home. */
  offer: boolean;
  /** The offer's Take the tour. */
  takeOffer: () => void;
  /** The offer's No thanks (or its close): gone for this entry. */
  dismissOffer: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  return (
    <TourTargetsProvider>
      <OnboardingHost>{children}</OnboardingHost>
    </TourTargetsProvider>
  );
}

function OnboardingHost({ children }: { children: ReactNode }) {
  const { user, onboarding, firstVisit, organization } = useAuth();
  const { mutate: recordTour } = useFinishTour();

  const [dashboard, setDashboard] = useState<DashboardReport | null>(null);
  const [touring, setTouring] = useState<null | 'wizard' | 'offer'>(null);
  const [offer, setOffer] = useState(false);
  const [tourDone, setTourDone] = useState(false);
  const decided = useRef(false);
  // Phase 74 (JF25): whether the person had been through the tour when they entered (the first-visit offer is
  // for them alone), and whether this run has already opened the wizard or the tour, or answered the offer --
  // after any of those, no offer comes (closing the wizard records the tour, which once brought it straight back).
  const finishedOnEntry = useRef(false);
  const answered = useRef(false);

  // Read inside callbacks that outlive a render (the wizard's unmount).
  const wizardOpen = useRef(false);
  const leavingForTour = useRef(false);
  const tourDoneRef = useRef(false);
  const onboardingRef = useRef(onboarding);
  useEffect(() => {
    onboardingRef.current = onboarding;
  }, [onboarding]);

  const isAdmin = user?.roles.includes('admin') ?? false;

  const openWizard = useCallback((screen: WizardScreen = 'welcome') => {
    setOffer(false);
    answered.current = true;
    if (wizardOpen.current) {
      router.navigate(WIZARD_HREF[screen]);
      return;
    }
    wizardOpen.current = true;
    router.push(WIZARD_HREF[screen]);
  }, []);

  // Once per organization, as soon as we know who this is and what the dashboard shows. A one-off
  // decision, not a sync of state to state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (decided.current || !user || !onboarding || !dashboard) return;
    decided.current = true;
    finishedOnEntry.current = Boolean(onboarding.tour_finished_at);
    // Phase 61 (S12): a space this run has just started opens on "Invite people" first, whether or
    // not its maker has been through the wizard elsewhere.
    if (hasInviteStep(organization?.slug) && user.roles.includes('admin')) {
      openWizard('invite');
      return;
    }
    // Owner, 2026-11-04: the tour is Tutoring's; a space without it starts on its home (no wizard, no
    // offer). The just-started space's "Invite people" above is not the tour and still opens.
    if (!tourOffered(organization)) return;
    const decision = decideOnboarding({ onboarding, viewingAs: dashboard.viewingAs });
    // Phase 63 (P13): a newcomer's personal space opens on the Play home itself, never the wizard.
    if (decision === 'wizard' && !organization?.personal) openWizard('welcome');
  }, [user, onboarding, dashboard, openWizard, organization]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // A first visit to this space by somebody who had already been through the tour: offered once, on the home.
  useEffect(() => {
    if (!firstVisit || !organization || !tourOffered(organization) || organization.personal) return;
    if (!decided.current || !finishedOnEntry.current || answered.current) return;
    if (!dashboard || dashboard.viewingAs) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the API's answer, once per entry
    setOffer(true);
  }, [firstVisit, organization, dashboard, onboarding]);

  /**
   * The wizard has closed, recording that this person has been through it the first time they do
   * -- finished if they took the tour, skipped if not. Leaving it for the tour is not closing it.
   */
  const wizardClosed = useCallback(() => {
    wizardOpen.current = false;
    clearInviteStep();
    if (leavingForTour.current) return;
    if (onboardingRef.current && !onboardingRef.current.tour_finished_at) {
      recordTour(tourDoneRef.current ? 'completed' : 'skipped');
    }
  }, [recordTour]);

  /**
   * The tour runs on the dashboard, over the page itself. From the wizard, the wizard closes
   * itself once this has marked that it is leaving for the tour (not being closed).
   */
  const beginTour = useCallback((from: 'wizard' | 'offer') => {
    setOffer(false);
    answered.current = true;
    if (from === 'wizard') {
      if (wizardOpen.current) leavingForTour.current = true;
    } else {
      router.navigate('/dashboard');
    }
    setTouring(from);
  }, []);

  const endTour = useCallback(
    (outcome: TourOutcome) => {
      const from = touring;
      setTouring(null);
      leavingForTour.current = false;
      if (outcome === 'completed') {
        tourDoneRef.current = true;
        setTourDone(true);
      }
      // Back to the wizard: an admin to its start, with the tour ticked; anyone else on to
      // confirming their details.
      if (from === 'wizard') openWizard(screenAfterTour(isAdmin));
    },
    [touring, isAdmin, openWizard],
  );

  const reportDashboard = useCallback((report: DashboardReport) => {
    setDashboard((current) =>
      current && current.role === report.role && current.viewingAs === report.viewingAs ? current : report,
    );
  }, []);

  const dismissOffer = useCallback(() => {
    answered.current = true;
    setOffer(false);
  }, []);

  const steps = useMemo(
    () => (user ? tourStepsFor(dashboard?.role ?? primaryRole(user.roles), organization) : []),
    [user, dashboard?.role, organization],
  );

  const value = useMemo(
    () => ({
      openWizard,
      startTour: () => beginTour('wizard'),
      wizardClosed,
      reportDashboard,
      tourDone,
      offer: offer && !touring,
      takeOffer: () => beginTour('offer'),
      dismissOffer,
    }),
    [openWizard, beginTour, wizardClosed, reportDashboard, tourDone, offer, touring, dismissOffer],
  );

  return (
    <OnboardingContext value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {touring ? <Tour steps={steps} onDone={endTour} /> : null}
      </View>
    </OnboardingContext>
  );
}

/**
 * Phase 74 (JF25): the tour's offer -- for somebody who has been through it, on their first visit to this space -- as a
 * card at the top of the home, in the page's flow: it covers nothing (it once sat over To record and Needs you). The
 * web's words, "A quick tour". Gone for this entry once answered.
 */
export function TourOfferCard() {
  const onboarding = useOptionalOnboarding();
  const theme = useAppTheme();
  const brand = useBrand();
  if (!onboarding?.offer) return null;
  return (
    <OutlinedCard testID="tour-offer" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {/* Decorative: an icon, not an unlabelled button (ux-audit F-20). */}
          <Icon source="compass-outline" size={18} color={theme.colors.primary} />
          <Text testID="tour-offer-title" variant="titleSmall" accessibilityRole="header" style={{ flex: 1 }}>
            {`Welcome to ${brand.short}`}
          </Text>
          <IconButton
            testID="tour-offer-close"
            icon="close"
            size={18}
            accessibilityLabel="Dismiss"
            onPress={() => {
              haptics.selection();
              onboarding.dismissOffer();
            }}
            style={{ margin: 0 }}
          />
        </View>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          A quick tour of what is where.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Button
            testID="tour-offer-take"
            mode="contained"
            compact
            contentStyle={{ minHeight: MIN_TARGET }}
            onPress={() => {
              haptics.selection();
              onboarding.takeOffer();
            }}
          >
            Take the tour
          </Button>
          <Button
            testID="tour-offer-dismiss"
            mode="text"
            compact
            contentStyle={{ minHeight: MIN_TARGET }}
            onPress={() => {
              haptics.selection();
              onboarding.dismissOffer();
            }}
          >
            No thanks
          </Button>
        </View>
      </View>
    </OutlinedCard>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = use(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return context;
}

/** For screens that may render outside the provider (tests): null there. */
export function useOptionalOnboarding(): OnboardingContextValue | null {
  return use(OnboardingContext);
}
