import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { featureOn } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/features/users/api';
import { NextStepsAfterAdd, type AddedPerson } from '@/features/users/next-steps';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { useAuth } from '@/providers/auth-provider';
import { FlowSteps, StepPanel } from './flow-steps';

type Step = 'family' | 'student' | 'next' | 'done';

interface Person {
  id: string;
  name: string;
}

/**
 * Adding a student, in the order that works (Phase 26): the family first --
 * a student cannot exist without a parent on file -- then the student, then
 * what to do next with them (Phase 76, JF21: "Pair Yusuf with a tutor", "Set a
 * weekly lesson", "Record an assessment"). Every step opens the portal's own
 * dialog, preset; nothing here is a second copy of a form. Any step may be
 * skipped, and whatever was already added stays.
 *
 * `start="my-child"` (a personal space's "My child"): the signed-in adult is
 * the parent, so the flow starts with the child; saving names them the
 * guardian and the API gives them the parent role in the same request.
 */
export function StudentFlow({
  onNavigate,
  onBack,
  start = 'family',
}: {
  /** Leaves the wizard for a page, to carry on there. */
  onNavigate: (path: string) => void;
  /** Back to the start (the wizard's welcome, or the Add chooser). */
  onBack: () => void;
  start?: 'family' | 'my-child';
}) {
  const { organization, user, refreshSession } = useAuth();
  const tutoring = featureOn(organization, 'tutoring');
  const myChild = start === 'my-child';
  const me: Person | null = user ? { id: user.id, name: user.full_name } : null;

  const steps: { key: Step; label: string }[] = [
    ...(myChild ? [] : [{ key: 'family' as const, label: 'Family' }]),
    { key: 'student', label: myChild ? 'Your child' : 'Student' },
    { key: 'next', label: 'Next steps' },
  ];
  const [step, setStep] = useState<Step>(myChild ? 'student' : 'family');
  const [done, setDone] = useState(new Set<string>());
  const [parent, setParent] = useState<Person | null>(myChild ? me : null);
  const [chosenParent, setChosenParent] = useState('');
  const [student, setStudent] = useState<AddedPerson | null>(null);
  const [open, setOpen] = useState<'parent' | 'student' | null>(null);

  const parents = useUsers({ role: 'parent', limit: 100, sort: 'full_name' }, { enabled: !myChild });

  function complete(key: Step, next: Step) {
    setDone((previous) => new Set(previous).add(key));
    setStep(next);
  }

  function restart() {
    setStep(myChild ? 'student' : 'family');
    setDone(new Set());
    setParent(myChild ? me : null);
    setChosenParent('');
    setStudent(null);
  }

  /**
   * Phase 52: "This is my child" -- the admin is the family. Since Phase 76 the API makes them the parent as the
   * child is saved, naming them the guardian; nothing is changed until then.
   */
  function iAmTheParent() {
    if (!me) return;
    setParent(me);
    complete('family', 'student');
  }

  const parentIsMe = Boolean(parent && user && parent.id === user.id);

  return (
    <div className="grid gap-4">
      <FlowSteps steps={steps} current={step === 'done' ? 'next' : step} done={done} />

      {step === 'family' && (
        <StepPanel
          title="First, the family"
          actions={
            <>
              {/* Phase 76 (JF21): the office's usual case leads. */}
              <Button onClick={() => setOpen('parent')} data-testid="onboarding-new-family">
                <PlusIcon />
                Create a family account
              </Button>
              <Button variant="outline" onClick={iAmTheParent} data-testid="onboarding-i-am-parent">
                This is my child
              </Button>
              <Button variant="ghost" onClick={() => setStep('done')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            {/* Phase 74 (JF31): only a space with Tutoring bills anyone. */}
            {tutoring
              ? 'Every student needs a parent or guardian on file, who is billed and kept informed.'
              : 'Who looks after this student? Every student needs a parent or guardian here, who is kept informed.'}{' '}
            Create their account, or choose a family already here.
          </p>
          <div className="grid gap-1.5 sm:max-w-sm">
            <Label htmlFor="onboarding-parent">An existing parent</Label>
            {/* Phase 78 (JF28): wraps on a phone, so the button never pushes the dialog wider than the screen. */}
            <div className="flex flex-wrap gap-2">
              <Select value={chosenParent} onValueChange={setChosenParent}>
                <SelectTrigger id="onboarding-parent" className="min-w-0 flex-1 basis-44">
                  <SelectValue placeholder="Choose a parent" />
                </SelectTrigger>
                <SelectContent>
                  {(parents.data?.data ?? []).map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!chosenParent}
                onClick={() => {
                  const found = parents.data?.data.find((candidate) => candidate.id === chosenParent);
                  if (!found) return;
                  setParent({ id: found.id, name: found.full_name });
                  complete('family', 'student');
                }}
              >
                Use this family
              </Button>
            </div>
          </div>
        </StepPanel>
      )}

      {step === 'student' && parent && (
        <StepPanel
          title={myChild ? 'Your child' : 'Now the student'}
          actions={
            <>
              <Button onClick={() => setOpen('student')} data-testid="onboarding-add-student">
                <PlusIcon />
                {myChild ? 'Add your child' : 'Add the student'}
              </Button>
              <Button variant="ghost" onClick={() => (myChild ? onBack() : setStep('done'))}>
                {myChild ? 'Back' : 'Skip'}
              </Button>
            </>
          }
        >
          <p>
            {myChild
              ? 'You are their parent here. Their name, school and goal for the year; a child with no email of their own needs none.'
              : tutoring
                ? `Linked to ${parent.name}. Their school, course, goal for the year and what the family is charged per hour. A child with no email of their own needs none.`
                : `Linked to ${parent.name}. Their school, course and goal for the year. A child with no email of their own needs none.`}
          </p>
        </StepPanel>
      )}

      {step === 'next' && student && (
        <StepPanel
          title={`${student.full_name} is added`}
          actions={
            <>
              <Button variant="outline" onClick={() => onNavigate(`/users?view=${student.id}`)}>
                Open their record
              </Button>
              <Button variant="outline" onClick={restart}>
                {myChild ? 'Add another child' : 'Add another student'}
              </Button>
              <Button variant="ghost" onClick={onBack} data-testid="onboarding-next-done">
                Done
              </Button>
            </>
          }
        >
          <p>Next, when you are ready. Anything you leave can be done from their record later.</p>
          <NextStepsAfterAdd person={student} onNavigate={onNavigate} />
        </StepPanel>
      )}

      {step === 'done' && (
        <StepPanel
          title="Nothing added yet"
          actions={
            <>
              <Button variant="outline" onClick={restart}>
                Start again
              </Button>
              <Button variant="ghost" onClick={onBack}>
                Back to the start
              </Button>
            </>
          }
        >
          <p>You can add a family and a student from People at any time.</p>
        </StepPanel>
      )}

      {/* The portal's own dialogs, preset for this flow. */}
      <UserFormDialog
        open={open === 'parent'}
        onOpenChange={(next) => !next && setOpen(null)}
        userId={null}
        preset={{ roles: ['parent'] }}
        sections={tutoring ? ['identity', 'payment-handles'] : ['identity']}
        title="New family account"
        description={
          tutoring
            ? 'The parent or guardian: they sign in with this Google address, and are billed for the lessons.'
            : 'The parent or guardian: they sign in with this Google address.'
        }
        announce={false}
        onSaved={(saved) => {
          setParent({ id: saved.id, name: saved.full_name });
          complete('family', 'student');
        }}
      />
      {parent && (
        <UserFormDialog
          open={open === 'student'}
          onOpenChange={(next) => !next && setOpen(null)}
          userId={null}
          preset={{
            roles: ['student'],
            guardians: [{ guardian_user_id: parent.id, relationship: 'guardian', is_primary: true }],
            // The adult is not a parent until the child is saved: the picker is told their name.
            guardian_names: { [parent.id]: parent.name },
          }}
          sections={tutoring ? ['identity', 'student', 'guardians', 'availability'] : ['identity', 'student', 'guardians']}
          title={myChild ? 'Your child' : 'New student'}
          description={
            parentIsMe
              ? 'You are their parent. Change the relationship below if you are their mother or father.'
              : `Linked to ${parent.name}. Change the relationship below if they are the mother or father.`
          }
          announce={false}
          onSaved={(saved) => {
            setStudent({ id: saved.id, full_name: saved.full_name, roles: saved.roles });
            complete('student', 'next');
            // Naming themselves the guardian made the adult a parent here (Phase 76): their menus follow.
            if (parentIsMe && !user?.roles.includes('parent')) void refreshSession();
          }}
        />
      )}
    </div>
  );
}
