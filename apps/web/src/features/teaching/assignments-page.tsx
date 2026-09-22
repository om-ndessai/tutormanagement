import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCents, type Assignment, type UserRole } from '@tmi/shared';

import { FocusNotice } from '@/components/layout/focus-notice';
import { PageHeader } from '@/components/layout/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CommentsButton } from '@/features/comments/comments-button';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { AssignmentDialog } from './assignment-dialog';

/**
 * A pairing's thread. Named once so the phone cards and the table above them
 * cannot drift apart in how they describe it.
 */
function AssignmentComments({ assignment }: { assignment: Assignment }) {
  return (
    <CommentsButton
      target={{ target_type: 'assignment', target_id: assignment.id }}
      title={`${assignment.student_name}’s pairing`}
      description={`${assignment.student_name} is taught by ${assignment.tutor_name}.`}
    />
  );
}
import { useAssignments, useDeleteAssignment } from './api';

export function AssignmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const { description, empty } = copyFor(user?.roles ?? []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isPending } = useAssignments();
  const remove = useDeleteAssignment();

  /**
   * A link from the comments feed names one pairing. The whole list is already
   * loaded here, so singling it out is a filter rather than another request.
   */
  const focusId = searchParams.get('focus');
  const all = data?.data ?? [];
  const assignments = focusId ? all.filter((row) => row.id === focusId) : all;
  const clearFocus = () =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('focus');
        return next;
      },
      { replace: true },
    );

  async function confirmRemove() {
    if (!removing) return;

    try {
      await remove.mutateAsync(removing.id);
      toast.success(`${removing.student_name} removed from ${removing.tutor_name}.`);
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not remove the pairing.',
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Pairings"
        description={description}
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <PlusIcon />
              Assign a student
            </Button>
          ) : undefined
        }
      />

      <FocusNotice
        active={Boolean(focusId)}
        found={assignments.length > 0}
        what="assignment"
        onClear={clearFocus}
      />

      {/* Phone: one card per pairing, with both rates visible. */}
      <ul className="space-y-3 sm:hidden">
        {assignments.map((assignment) => (
          <li key={assignment.id} className="border-border bg-card rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{assignment.student_name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  with {assignment.tutor_name}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <AssignmentComments assignment={assignment} />
                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${assignment.student_name}'s assignment`}
                      onClick={() => {
                        setEditing(assignment);
                        setDialogOpen(true);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${assignment.student_name} from ${assignment.tutor_name}`}
                      onClick={() => setRemoving(assignment)}
                    >
                      <Trash2Icon />
                    </Button>
                  </>
                )}
              </span>
            </div>

            <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                In person:
                <RateCell
                  effective={assignment.effective_rate_in_person_cents}
                  override={assignment.rate_in_person_cents}
                />
              </span>
              <span className="flex items-center gap-1.5">
                Virtual:
                <RateCell
                  effective={assignment.effective_rate_virtual_cents}
                  override={assignment.rate_virtual_cents}
                />
              </span>
            </div>
          </li>
        ))}
        {!isPending && assignments.length === 0 && (
          <li className="border-border bg-card text-muted-foreground rounded-lg border p-8 text-center text-sm">
            {empty}
          </li>
        )}
      </ul>

      <div className="border-border bg-card hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tutor</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>In person</TableHead>
              <TableHead>Virtual</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 5 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isPending && assignments.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-28 text-center">
                  <p className="text-muted-foreground text-sm">
                    {empty}
                    {isAdmin && ' Assign one to let their tutor record sessions.'}
                  </p>
                </TableCell>
              </TableRow>
            )}

            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.tutor_name}</TableCell>
                <TableCell>{assignment.student_name}</TableCell>
                <TableCell>
                  <RateCell
                    effective={assignment.effective_rate_in_person_cents}
                    override={assignment.rate_in_person_cents}
                  />
                </TableCell>
                <TableCell>
                  <RateCell
                    effective={assignment.effective_rate_virtual_cents}
                    override={assignment.rate_virtual_cents}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <AssignmentComments assignment={assignment} />
                    {isAdmin && (
                      <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${assignment.student_name}'s assignment`}
                        onClick={() => {
                          setEditing(assignment);
                          setDialogOpen(true);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${assignment.student_name} from ${assignment.tutor_name}`}
                        onClick={() => setRemoving(assignment)}
                      >
                        <Trash2Icon />
                      </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AssignmentDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removing?.student_name} from {removing?.tutor_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to record sessions for this student. Sessions already
              taught are kept, along with their billing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={remove.isPending}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * What this page is, in the viewer's own terms.
 *
 * The list is scoped to whoever is reading it: a tutor gets their assigned
 * students, a parent gets the tutors teaching their children, and someone who
 * is taught gets their own tutors. One line for every non-admin used to tell
 * a parent these were "the students you are assigned to teach".
 *
 * Built by clause rather than by case because the roles combine -- a tutor who
 * is also a parent sees both kinds of row in the one list.
 */
function copyFor(roles: UserRole[]): { description: string; empty: string } {
  if (roles.includes('admin')) {
    return {
      description: 'Which tutor teaches which student, and at what rate.',
      empty: 'No students are assigned yet.',
    };
  }

  const descriptions: string[] = [];
  const empties: string[] = [];

  if (roles.includes('tutor')) {
    descriptions.push('the students you teach');
    empties.push('you have no students assigned');
  }

  if (roles.includes('student')) {
    descriptions.push('your own tutors');
    empties.push('no tutor teaches you');
  }

  if (roles.includes('parent')) {
    descriptions.push('who teaches your children');
    empties.push('no tutor teaches your children');
  }

  if (descriptions.length === 0) {
    return {
      description: 'Tutor and student pairings that involve you.',
      empty: 'Nothing is assigned to you yet.',
    };
  }

  return { description: sentence(descriptions), empty: sentence(empties) };
}

/** Joins clauses into one capitalised sentence: "a, b, and c." */
function sentence(parts: string[]): string {
  const joined =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : parts[0]!;

  return `${joined[0]!.toUpperCase()}${joined.slice(1)}.`;
}

/** Shows the rate in force, and whether it overrides the tutor's default. */
function RateCell({ effective, override }: { effective: number | null; override: number | null }) {
  if (effective == null) {
    return <span className="text-muted-foreground text-xs">No rate set</span>;
  }

  return (
    <span className="flex items-center gap-2">
      <span className="tabular-nums">{formatCents(effective)}</span>
      {override != null && (
        <Badge variant="secondary" className="text-[10px]">
          custom
        </Badge>
      )}
    </span>
  );
}
