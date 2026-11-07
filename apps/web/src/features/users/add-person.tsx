import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  GraduationCapIcon,
  MailPlusIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { COMMON_COPY, addChoices, featureOn, mayAddPeople, type AddChoice } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InvitePeople } from '@/features/organizations/invite-people';
import { StudentFlow } from '@/features/onboarding/student-flow';
import { TutorFlow } from '@/features/onboarding/tutor-flow';
import { useAuth } from '@/providers/auth-provider';
import { NextStepsAfterAdd, useNextSteps, type AddedPerson } from './next-steps';
import { UserFormDialog } from './user-form-dialog';

const ICONS: Record<AddChoice, LucideIcon> = {
  family: UsersIcon,
  tutor: GraduationCapIcon,
  someone: UserPlusIcon,
  invite: MailPlusIcon,
};

type Screen = 'choose' | AddChoice | 'added';

/**
 * Phase 76 (JF21): the one way to add people, opened by the home's "Add a person" and the Users header. The choices and
 * their words are shared (`addChoices`): "A family (parent and child)" is the guided family flow ("My child" in a
 * personal space, where the reader is the parent); "Anyone, by email" the invitation rows, Member the default row
 * (Phase 79, M3: just the address); "A tutor" the tutor flow, where Tutoring is on; "Someone, with details" the person
 * form. After each save, the next steps rather than a toast.
 */
export function AddPersonDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, account, organization } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('choose');
  const [added, setAdded] = useState<AddedPerson | null>(null);
  // The person form calls back on a save just before it closes: that close moves on, it does not leave.
  const savedRef = useRef(false);
  const personal = Boolean(organization?.personal);
  const choices = addChoices({
    tutoring: featureOn(organization, 'tutoring'),
    personal,
    mayAdd: mayAddPeople({ roles: user?.roles ?? [], account }),
  });
  const steps = useNextSteps(added);

  // Every opening starts at the choice.
  useEffect(() => {
    if (open) {
      setScreen('choose');
      setAdded(null);
    }
  }, [open]);

  const close = () => onOpenChange(false);
  const leaveFor = (path: string) => {
    close();
    navigate(path);
  };
  const back = () => setScreen('choose');

  // "Someone, with details" is the person form, a dialog of its own; then what next.
  if (open && screen === 'someone') {
    return (
      <UserFormDialog
        open
        // Saving moves on to what next before the form closes; Cancel (or Escape) leaves adding altogether.
        onOpenChange={(next) => {
          if (next) return;
          if (savedRef.current) savedRef.current = false;
          else onOpenChange(false);
        }}
        userId={null}
        title={COMMON_COPY.add_person}
        announce={false}
        onSaved={(saved) => {
          savedRef.current = true;
          setAdded({ id: saved.id, full_name: saved.full_name, roles: saved.roles });
          setScreen('added');
        }}
      />
    );
  }

  const chosen = choices.find((choice) => choice.id === screen);
  const heading =
    screen === 'family'
      ? { title: personal ? 'Add your child' : 'Add a family', description: personal ? 'You are their parent here.' : 'The parent first, then their child.' }
      : screen === 'tutor'
        ? { title: 'Add a tutor', description: 'Who they are, how they are paid, when they can teach, and their students.' }
        : screen === 'invite'
          ? {
              title: chosen?.label ?? 'Anyone, by email',
              description: 'They join as a member when they sign in with that address, unless you choose a role. Copy or share each invitation to tell them.',
            }
          : screen === 'added' && added
            ? { title: `${added.full_name} is added`, description: steps.length > 0 ? 'Next, when you are ready.' : 'They are on the People page.' }
            : { title: COMMON_COPY.add_person, description: 'Who are you adding?' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="add-person">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {screen === 'added' && <CheckCircle2Icon className="text-success size-5" aria-hidden />}
            {heading.title}
          </DialogTitle>
          <DialogDescription>{heading.description}</DialogDescription>
        </DialogHeader>

        {screen !== 'choose' && screen !== 'added' && (
          <Button variant="ghost" size="sm" className="-mt-2 justify-self-start" onClick={back} data-testid="add-person-back">
            <ArrowLeftIcon />
            Back
          </Button>
        )}

        {screen === 'choose' && (
          <ul className="grid gap-2" data-testid="add-choices">
            {choices.map((choice) => {
              const Icon = ICONS[choice.id];
              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => setScreen(choice.id)}
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
                    data-testid={`add-choice-${choice.id}`}
                  >
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-medium">{choice.label}</span>
                      <span className="text-muted-foreground text-xs">{choice.description}</span>
                    </span>
                    <ChevronRightIcon className="text-muted-foreground size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {screen === 'family' && <StudentFlow start={personal ? 'my-child' : 'family'} onNavigate={leaveFor} onBack={close} />}
        {screen === 'tutor' && <TutorFlow onNavigate={leaveFor} onBack={close} />}
        {screen === 'invite' && <InvitePeople onDone={close} doneLabel="Done" />}

        {screen === 'added' && added && (
          <>
            <NextStepsAfterAdd person={added} onNavigate={leaveFor} />
            <DialogFooter>
              <Button variant="outline" onClick={() => leaveFor(`/users?view=${added.id}`)}>
                Open their record
              </Button>
              <Button onClick={close} data-testid="add-person-done">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
