import { useState } from 'react';
import { Loader2Icon, PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SESSION_MODES, SESSION_MODE_LABELS, type SessionMode } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useActiveSession, useAssignments, useStartSession } from './api';

/**
 * "When the session is to start, the tutor could click the start session
 * button and select student."
 *
 * Hidden entirely for anyone who is not a tutor, and while a session is
 * already running — one lesson at a time.
 */
export function StartSessionButton() {
  const { user } = useAuth();
  const isTutor = user?.roles.includes('tutor') ?? false;

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [mode, setMode] = useState<SessionMode>('in_person');

  const { data: activeData } = useActiveSession();
  const { data: assignmentsData } = useAssignments({ tutor_user_id: user?.id });
  const start = useStartSession();

  const students = assignmentsData?.data ?? [];
  const running = Boolean(activeData?.data.mine);

  if (!isTutor || running) return null;

  async function handleStart() {
    if (!studentId) return;

    try {
      await start.mutateAsync({ student_user_id: studentId, mode } as never);
      toast.success('Session started.');
      setOpen(false);
      setStudentId('');
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not start the session.',
      );
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlayIcon />
        Start session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a session</DialogTitle>
            <DialogDescription>
              The clock starts now. Both the start and the end are recorded to the nearest
              quarter hour.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="live-student">Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="live-student" className="w-full">
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.student_user_id}>
                      {assignment.student_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {students.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  You have no students assigned. An admin assigns students to tutors.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="live-mode">Mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as SessionMode)}>
                <SelectTrigger id="live-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_MODES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SESSION_MODE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={start.isPending}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={!studentId || start.isPending}>
              {start.isPending && <Loader2Icon className="animate-spin" />}
              Start now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
