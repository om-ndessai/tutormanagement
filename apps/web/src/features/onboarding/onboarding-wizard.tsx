import {
  ArrowLeftIcon,
  CheckIcon,
  CompassIcon,
  GraduationCapIcon,
  UserPlusIcon,
} from 'lucide-react';

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
import { ConfirmDetails } from './confirm-details';
import { StudentFlow } from './student-flow';
import { TutorFlow } from './tutor-flow';

export type WizardScreen = 'welcome' | 'student' | 'tutor' | 'confirm' | 'done';

const HEADINGS: Record<Exclude<WizardScreen, 'welcome'>, { title: string; description: string }> = {
  student: {
    title: 'Add a student',
    description: 'The family first, then the student, their assessment, their plan and a tutor.',
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
  const { user } = useAuth();
  const firstName = user?.full_name.split(' ')[0] ?? '';

  const heading =
    screen === 'welcome'
      ? {
          title: `Welcome to ${brand.short}${firstName ? `, ${firstName}` : ''}`,
          description: isAdmin
            ? 'A quick tour of the portal, and guided setup for a new student or tutor.'
            : 'A quick tour of the portal, then a check that the office has your details right.',
        }
      : HEADINGS[screen];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="onboarding-wizard">
        <DialogHeader>
          <DialogTitle>{heading.title}</DialogTitle>
          <DialogDescription>{heading.description}</DialogDescription>
        </DialogHeader>

        {screen !== 'welcome' && screen !== 'done' && (
          <Button variant="ghost" size="sm" className="-mt-2 justify-self-start" onClick={() => onScreen('welcome')}>
            <ArrowLeftIcon />
            Back to the start
          </Button>
        )}

        {screen === 'welcome' && (
          <div className="grid gap-3">
            <Choice
              icon={CompassIcon}
              title="Take the tour"
              description="The dashboard and the menu, one part at a time, with what each is for."
              badge={tourDone ? 'Done' : 'Tour'}
              action="Take the tour"
              onClick={onStartTour}
            />

            {isAdmin && (
              <>
                <Choice
                  icon={GraduationCapIcon}
                  title="Add a student"
                  description="Create or pick the family, add the student, then their assessment, learning plan and tutor."
                  action="Add a student"
                  onClick={() => onScreen('student')}
                />
                <Choice
                  icon={UserPlusIcon}
                  title="Add a tutor"
                  description="Their details, then how they are paid, when they can teach, and their students."
                  action="Add a tutor"
                  onClick={() => onScreen('tutor')}
                />
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
        {screen === 'tutor' && isAdmin && (
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
              <Button onClick={onClose}>Go to my dashboard</Button>
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
