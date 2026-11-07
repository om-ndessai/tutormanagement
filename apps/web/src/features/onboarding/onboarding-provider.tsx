import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CompassIcon, XIcon } from 'lucide-react';
import { tourOffered, type TourOutcome, type UserRole } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { clearInviteStep, hasInviteStep } from '@/features/organizations/invite-step';
import { useFinishTour } from './api';
import { OnboardingWizard, type WizardScreen } from './onboarding-wizard';
import { Tour } from './tour';
import { TOUR_STEPS } from './tour-steps';

interface OnboardingContextValue {
  /** Opens the welcome wizard -- the dashboard's Getting started button. */
  openWizard: () => void;
  /** The dashboard says which role it is showing, so the tour matches it. */
  setDashboardRole: (role: UserRole | null) => void;
  /** Phase 74 (JF25): the tour offered on the home itself, in its flow, or null. */
  offer: { title: string } | null;
  takeOffer: () => void;
  dismissOffer: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** The role whose dashboard someone sees first, when the page has not said. */
function primaryRole(roles: readonly UserRole[]): UserRole {
  for (const role of ['admin', 'tutor', 'parent', 'student'] as const) {
    if (roles.includes(role)) return role;
  }
  return 'student';
}

/**
 * The welcome wizard and feature tour (Phase 26), for the whole signed-in
 * portal.
 *
 * Opens by itself once per PERSON (Phase 74, JF25): the database says whether
 * they have been through it, and a new browser or device does not offer it
 * again. Someone who has been through it, opening a space for the first time,
 * is offered it there once -- on the home, in the page's flow, never over it.
 * Never while an admin is viewing somebody else's dashboard.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, onboarding, firstVisit, organization } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const finishTour = useFinishTour();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [screen, setScreen] = useState<WizardScreen>('welcome');
  const [touring, setTouring] = useState<null | 'wizard' | 'offer'>(null);
  // Someone who has been through the tour, opening a space for the first
  // time, is offered it there: the people and roles are new.
  const [offer, setOffer] = useState<{ title: string } | null>(null);
  const [tourDone, setTourDone] = useState(false);
  const [dashboardRole, setDashboardRole] = useState<UserRole | null>(null);
  const decided = useRef(false);
  // Whether they had been through it when this page loaded: closing the wizard
  // now does not make a first visit offer it again at once (JF25).
  const [finishedAtLoad, setFinishedAtLoad] = useState<boolean | null>(null);
  // The space it was offered in on this load: answered once, it does not come back when the session refreshes.
  const offeredIn = useRef<string | null>(null);

  const isAdmin = user?.roles.includes('admin') ?? false;

  // Once per load, as soon as we know who this is.
  useEffect(() => {
    if (decided.current || !user || !onboarding) return;
    decided.current = true;
    setFinishedAtLoad(Boolean(onboarding.tour_finished_at));

    if (new URLSearchParams(location.search).has('as')) return;

    // Phase 61 (S12): a space this tab has just started opens on "Invite people" first.
    if (hasInviteStep(organization?.slug) && user.roles.includes('admin')) {
      setScreen('invite');
      setWizardOpen(true);
      return;
    }

    // Phase 63 (P13): a newcomer's personal space opens on the Play home itself, never the wizard
    // (the tour stays one tap away in the menu).
    if (organization?.personal) return;
    // Owner, 2026-11-04: the tour is Tutoring's; a space without it starts on its home. Phase 79 (M6): so does a
    // member (no role), whose menu leaves out the pages the tour walks through.
    if (!tourOffered(organization, user.roles)) return;

    // Once per person: someone who has been through it is not offered it again on a new browser (JF25).
    if (!onboarding.tour_finished_at) {
      setScreen('welcome');
      setWizardOpen(true);
    }
  }, [user, onboarding, organization, location.search]);

  const roles = user?.roles;
  useEffect(() => {
    if (!firstVisit || finishedAtLoad !== true || !organization || !roles || !tourOffered(organization, roles)) return;
    if (new URLSearchParams(location.search).has('as')) return;
    if (offeredIn.current === organization.slug) return;
    offeredIn.current = organization.slug;
    setOffer({ title: `Welcome to ${organization.short_name}` });
  }, [firstVisit, finishedAtLoad, organization, roles, location.search]);

  const openWizard = useCallback(() => {
    setOffer(null);
    setScreen('welcome');
    setWizardOpen(true);
  }, []);

  /**
   * Closes the wizard, recording that this person has been through it the
   * first time they do -- finished if they took the tour, skipped if not.
   */
  const closeWizard = useCallback(() => {
    setWizardOpen(false);
    clearInviteStep();
    if (onboarding && !onboarding.tour_finished_at) {
      finishTour.mutate(tourDone ? 'completed' : 'skipped');
    }
  }, [onboarding, tourDone, finishTour]);

  /** The tour runs on the dashboard, over the page itself. */
  const startTour = useCallback(
    (from: 'wizard' | 'offer') => {
      setWizardOpen(false);
      setOffer(null);
      if (location.pathname !== '/' && location.pathname !== '/dashboard') navigate('/');
      setTouring(from);
    },
    [location.pathname, navigate],
  );

  const endTour = useCallback(
    (outcome: TourOutcome) => {
      const from = touring;
      setTouring(null);
      if (outcome === 'completed') setTourDone(true);
      if (from !== 'wizard') return;

      // Back to the wizard: an admin to its start, with the tour ticked; anyone
      // else on to confirming their details.
      setScreen(isAdmin ? 'welcome' : 'confirm');
      setWizardOpen(true);
    },
    [touring, isAdmin],
  );

  const steps = useMemo(
    () => (user ? TOUR_STEPS[dashboardRole ?? primaryRole(user.roles)] : []),
    [user, dashboardRole],
  );

  const takeOffer = useCallback(() => startTour('offer'), [startTour]);
  const dismissOffer = useCallback(() => setOffer(null), []);
  const value = useMemo(
    () => ({ openWizard, setDashboardRole, offer: wizardOpen || touring ? null : offer, takeOffer, dismissOffer }),
    [openWizard, offer, wizardOpen, touring, takeOffer, dismissOffer],
  );

  return (
    <OnboardingContext value={value}>
      {children}

      {user && (
        <OnboardingWizard
          open={wizardOpen}
          screen={screen}
          onScreen={setScreen}
          isAdmin={isAdmin}
          tourDone={tourDone}
          onStartTour={() => startTour('wizard')}
          onClose={closeWizard}
          onNavigate={(path) => {
            closeWizard();
            navigate(path);
          }}
        />
      )}

      {touring && <Tour steps={steps} onDone={endTour} />}
    </OnboardingContext>
  );
}

/**
 * Phase 74 (JF25): the offer, for somebody who has been through the wizard and opens a space for the first time -- a
 * card at the top of the home, in the page's flow (never over the work it introduces), gone once answered.
 */
export function TourOfferCard() {
  const { offer, takeOffer, dismissOffer } = useOnboarding();
  if (!offer) return null;
  return (
    <Card className="relative py-0" role="region" aria-labelledby="tour-offer-title" data-testid="home-tour-offer">
      <CardContent className="flex flex-wrap items-center gap-3 p-4 pr-10 text-sm">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismissOffer}
          className="text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded p-1.5"
        >
          <XIcon className="size-4" />
        </button>
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <CompassIcon className="size-4" aria-hidden />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span id="tour-offer-title" className="font-medium">
            {offer.title}
          </span>
          <span className="text-muted-foreground">A quick tour of what is where, in two minutes.</span>
        </span>
        <span className="flex gap-2">
          <Button size="sm" onClick={takeOffer}>
            Take the tour
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissOffer}>
            No thanks
          </Button>
        </span>
      </CardContent>
    </Card>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = use(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return context;
}
