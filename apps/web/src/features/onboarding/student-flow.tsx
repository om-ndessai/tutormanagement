import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStudentProgress } from '@/features/progress/api';
import { AssessmentDialog } from '@/features/progress/assessment-dialog';
import { PlanDialog } from '@/features/progress/plan-dialog';
import { AssignmentDialog } from '@/features/teaching/assignment-dialog';
import { useUsers } from '@/features/users/api';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { FlowSteps, StepPanel } from './flow-steps';

type Step = 'family' | 'student' | 'assessment' | 'plan' | 'pairing' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'family', label: 'Family' },
  { key: 'student', label: 'Student' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Learning plan' },
  { key: 'pairing', label: 'Tutor' },
];

interface Person {
  id: string;
  name: string;
}

/**
 * Adding a student, in the order that works (Phase 26): the family first --
 * a student cannot exist without a parent on file -- then the student, their
 * assessment, their plan, and a tutor. Every step opens the portal's own
 * dialog, preset; nothing here is a second copy of a form. Any step may be
 * skipped, and whatever was already added stays.
 */
export function StudentFlow({
  onNavigate,
  onBack,
}: {
  /** Leaves the wizard for a page, to carry on there. */
  onNavigate: (path: string) => void;
  /** Back to the wizard's welcome. */
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>('family');
  const [done, setDone] = useState(new Set<string>());
  const [parent, setParent] = useState<Person | null>(null);
  const [chosenParent, setChosenParent] = useState('');
  const [student, setStudent] = useState<Person | null>(null);
  const [open, setOpen] = useState<'parent' | 'student' | 'assessment' | 'plan' | 'pairing' | null>(
    null,
  );

  const parents = useUsers({ role: 'parent', limit: 100, sort: 'full_name' });
  const progress = useStudentProgress(student?.id);
  const assessment = progress.data?.data.assessments[0] ?? null;

  function complete(key: Step, next: Step) {
    setDone((previous) => new Set(previous).add(key));
    setStep(next);
  }

  function restart() {
    setStep('family');
    setDone(new Set());
    setParent(null);
    setChosenParent('');
    setStudent(null);
  }

  return (
    <div className="grid gap-4">
      <FlowSteps steps={STEPS} current={step} done={done} />

      {step === 'family' && (
        <StepPanel
          title="First, the family"
          actions={
            <>
              <Button onClick={() => setOpen('parent')}>
                <PlusIcon />
                Create a family account
              </Button>
              <Button variant="ghost" onClick={() => setStep('done')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            Every student needs a parent or guardian on file, who is billed and kept informed.
            Choose an existing family, or create their account.
          </p>
          <div className="grid gap-1.5 sm:max-w-sm">
            <Label htmlFor="onboarding-parent">An existing parent</Label>
            <div className="flex gap-2">
              <Select value={chosenParent} onValueChange={setChosenParent}>
                <SelectTrigger id="onboarding-parent" className="w-full">
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
          title="Now the student"
          actions={
            <>
              <Button onClick={() => setOpen('student')}>
                <PlusIcon />
                Add the student
              </Button>
              <Button variant="ghost" onClick={() => setStep('done')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            Linked to {parent.name}. Their school, course, goal for the year and what the family is
            charged per hour. A child with no email of their own needs none.
          </p>
        </StepPanel>
      )}

      {step === 'assessment' && student && (
        <StepPanel
          title={`Where ${student.name} stands`}
          actions={
            <>
              <Button onClick={() => setOpen('assessment')}>Record the assessment</Button>
              <Button variant="ghost" onClick={() => setStep('plan')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            The initial assessment: a write-up, the level you recommend, and a 1–5 score on any
            topic you checked. The learning plan starts from it.
          </p>
        </StepPanel>
      )}

      {step === 'plan' && student && (
        <StepPanel
          title={`${student.name}’s learning plan`}
          actions={
            <>
              <Button onClick={() => setOpen('plan')}>Set the learning plan</Button>
              <Button variant="ghost" onClick={() => setStep('pairing')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            The goal and its date, the topics that lead there, and how often to meet. Progress is
            tracked against it lesson by lesson.
          </p>
        </StepPanel>
      )}

      {step === 'pairing' && student && (
        <StepPanel
          title={`A tutor for ${student.name}`}
          actions={
            <>
              <Button onClick={() => setOpen('pairing')}>Pair with a tutor</Button>
              <Button variant="ghost" onClick={() => setStep('done')}>
                Skip
              </Button>
            </>
          }
        >
          <p>Which tutor teaches them, and at what rate. Lessons can be recorded once they are paired.</p>
        </StepPanel>
      )}

      {step === 'done' && (
        <StepPanel
          title={student ? `${student.name} is set up` : 'Nothing added yet'}
          actions={
            <>
              {student && (
                <Button variant="outline" onClick={() => onNavigate(`/progress/${student.id}`)}>
                  Open their progress
                </Button>
              )}
              <Button variant="outline" onClick={() => onNavigate('/users')}>
                Go to Users
              </Button>
              <Button variant="outline" onClick={restart}>
                Add another student
              </Button>
              <Button variant="ghost" onClick={onBack}>
                Back to the start
              </Button>
            </>
          }
        >
          {student ? (
            <p>
              Anything you skipped can be done from their record, their progress page or Pairings.
            </p>
          ) : (
            <p>You can add a family and a student from Users at any time.</p>
          )}
        </StepPanel>
      )}

      {/* The portal's own dialogs, preset for this flow. */}
      <UserFormDialog
        open={open === 'parent'}
        onOpenChange={(next) => !next && setOpen(null)}
        userId={null}
        preset={{ roles: ['parent'] }}
        sections={['identity', 'payment-handles']}
        title="New family account"
        description="The parent or guardian: they sign in with this Google address, and are billed for the lessons."
        onSaved={(user) => {
          setParent({ id: user.id, name: user.full_name });
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
          }}
          sections={['identity', 'student', 'guardians', 'availability']}
          title="New student"
          description={`Linked to ${parent.name}. Change the relationship below if they are the mother or father.`}
          onSaved={(user) => {
            setStudent({ id: user.id, name: user.full_name });
            complete('student', 'assessment');
          }}
        />
      )}
      {student && (
        <>
          <AssessmentDialog
            open={open === 'assessment'}
            onOpenChange={(next) => !next && setOpen(null)}
            studentId={student.id}
            studentName={student.name}
            existing={null}
            onSaved={() => complete('assessment', 'plan')}
          />
          <PlanDialog
            open={open === 'plan'}
            onOpenChange={(next) => !next && setOpen(null)}
            studentId={student.id}
            studentName={student.name}
            existing={null}
            assessment={assessment}
            defaultGoal={progress.data?.data.student.academic_year_goal ?? null}
            onSaved={() => complete('plan', 'pairing')}
          />
          <AssignmentDialog
            open={open === 'pairing'}
            onOpenChange={(next) => !next && setOpen(null)}
            existing={null}
            preset={{ student_user_id: student.id }}
            onSaved={() => complete('pairing', 'done')}
          />
        </>
      )}
    </div>
  );
}
