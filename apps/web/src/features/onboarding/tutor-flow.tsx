import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AssignmentDialog } from '@/features/teaching/assignment-dialog';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { FlowSteps, StepPanel } from './flow-steps';

type Step = 'tutor' | 'financials' | 'availability' | 'pairing' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'tutor', label: 'Tutor' },
  { key: 'financials', label: 'Financials' },
  { key: 'availability', label: 'Availability' },
  { key: 'pairing', label: 'Students' },
];

/**
 * Adding a tutor (Phase 26): who they are, then how they are paid, then when
 * they can teach, then their students. Each step is the portal's own user
 * form, showing just that part of it -- the record is saved whole every
 * time, so a step never clears what an earlier one set.
 */
export function TutorFlow({
  onNavigate,
  onBack,
}: {
  onNavigate: (path: string) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>('tutor');
  const [done, setDone] = useState(new Set<string>());
  const [tutor, setTutor] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState<Step | null>(null);

  function complete(key: Step, next: Step) {
    setDone((previous) => new Set(previous).add(key));
    setStep(next);
  }

  function restart() {
    setStep('tutor');
    setDone(new Set());
    setTutor(null);
  }

  return (
    <div className="grid gap-4">
      <FlowSteps steps={STEPS} current={step} done={done} />

      {step === 'tutor' && (
        <StepPanel
          title="Who they are"
          actions={
            <>
              <Button onClick={() => setOpen('tutor')}>
                <PlusIcon />
                Add the tutor
              </Button>
              <Button variant="ghost" onClick={() => setStep('done')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            Their name, the Google address they sign in with, a phone number, and their background:
            education, school and area.
          </p>
        </StepPanel>
      )}

      {step === 'financials' && tutor && (
        <StepPanel
          title={`How ${tutor.name} is paid`}
          actions={
            <>
              <Button onClick={() => setOpen('financials')}>Set up financials</Button>
              <Button variant="ghost" onClick={() => setStep('availability')}>
                Skip
              </Button>
            </>
          }
        >
          <p>
            Their default pay per hour, whether they are paid in advance, how they are paid (Zelle,
            Venmo), their mailing address for the 1099, and whether the office holds their SSN — a
            tick, never the number.
          </p>
        </StepPanel>
      )}

      {step === 'availability' && tutor && (
        <StepPanel
          title={`When ${tutor.name} can teach`}
          actions={
            <>
              <Button onClick={() => setOpen('availability')}>Set availability</Button>
              <Button variant="ghost" onClick={() => setStep('pairing')}>
                Skip
              </Button>
            </>
          }
        >
          <p>The hours they are free each week, whether they teach online, and their longest lesson.</p>
        </StepPanel>
      )}

      {step === 'pairing' && tutor && (
        <StepPanel
          title={`Students for ${tutor.name}`}
          actions={
            <>
              <Button onClick={() => setOpen('pairing')}>Pair with a student</Button>
              <Button variant="ghost" onClick={() => setStep('done')}>
                Skip
              </Button>
            </>
          }
        >
          <p>Which student they teach, and at what rate. Pair more from Pairings at any time.</p>
        </StepPanel>
      )}

      {step === 'done' && (
        <StepPanel
          title={tutor ? `${tutor.name} is set up` : 'Nothing added yet'}
          actions={
            <>
              <Button variant="outline" onClick={() => onNavigate('/assignments')}>
                Go to Pairings
              </Button>
              <Button variant="outline" onClick={() => onNavigate('/users')}>
                Go to Users
              </Button>
              <Button variant="outline" onClick={restart}>
                Add another tutor
              </Button>
              <Button variant="ghost" onClick={onBack}>
                Back to the start
              </Button>
            </>
          }
        >
          <p>
            {tutor
              ? 'Anything you skipped can be finished from their record on the Users page.'
              : 'You can add a tutor from Users at any time.'}
          </p>
        </StepPanel>
      )}

      <UserFormDialog
        open={open === 'tutor'}
        onOpenChange={(next) => !next && setOpen(null)}
        userId={null}
        preset={{ roles: ['tutor'] }}
        sections={['identity', 'tutor-background']}
        title="New tutor"
        description="They sign in with this Google address. Pay and availability come next."
        onSaved={(user) => {
          setTutor({ id: user.id, name: user.full_name });
          complete('tutor', 'financials');
        }}
      />
      {tutor && (
        <>
          <UserFormDialog
            open={open === 'financials'}
            onOpenChange={(next) => !next && setOpen(null)}
            userId={tutor.id}
            sections={['tutor-financials', 'payment-handles']}
            title={`${tutor.name}: financials`}
            description="Seen only by the office and the tutor."
            onSaved={() => complete('financials', 'availability')}
          />
          <UserFormDialog
            open={open === 'availability'}
            onOpenChange={(next) => !next && setOpen(null)}
            userId={tutor.id}
            sections={['tutor-availability']}
            title={`${tutor.name}: availability`}
            description="When they are free, and how long a lesson may run."
            onSaved={() => complete('availability', 'pairing')}
          />
          <AssignmentDialog
            open={open === 'pairing'}
            onOpenChange={(next) => !next && setOpen(null)}
            existing={null}
            preset={{ tutor_user_id: tutor.id }}
            onSaved={() => complete('pairing', 'done')}
          />
        </>
      )}
    </div>
  );
}
