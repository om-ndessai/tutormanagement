// Ported from apps/web/src/features/onboarding/onboarding-provider.tsx @ 1132322.
//
// The welcome wizard and feature tour (Phase 26), for everything inside an organization. Opens by
// itself once per person: the database says whether they have been through it. A device that has
// not shown it -- no `tourSeen` flag, the web's `tmi_tour_seen` cookie -- offers the tour to
// somebody who has, rather than opening it. Never while an admin is viewing somebody else's
// dashboard: the dashboard reports what it shows, and the decision waits for that report.
//
// The wizard is a route (`(org)/onboarding/*`, a full-screen modal) so that the app's own form
// sheets can open over it; the tour is an overlay over the dashboard, drawn here.
import type { TourOutcome, UserRole } from '@tmi/shared';
import { router } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useFinishTour } from './api';
import { decideOnboarding, primaryRole, screenAfterTour } from './onboarding-model';
import { Tour } from './tour';
import { TourTargetsProvider } from './tour-targets';
import { TOUR_STEPS } from './tour-steps';

export type WizardScreen = 'welcome' | 'student' | 'tutor' | 'confirm' | 'done';

const WIZARD_HREF = {
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

  const [deviceSeen, setDeviceSeen] = useState<boolean | null>(null);
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null);
  const [touring, setTouring] = useState<null | 'wizard' | 'offer'>(null);
  const [offer, setOffer] = useState(false);
  // Someone who has been through the tour, opening an organization for the first time, is offered
  // it again there: the people and roles are new.
  const [offerTitle, setOfferTitle] = useState('New here on this device?');
  const [tourDone, setTourDone] = useState(false);
  const decided = useRef(false);

  // Read inside callbacks that outlive a render (the wizard's unmount).
  const wizardOpen = useRef(false);
  const leavingForTour = useRef(false);
  const tourDoneRef = useRef(false);
  const onboardingRef = useRef(onboarding);
  useEffect(() => {
    onboardingRef.current = onboarding;
  }, [onboarding]);

  const isAdmin = user?.roles.includes('admin') ?? false;

  useEffect(() => {
    let cancelled = false;
    void readPref(STORAGE_KEYS.tourSeen).then((value) => {
      if (!cancelled) setDeviceSeen(value === '1');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markDeviceSeen = useCallback(() => {
    setDeviceSeen(true);
    void writePref(STORAGE_KEYS.tourSeen, '1');
  }, []);

  const openWizard = useCallback((screen: WizardScreen = 'welcome') => {
    setOffer(false);
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
    if (decided.current || !user || !onboarding || deviceSeen === null || !dashboard) return;
    decided.current = true;
    const decision = decideOnboarding({ onboarding, deviceSeen, viewingAs: dashboard.viewingAs });
    if (decision === 'wizard') openWizard('welcome');
    else if (decision === 'offer') setOffer(true);
  }, [user, onboarding, deviceSeen, dashboard, openWizard]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!firstVisit || !onboarding?.tour_finished_at || !organization) return;
    if (!dashboard || dashboard.viewingAs) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the API's answer, once per entry
    setOfferTitle(`Welcome to ${organization.short_name}`);
    setOffer(true);
  }, [firstVisit, onboarding?.tour_finished_at, organization, dashboard]);

  /**
   * The wizard has closed, recording that this person has been through it the first time they do
   * -- finished if they took the tour, skipped if not. Leaving it for the tour is not closing it.
   */
  const wizardClosed = useCallback(() => {
    wizardOpen.current = false;
    if (leavingForTour.current) return;
    markDeviceSeen();
    if (onboardingRef.current && !onboardingRef.current.tour_finished_at) {
      recordTour(tourDoneRef.current ? 'completed' : 'skipped');
    }
  }, [recordTour, markDeviceSeen]);

  /**
   * The tour runs on the dashboard, over the page itself. From the wizard, the wizard closes
   * itself once this has marked that it is leaving for the tour (not being closed).
   */
  const beginTour = useCallback((from: 'wizard' | 'offer') => {
    setOffer(false);
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
      markDeviceSeen();
      if (outcome === 'completed') {
        tourDoneRef.current = true;
        setTourDone(true);
      }
      // Back to the wizard: an admin to its start, with the tour ticked; anyone else on to
      // confirming their details.
      if (from === 'wizard') openWizard(screenAfterTour(isAdmin));
    },
    [touring, isAdmin, markDeviceSeen, openWizard],
  );

  const reportDashboard = useCallback((report: DashboardReport) => {
    setDashboard((current) =>
      current && current.role === report.role && current.viewingAs === report.viewingAs ? current : report,
    );
  }, []);

  const steps = useMemo(
    () => (user ? TOUR_STEPS[dashboard?.role ?? primaryRole(user.roles)] : []),
    [user, dashboard?.role],
  );

  const value = useMemo(
    () => ({
      openWizard,
      startTour: () => beginTour('wizard'),
      wizardClosed,
      reportDashboard,
      tourDone,
    }),
    [openWizard, beginTour, wizardClosed, reportDashboard, tourDone],
  );

  return (
    <OnboardingContext value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {touring ? <Tour steps={steps} onDone={endTour} /> : null}
        {offer && !touring ? (
          <TourOffer
            title={offerTitle}
            onTake={() => beginTour('offer')}
            onDismiss={() => {
              setOffer(false);
              markDeviceSeen();
            }}
          />
        ) : null}
      </View>
    </OnboardingContext>
  );
}

/**
 * For somebody who has been through the wizard, on a device that has not shown it: an offer, not
 * the wizard. Out of the way above the tab bar, and gone for good on this device once answered.
 */
function TourOffer({
  title,
  onTake,
  onDismiss,
}: {
  title: string;
  onTake: () => void;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Surface
        testID="tour-offer"
        elevation={3}
        accessibilityRole="alert"
        style={{
          position: 'absolute',
          left: space.lg,
          right: space.lg,
          bottom: insets.bottom + 100,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.xs,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton
            icon="compass-outline"
            size={18}
            iconColor={theme.colors.primary}
            style={{ margin: 0 }}
          />
          <Text testID="tour-offer-title" variant="titleSmall" style={{ flex: 1 }}>
            {title}
          </Text>
          <IconButton
            testID="tour-offer-close"
            icon="close"
            size={18}
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            style={{ margin: 0 }}
          />
        </View>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          A two-minute tour of what is where.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Button testID="tour-offer-take" mode="contained" compact onPress={onTake}>
            Take the tour
          </Button>
          <Button testID="tour-offer-dismiss" mode="text" compact onPress={onDismiss}>
            No thanks
          </Button>
        </View>
      </Surface>
    </View>
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
