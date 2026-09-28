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
import type { TourOutcome, UserRole } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { useFinishTour } from './api';
import { hasTourCookie, setTourCookie } from './cookie';
import { OnboardingWizard, type WizardScreen } from './onboarding-wizard';
import { Tour } from './tour';
import { TOUR_STEPS } from './tour-steps';

interface OnboardingContextValue {
  /** Opens the welcome wizard -- the dashboard's Getting started button. */
  openWizard: () => void;
  /** The dashboard says which role it is showing, so the tour matches it. */
  setDashboardRole: (role: UserRole | null) => void;
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
 * Opens by itself once per person: the database says whether they have been
 * through it. A browser that has not seen it -- no cookie -- offers the tour
 * to somebody who has, rather than opening it. Never while an admin is
 * viewing somebody else's dashboard.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, onboarding } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const finishTour = useFinishTour();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [screen, setScreen] = useState<WizardScreen>('welcome');
  const [touring, setTouring] = useState<null | 'wizard' | 'offer'>(null);
  const [offer, setOffer] = useState(false);
  const [tourDone, setTourDone] = useState(false);
  const [dashboardRole, setDashboardRole] = useState<UserRole | null>(null);
  const decided = useRef(false);

  const isAdmin = user?.roles.includes('admin') ?? false;

  // Once per load, as soon as we know who this is.
  useEffect(() => {
    if (decided.current || !user || !onboarding) return;
    decided.current = true;

    if (new URLSearchParams(location.search).has('as')) return;

    if (!onboarding.tour_finished_at) {
      setScreen('welcome');
      setWizardOpen(true);
    } else if (!hasTourCookie()) {
      setOffer(true);
    }
  }, [user, onboarding, location.search]);

  const openWizard = useCallback(() => {
    setOffer(false);
    setScreen('welcome');
    setWizardOpen(true);
  }, []);

  /**
   * Closes the wizard, recording that this person has been through it the
   * first time they do -- finished if they took the tour, skipped if not.
   */
  const closeWizard = useCallback(() => {
    setWizardOpen(false);
    setTourCookie();
    if (onboarding && !onboarding.tour_finished_at) {
      finishTour.mutate(tourDone ? 'completed' : 'skipped');
    }
  }, [onboarding, tourDone, finishTour]);

  /** The tour runs on the dashboard, over the page itself. */
  const startTour = useCallback(
    (from: 'wizard' | 'offer') => {
      setWizardOpen(false);
      setOffer(false);
      if (location.pathname !== '/' && location.pathname !== '/dashboard') navigate('/');
      setTouring(from);
    },
    [location.pathname, navigate],
  );

  const endTour = useCallback(
    (outcome: TourOutcome) => {
      const from = touring;
      setTouring(null);
      setTourCookie();
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

  const value = useMemo(() => ({ openWizard, setDashboardRole }), [openWizard]);

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

      {offer && !wizardOpen && !touring && (
        <TourOffer
          onTake={() => startTour('offer')}
          onDismiss={() => {
            setOffer(false);
            setTourCookie();
          }}
        />
      )}
    </OnboardingContext>
  );
}

/**
 * For somebody who has been through the wizard, on a browser that has not
 * seen it: an offer, not the wizard. Out of the way in a corner, and gone for
 * good on this browser once answered.
 */
function TourOffer({ onTake, onDismiss }: { onTake: () => void; onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-labelledby="tour-offer-title"
      className="bg-popover text-popover-foreground fixed right-4 bottom-4 left-4 z-[60] rounded-lg border p-4 shadow-xl sm:left-auto sm:w-80"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded p-1"
      >
        <XIcon className="size-4" />
      </button>
      <p id="tour-offer-title" className="flex items-center gap-2 pr-6 text-sm font-medium">
        <CompassIcon className="text-primary size-4" />
        New here on this device?
      </p>
      <p className="text-muted-foreground mt-1 text-sm">A two-minute tour of what is where.</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onTake}>
          Take the tour
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          No thanks
        </Button>
      </div>
    </div>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = use(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return context;
}
