import { useState } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCents, type Assignment } from '@tmi/shared';

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
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { AssignmentDialog } from './assignment-dialog';
import { useAssignments, useDeleteAssignment } from './api';

export function AssignmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [removing, setRemoving] = useState<Assignment | null>(null);

  const { data, isPending } = useAssignments();
  const remove = useDeleteAssignment();

  const assignments = data?.data ?? [];

  async function confirmRemove() {
    if (!removing) return;

    try {
      await remove.mutateAsync(removing.id);
      toast.success(`${removing.student_name} removed from ${removing.tutor_name}.`);
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not remove the assignment.',
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Assignments"
        description={
          isAdmin
            ? 'Which tutor teaches which student, and at what rate.'
            : 'The students you are assigned to teach.'
        }
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
              {isAdmin && (
                <span className="flex shrink-0 items-center gap-1">
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
                </span>
              )}
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
            {isAdmin
              ? 'No students are assigned yet.'
              : 'You have no students assigned.'}
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
              {isAdmin && (
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: isAdmin ? 5 : 4 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isPending && assignments.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={isAdmin ? 5 : 4} className="h-28 text-center">
                  <p className="text-muted-foreground text-sm">
                    {isAdmin
                      ? 'No students are assigned yet. Assign one to let their tutor record sessions.'
                      : 'You have no students assigned.'}
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
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-1">
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
                    </div>
                  </TableCell>
                )}
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
