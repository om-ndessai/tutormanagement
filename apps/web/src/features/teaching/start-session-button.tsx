import { useEffect, useState } from 'react';
import { Loader2Icon, PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SESSION_MODES, SESSION_MODE_LABELS, startSessionSchema, type SessionMode } from '@tmi/shared';

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
import { ProblemLines, refusalLines } from './record-lesson';

/** A lesson chosen already: Next up's, or a quick action's (Phase 75, JF30). */
export interface StartPreset {
  student_user_id: string;
  mode: SessionMode;
}

/**
 * "When the session is to start, the tutor could click the start session
 * button and select student."
 *
 * Shown to tutors only. Every Start opens the dialog below in place (Phase 75, JF30).
 */
export function StartSessionButton() {
  const { user } = useAuth();
  const isTutor = user?.roles.includes('tutor') ?? false;
  const [open, setOpen] = useState(false);

  if (!isTutor) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="start-lesson-button">
        <PlayIcon />
        Start a lesson
      </Button>
      <StartLessonDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Start a lesson, in place, from any door (the quick action, Next up's "Start lesson", Sessions): prefilled with the
 * lesson's student and mode when the door knows them. With a lesson running it says why another cannot start; a
 * refusal (a price the office has not set, say) is said here, in the tutor's words, not in a toast (JF18).
 */
export function StartLessonDialog({
  open,
  onOpenChange,
  preset = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: StartPreset | null;
}) {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [mode, setMode] = useState<SessionMode>('in_person');
  const [problems, setProblems] = useState<string[]>([]);

  const { data: activeData } = useActiveSession();
  const { data: assignmentsData } = useAssignments({ tutor_user_id: user?.id });
  const start = useStartSession();

  // Only the reader's own students: an admin who tutors starts their own lessons.
  const students = (assignmentsData?.data ?? []).filter((row) => row.tutor_user_id === user?.id);
  const running = activeData?.data.mine ?? null;

  useEffect(() => {
    if (!open) return;
    setProblems([]);
    setStudentId(preset?.student_user_id ?? (students.length === 1 ? students[0]!.student_user_id : ''));
    setMode(preset?.mode ?? 'in_person');
    // The preset is read when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset?.student_user_id, preset?.mode]);

  async function handleStart() {
    setProblems([]);
    const parsed = startSessionSchema.safeParse({ student_user_id: studentId, mode });
    if (!parsed.success) {
      setProblems(['Choose the student.']);
      return;
    }
    try {
      await start.mutateAsync(parsed.data);
      toast.success('Lesson started.');
      onOpenChange(false);
    } catch (error) {
      setProblems(error instanceof ApiRequestError ? refusalLines(error) : ['Could not start the lesson.']);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="start-lesson">
        <DialogHeader>
          <DialogTitle>Start a lesson</DialogTitle>
          <DialogDescription>
            The clock starts now. Both the start and the end are recorded to the nearest
            quarter hour.
          </DialogDescription>
        </DialogHeader>

        {running ? (
          <p className="bg-muted/50 rounded-md px-3 py-2.5 text-sm" data-testid="start-lesson-running">
            Your lesson with {running.student_name} is still running. Stop it, from the bar at the top, before
            starting another: one lesson at a time.
          </p>
        ) : (
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

            {problems.length > 0 && <ProblemLines lines={problems} testId="start-lesson-problem" />}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={start.isPending}>
            {running ? 'Close' : 'Cancel'}
          </Button>
          {!running && (
            <Button onClick={handleStart} disabled={!studentId || start.isPending} data-testid="start-lesson-submit">
              {start.isPending && <Loader2Icon className="animate-spin" />}
              Start now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
