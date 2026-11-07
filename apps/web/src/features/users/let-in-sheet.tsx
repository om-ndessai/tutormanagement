import { useState } from 'react';
import { toast } from 'sonner';
import {
  LET_IN_ROLE_HINTS,
  JOIN_REQUEST_ROLE_LABELS,
  LET_IN_ROLE_LABELS,
  featureOn,
  formatRelativeTime,
  letInRoles,
  letInRolesFor,
  letInStartRole,
  type ApiOk,
  type JoinRequest,
  type LetInRole,
  type UserDetail,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useCreateUser, useUpdateUser, useUsers } from './api';
import { UserFormDialog, type GuardianValue } from './user-form-dialog';

/** One line under each choice (shared with the app). */
const LET_IN_HINTS: Record<LetInRole, string> = LET_IN_ROLE_HINTS;

/**
 * Letting in someone who asked with the space's code (Phase 52), as a short sheet (owner, 2026-11-04; UI
 * audit JF1): the role first, then, for a parent, "Which child is theirs?": a student already here (linked as
 * their guardian), one added now through the usual student form, or later. A parent let in with no child here
 * cannot start the space's assessment (J07, J07A), so the sheet asks at the moment the admin knows the answer.
 *
 * Phase 79 (M5, docs/members-plan.md): the choices are shared (`letInRolesFor`): Member first -- in, with no role,
 * playing Quest -- then Parent, Admin (never for a teen) and Tutor (where Tutoring is on). The sheet starts on the role
 * asked for where it is offered, else on Member (`letInStartRole`), so a learner is let in with one tap. A student with
 * a parent here: the full form.
 */
export function LetInSheet({
  request,
  onClose,
  onDone,
  onLetIn,
}: {
  request: JoinRequest;
  onClose: () => void;
  onDone: () => void;
  /** As soon as they are in: their request leaves the list while the sheet asks about their child. */
  onLetIn?: () => void;
}) {
  const { organization } = useAuth();
  const tutoring = featureOn(organization, 'tutoring');
  const create = useCreateUser();
  const update = useUpdateUser();
  // The sheet starts on the role they asked for (Phase 72, JF26), where it is one of its choices.
  const asked = request.role ?? null;
  const offered = letInRolesFor({ teen: request.teen ?? false, tutoring });
  const [role, setRole] = useState<LetInRole>(() => letInStartRole(asked, { teen: request.teen ?? false, tutoring }));
  const [step, setStep] = useState<'role' | 'child' | 'full' | 'add-child'>('role');
  const [member, setMember] = useState<UserDetail | null>(null);
  const [studentId, setStudentId] = useState('');
  const [linking, setLinking] = useState(false);
  const students = useUsers({ role: 'student' }, { enabled: step === 'child' });
  const first = request.full_name.split(' ')[0] ?? request.full_name;

  async function letIn() {
    try {
      const answer = await create.mutateAsync({
        full_name: request.full_name,
        email: request.email ?? null,
        phone: null,
        roles: letInRoles(role),
        status: 'active',
        join_request_user_id: request.user_id,
      });
      setMember(answer.data);
      onLetIn?.();
      toast.success(`${request.full_name} is in.`);
      if (role === 'parent') setStep('child');
      else onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not let them in. Please try again.');
    }
  }

  async function linkStudent() {
    if (!member || !studentId) return;
    setLinking(true);
    try {
      // A student's guardians are saved as a whole: the ones they have, and the parent just let in.
      const student = (await apiClient.get<ApiOk<UserDetail>>(`/users/${studentId}`)).data;
      const guardians: GuardianValue[] = [
        ...student.guardians.map((g) => ({ guardian_user_id: g.user_id, relationship: g.relationship, is_primary: g.is_primary })),
        { guardian_user_id: member.id, relationship: 'guardian', is_primary: student.guardians.length === 0 },
      ];
      await update.mutateAsync({ id: studentId, input: { guardians } });
      toast.success(`${student.full_name} is linked to ${first}.`);
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not link them. Please try again.');
    } finally {
      setLinking(false);
    }
  }

  if (step === 'full') {
    // The full form, for anything the short sheet does not offer (Phase 52's Let in).
    return (
      <UserFormDialog
        open
        onOpenChange={(open) => !open && onClose()}
        userId={null}
        preset={{ roles: [], full_name: request.full_name, email: request.email ?? '' }}
        joinRequestUserId={request.user_id}
        title={`Let ${request.full_name} in`}
        description="Choose what they do here. They are a member as soon as you save."
        onSaved={onDone}
      />
    );
  }

  if (step === 'add-child' && member) {
    return (
      <UserFormDialog
        open
        onOpenChange={(open) => !open && onDone()}
        userId={null}
        preset={{ roles: ['student'], guardians: [{ guardian_user_id: member.id, relationship: 'guardian', is_primary: true }] }}
        title={`Add ${first}'s child`}
        description={`${request.full_name} is their parent here.`}
        onSaved={onDone}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && (step === 'child' ? onDone() : onClose())}>
      <DialogContent data-testid="let-in-sheet">
        {step === 'role' ? (
          <>
            <DialogHeader>
              <DialogTitle>Let {request.full_name} in</DialogTitle>
              <DialogDescription>
                {request.email ?? 'No address'} · asked {formatRelativeTime(request.requested_at)}
              </DialogDescription>
            </DialogHeader>
            {(asked || request.note) && (
              <div className="bg-muted/60 grid gap-1 rounded-lg px-3 py-2 text-sm" data-testid="let-in-asked">
                {asked && (
                  <p>
                    Asked as <strong>{JOIN_REQUEST_ROLE_LABELS[asked].toLowerCase()}</strong>.
                  </p>
                )}
                {request.note && <p className="break-words">“{request.note}”</p>}
              </div>
            )}
            <fieldset className="grid gap-3">
              <legend className="sr-only">What they do here</legend>
              {offered.map((choice) => (
                <LetInChoice
                  key={choice}
                  value={choice}
                  chosen={role}
                  onChoose={setRole}
                  title={LET_IN_ROLE_LABELS[choice]}
                  hint={LET_IN_HINTS[choice]}
                />
              ))}
            </fieldset>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="link" className="px-0" onClick={() => setStep('full')} data-testid="let-in-full-form">
                Something else? The full form
              </Button>
              <Button onClick={() => void letIn()} disabled={create.isPending} data-testid="let-in-submit">
                Let in
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Which child is {first}&apos;s?</DialogTitle>
              <DialogDescription>
                {first} is in as a parent. Link their child so {first} can follow them here and start an assessment for them.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="let-in-student">A student already here</Label>
              <div className="flex flex-wrap gap-2">
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger id="let-in-student" className="min-w-56 flex-1" data-testid="let-in-student">
                    <SelectValue placeholder={students.data?.data.length === 0 ? 'No students here yet' : 'Choose a student'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(students.data?.data ?? []).map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={!studentId || linking} onClick={() => void linkStudent()} data-testid="let-in-link">
                  Link
                </Button>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={onDone} data-testid="let-in-later">
                Later
              </Button>
              <Button onClick={() => setStep('add-child')} data-testid="let-in-add-child">
                Add {first}&apos;s child now
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LetInChoice({
  value,
  chosen,
  onChoose,
  title,
  hint,
}: {
  value: LetInRole;
  chosen: LetInRole;
  onChoose: (role: LetInRole) => void;
  title: string;
  hint: string;
}) {
  return (
    <Label htmlFor={`let-in-role-${value}`} className="hover:bg-muted/50 has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal">
      <input
        type="radio"
        name="let-in-role"
        id={`let-in-role-${value}`}
        value={value}
        checked={chosen === value}
        onChange={() => onChoose(value)}
        className="accent-primary mt-1 size-4"
        data-testid={`let-in-role-${value}`}
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-sm">{hint}</span>
      </span>
    </Label>
  );
}
