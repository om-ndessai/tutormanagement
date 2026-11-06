import { useState } from 'react';
import {
  CalendarPlusIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  UserRoundPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  featureOn,
  nextStepsAfterAdd,
  paidDirectly,
  type Assignment,
  type NextStepAfterAddId,
  type UserRole,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { AssessmentDialog } from '@/features/progress/assessment-dialog';
import { ScheduleDialog } from '@/features/schedules/schedule-dialog';
import { AssignmentDialog } from '@/features/teaching/assignment-dialog';
import { useAuth } from '@/providers/auth-provider';
import { UserFormDialog } from './user-form-dialog';

const ICONS: Record<NextStepAfterAddId, LucideIcon> = {
  pair_tutor: UserRoundPlusIcon,
  weekly_lesson: CalendarPlusIcon,
  assessment: ClipboardCheckIcon,
  pair_student: UserRoundPlusIcon,
  tax_setup: FileTextIcon,
};

export interface AddedPerson {
  id: string;
  full_name: string;
  roles: readonly UserRole[];
}

/** Whether there is anything to offer after adding this person here (Phase 76, JF21). */
export function useNextSteps(person: AddedPerson | null) {
  const { organization } = useAuth();
  if (!person) return [];
  return nextStepsAfterAdd(person, {
    tutoring: featureOn(organization, 'tutoring'),
    assessment: featureOn(organization, 'assessment'),
    paysTutors: organization ? !paidDirectly(organization) : false,
  });
}

/**
 * What to do next with someone just added, instead of a toast (Phase 76, JF21): "Pair Yusuf with a tutor" opens the
 * pairing form with the student chosen, "Set a weekly lesson" the schedule form with that pairing, "Record an
 * assessment" the assessment for them; for a tutor, "Pair Tara with a student" and "Finish tax setup". Each is the
 * portal's own dialog, preset, and is ticked once it saves.
 */
export function NextStepsAfterAdd({
  person,
  onNavigate,
}: {
  person: AddedPerson;
  /** Leaves for a page (the Assessment menu, where there is no Tutoring). */
  onNavigate: (path: string) => void;
}) {
  const { organization } = useAuth();
  const tutoring = featureOn(organization, 'tutoring');
  const steps = useNextSteps(person);
  const [open, setOpen] = useState<NextStepAfterAddId | null>(null);
  const [done, setDone] = useState<ReadonlySet<NextStepAfterAddId>>(new Set());
  const [pairing, setPairing] = useState<Assignment | null>(null);
  const tick = (id: NextStepAfterAddId) => setDone((current) => new Set(current).add(id));
  const closed = (next: boolean) => !next && setOpen(null);

  if (steps.length === 0) return null;

  return (
    <div className="grid gap-2" data-testid="next-steps">
      <ul className="grid gap-2">
        {steps.map((step) => {
          const Icon = done.has(step.id) ? CheckIcon : ICONS[step.id];
          return (
            <li key={step.id}>
              <Button
                variant={done.has(step.id) ? 'secondary' : 'outline'}
                className="w-full justify-start"
                onClick={() => {
                  // Without Tutoring, an assessment is the Assessment menu's.
                  if (step.id === 'assessment' && !tutoring) onNavigate(`/assessments?student=${person.id}`);
                  else setOpen(step.id);
                }}
                data-testid={`next-step-${step.id}`}
              >
                <Icon className={done.has(step.id) ? 'text-success' : undefined} />
                {step.label}
              </Button>
            </li>
          );
        })}
      </ul>

      <AssignmentDialog
        open={open === 'pair_tutor' || open === 'pair_student'}
        onOpenChange={closed}
        existing={null}
        preset={open === 'pair_student' ? { tutor_user_id: person.id } : { student_user_id: person.id }}
        onSaved={(saved) => {
          setPairing(saved);
          tick(open === 'pair_student' ? 'pair_student' : 'pair_tutor');
        }}
      />
      <ScheduleDialog
        open={open === 'weekly_lesson'}
        onOpenChange={closed}
        existing={null}
        preset={{ assignment_id: pairing?.id ?? null, student_user_id: person.id }}
        onSaved={() => tick('weekly_lesson')}
      />
      {tutoring && (
        <AssessmentDialog
          open={open === 'assessment'}
          onOpenChange={closed}
          studentId={person.id}
          studentName={person.full_name}
          existing={null}
          onSaved={() => tick('assessment')}
        />
      )}
      <UserFormDialog
        open={open === 'tax_setup'}
        onOpenChange={closed}
        userId={person.id}
        sections={['tutor-financials', 'payment-handles']}
        title={`${person.full_name}: tax setup`}
        description="Their mailing address for the 1099, how they are paid, and whether the office holds their SSN. Seen only by the office and the tutor."
        onSaved={() => tick('tax_setup')}
      />
    </div>
  );
}
