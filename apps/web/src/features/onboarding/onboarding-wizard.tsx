import {
  ArrowLeftIcon,
  CheckIcon,
  CompassIcon,
  GraduationCapIcon,
  UserPlusIcon,
} from 'lucide-react';

import { featureOn, tourOffered } from '@tmi/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBrand } from '@/providers/brand-provider';
import { useAuth } from '@/providers/auth-provider';
import { InvitePeople } from '@/features/organizations/invite-people';
import { clearInviteStep } from '@/features/organizations/invite-step';
import { ConfirmDetails } from './confirm-details';
import { StudentFlow } from './student-flow';
import { TutorFlow } from './tutor-flow';

export type WizardScreen = 'invite' | 'welcome' | 'student' | 'tutor' | 'confirm' | 'done';

const HEADINGS: Record<Exclude<WizardScreen, 'welcome' | 'invite'>, { title: string; description: string }> = {
  student: {
    title: 'Add a student',
    description: 'The family first, then the student, then what comes next: a tutor, a weekly lesson.',
  },
  tutor: {
    title: 'Add a tutor',
    description: 'Who they are, how they are paid, when they can teach, and their students.',
  },
  confirm: {
    title: 'Confirm your details',
    description: 'One last thing: check the office has you right.',
  },
  done: { title: 'You’re all set', description: 'Getting started on the dashboard brings this back.' },
};

/**
 * The welcome wizard (Phase 26). An admin chooses: the tour, adding a
 * student, adding a tutor. Everyone else takes the tour and then confirms
 * the details the office keeps on them. Closing it at any point is fine --
 * whatever was added stays.
 */
export function OnboardingWizard({
  open,
  screen,
  onScreen,
  isAdmin,
  tourDone,
  onStartTour,
  onClose,
  onNavigate,
}: {
  open: boolean;
  screen: WizardScreen;
  onScreen: (screen: WizardScreen) => void;
  isAdmin: boolean;
  tourDone: boolean;
  onStartTour: () => void;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const brand = useBrand();
  const { user, organization } = useAuth();
  const tutoring = featureOn(organization, 'tutoring');
  const firstName = user?.full_name.split(' ')[0] ?? '';

  const heading =
    screen === 'welcome'
      ? {
          title: `Welcome to ${brand.short}${firstName ? `, ${firstName}` : ''}`,
          // The tour is Tutoring's (owner, 2026-11-04): where it is not offered, the heading does not promise it.
          description: isAdmin
            ? tourOffered(organization)
              ? tutoring
                ? 'A quick tour, and guided setup for a new student or tutor.'
                : 'A quick tour, and guided setup for a new student.'
              : tutoring
                ? 'Guided setup for a new student or tutor.'
                : 'Guided setup for a new student.'
            : tourOffered(organization)
              ? 'A quick tour, then a check that the office has your details right.'
              : 'A check that the office has your details right.',
        }
      : screen === 'invite'
        ? {
            // Phase 61 (S12): straight after starting a space, before the tour.
            title: 'Invite people',
            description: `Ask the adults who will use ${organization?.name ?? 'your space'} to join you. They accept when they sign in.`,
          }
        : HEADINGS[screen];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="onboarding-wizard">
        <DialogHeader>
          <DialogTitle>{heading.title}</DialogTitle>
          <DialogDescription>{heading.description}</DialogDescription>
        </DialogHeader>

        {screen !== 'welcome' && screen !== 'done' && screen !== 'invite' && (
          <Button variant="ghost" size="sm" className="-mt-2 justify-self-start" onClick={() => onScreen('welcome')}>
            <ArrowLeftIcon />
            Back to the start
          </Button>
        )}

        {screen === 'invite' && isAdmin && <InvitePeople
            onDone={() => {
              clearInviteStep();
              onScreen('welcome');
            }}
          />}

        {screen === 'welcome' && (
          <div className="grid gap-3">
            {/* The tour is Tutoring's (owner, 2026-11-04): a new space without it never offers it (UI audit J06). */}
            {tourOffered(organization) && (
              <Choice
                icon={CompassIcon}
                title="Take the tour"
                description="Your home and the menu, one part at a time, with what each is for."
                badge={tourDone ? 'Done' : 'Tour'}
                action="Take the tour"
                onClick={onStartTour}
              />
            )}

            {isAdmin && (
              <>
                <Choice
                  icon={GraduationCapIcon}
                  title="Add a student"
                  description={
                    tutoring
                      ? 'Create or pick the family, add the student, then pair them with a tutor and set a weekly lesson.'
                      : 'Create or pick the family, then add the student.'
                  }
                  action="Add a student"
                  onClick={() => onScreen('student')}
                />
                {tutoring && <Choice
                  icon={UserPlusIcon}
                  title="Add a tutor"
                  description="Their details, then how they are paid, when they can teach, and their students."
                  action="Add a tutor"
                  onClick={() => onScreen('tutor')}
                />}
              </>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {!isAdmin && (
                <Button variant="outline" onClick={() => onScreen('confirm')}>
                  Confirm my details
                </Button>
              )}
              <Button variant={isAdmin ? 'default' : 'ghost'} onClick={onClose}>
                {isAdmin ? 'I’m done' : 'Skip for now'}
              </Button>
            </div>
          </div>
        )}

        {screen === 'student' && isAdmin && (
          <StudentFlow onNavigate={onNavigate} onBack={() => onScreen('welcome')} />
        )}
        {screen === 'tutor' && isAdmin && tutoring && (
          <TutorFlow onNavigate={onNavigate} onBack={() => onScreen('welcome')} />
        )}
        {screen === 'confirm' && <ConfirmDetails onDone={() => onScreen('done')} />}

        {screen === 'done' && (
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm">
              <CheckIcon className="text-success size-4" />
              That’s everything. Welcome aboard.
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  icon: Icon,
  title,
  description,
  badge,
  action,
  onClick,
}: {
  icon: typeof CompassIcon;
  title: string;
  description: string;
  badge?: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {title}
          {badge && (
            <Badge variant={badge === 'Done' ? 'secondary' : 'outline'} className="text-[10px]">
              {badge === 'Done' && <CheckIcon />}
              {badge}
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}
