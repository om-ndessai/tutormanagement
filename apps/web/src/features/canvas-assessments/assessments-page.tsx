import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileTextIcon } from 'lucide-react';
import {
  CANVAS_ASSESSMENT_STATUS_LABELS,
  COMMON_COPY,
  formatRelativeTime,
  type CanvasAssessment,
  type CanvasAssessmentLevelId,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useUsers } from '@/features/users/api';
import { levelWords } from '@/features/quest/level-words';
import { useScreenNow } from './screen-now';
import {
  useCanvasAssessmentLevels,
  useCanvasAssessments,
  useDiscardCanvasAssessment,
  useStartCanvasAssessment,
} from './api';

// Phase 38: the Assessment menu, docs/canvas-assessment-plan.md. Since Phase 78 (owner, 2026-11-05) it carries no
// Beta mark: checked questions are served like any other.

export function AssessmentsPage() {
  return (
    <>
      <PageHeader
        title="Assessment"
        description="A student answers questions by hand, one per page, with nothing marked while they work. When it is submitted, their tutors get a PDF of the questions and the handwriting."
      />
      <div className="grid gap-6">
        <StartCard />
        <AssessmentList />
      </div>
    </>
  );
}

export function StartCard() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const onlyStudent = Boolean(user && user.roles.length > 0 && user.roles.every((role) => role === 'student'));
  // The students this reader may follow: a tutor's own, a parent's children, everyone for an admin.
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name', order: 'asc' }, { enabled: !onlyStudent });
  const levels = useCanvasAssessmentLevels();
  const start = useStartCanvasAssessment();
  // Phase 77 (JF20): the list already holds what Start warns about (shared with the list below through the cache).
  const list = useCanvasAssessments();
  const [inProgress, setInProgress] = useState<CanvasAssessment | null>(null);
  // Phase 78: the same `now` as the list's rows, so the warning and the row say the same time.
  const now = useScreenNow();

  // Phase 50: "Start an assessment" elsewhere (the welcome wizard, the Assessment home) names the student.
  const [params] = useSearchParams();
  const [studentId, setStudentId] = useState(params.get('student') ?? '');
  const [levelId, setLevelId] = useState('');

  const chosenStudent = onlyStudent ? (user?.id ?? '') : studentId;
  const studentList = students.data?.data ?? [];
  const levelList = levels.data?.data ?? [];

  /** Phase 77 (JF20): one already in progress for this student is offered first -- Continue it, or Start another. */
  function tryBegin() {
    const open = (list.data?.data ?? [])
      .filter((row) => row.student_user_id === chosenStudent && row.status === 'in_progress')
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    if (open) setInProgress(open);
    else void begin();
  }

  async function begin() {
    setInProgress(null);
    try {
      const created = await start.mutateAsync({
        student_user_id: chosenStudent,
        level_id: levelId as CanvasAssessmentLevelId,
      });
      navigate(`/assessments/${created.data.id}`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not start the assessment.');
    }
  }

  return (
    <Card className="py-0" data-testid="assessment-start">
      <CardContent className="grid gap-4 p-5">
        <h2 className="text-muted-foreground text-[13px] font-semibold">Start an assessment</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {!onlyStudent && (
            <div className="grid gap-1.5">
              <Label htmlFor="assessment-student">Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="assessment-student" className="w-full">
                  <SelectValue placeholder={students.isPending ? 'Loading…' : 'Choose a student'} />
                </SelectTrigger>
                <SelectContent>
                  {studentList.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="assessment-level">Level</Label>
            <Select value={levelId} onValueChange={setLevelId}>
              <SelectTrigger id="assessment-level" className="w-full">
                <SelectValue placeholder="Choose a level" />
              </SelectTrigger>
              <SelectContent>
                {levelList.map((level) => (
                  <SelectItem key={level.level_id} value={level.level_id} disabled={level.available === 0}>
                    {/* Phase 78 (JF32): the level in words, and no "includes unreviewed": checked questions are like any other. */}
                    {levelWords(level.level_id)} ·{' '}
                    {level.available === 0
                      ? 'no approved questions yet'
                      : `${Math.min(level.available, organization?.canvas_assessment_questions ?? 10)} question${level.available === 1 ? '' : 's'}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={tryBegin} disabled={!chosenStudent || !levelId || start.isPending} data-testid="assessment-begin">
            Start
          </Button>
        </div>
        {!onlyStudent && !students.isPending && studentList.length === 0 && (
          // A parent let in with no child linked once met an empty picker and a grey Start, with no reason
          // (UI audit J07 steps 26-28, JF1).
          <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm" role="status" data-testid="assessment-no-students">
            {user?.roles.includes('admin')
              ? `No students here yet. Add one from ${COMMON_COPY.people_page}, then start an assessment for them here.`
              : `No children are linked to you in ${organization?.name ?? 'this space'} yet. ${
                  organization?.admin_names?.length
                    ? `${organization.admin_names.join(' or ')} adds them: ask to link your child`
                    : "The space's admins add them: ask one to link your child"
                }, then start an assessment for them here.`}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          Up to {organization?.canvas_assessment_questions ?? 10} questions of the level, chosen at random from the question
          bank. Multiple-choice questions are answered by choosing; the canvas is there for working. Work can be revisited and
          changed until it is submitted.
        </p>
      </CardContent>
      <AlertDialog open={inProgress !== null} onOpenChange={(open) => !open && setInProgress(null)}>
        <AlertDialogContent data-testid="assessment-in-progress">
          <AlertDialogHeader>
            <AlertDialogTitle>One is already in progress</AlertDialogTitle>
            <AlertDialogDescription data-testid="assessment-in-progress-words">
              {inProgress && inProgressWords(inProgress, inProgress.student_user_id === user?.id, now)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="assessment-in-progress-cancel">Not now</AlertDialogCancel>
            <Button variant="outline" onClick={() => void begin()} disabled={start.isPending} data-testid="assessment-start-another">
              Start another
            </Button>
            {inProgress?.can_continue && (
              <AlertDialogAction onClick={() => navigate(`/assessments/${inProgress.id}`)} data-testid="assessment-continue-it">
                Continue it
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** "Noor already has a Grade 4 assessment in progress (started 8 minutes ago)." */
function inProgressWords(row: CanvasAssessment, own: boolean, now: Date): string {
  const level = levelWords(row.level_id);
  const who = own ? 'You already have' : `${firstName(row.student_name)} already has`;
  return `${who} ${/^[aeiou]/i.test(level) ? 'an' : 'a'} ${level} assessment in progress (started ${formatRelativeTime(row.started_at, now)}).`;
}

export function AssessmentList() {
  const list = useCanvasAssessments();
  const discard = useDiscardCanvasAssessment();
  const [discarding, setDiscarding] = useState<CanvasAssessment | null>(null);
  const rows = list.data?.data ?? [];
  const now = useScreenNow();

  async function confirmDiscard() {
    if (!discarding) return;
    try {
      await discard.mutateAsync(discarding.id);
      toast.success('Assessment discarded.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not discard the assessment.');
    } finally {
      setDiscarding(null);
    }
  }

  return (
    <section className="grid gap-3" aria-label="Assessments">
      <h2 className="text-muted-foreground text-[13px] font-semibold">Assessments</h2>
      {list.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No assessments yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="py-0" data-testid={`assessment-${row.id}`}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.student_name}</span>
                      <span className="text-muted-foreground text-sm">{levelWords(row.level_id)}</span>
                      <Badge
                        variant={row.status === 'submitted' ? 'default' : 'secondary'}
                        data-testid={`assessment-status-${row.id}`}
                      >
                        {row.reviewed_at ? 'Reviewed' : CANVAS_ASSESSMENT_STATUS_LABELS[row.status]}
                      </Badge>
                      {row.review_draft && <Badge variant="outline">Review in progress</Badge>}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {row.status === 'submitted'
                        ? `${row.questions_written} of ${row.question_count} questions written` +
                          (row.choice_questions ? ` · ${row.choices_correct} of ${row.choice_questions} choices correct` : '') +
                          ` · submitted ${formatRelativeTime(row.submitted_at ?? row.started_at, now)}` +
                          (row.reviewed_at && row.reviewed_by_name ? ` · reviewed by ${row.reviewed_by_name}` : '')
                        : `${row.question_count} questions · started ${formatRelativeTime(row.started_at, now)}`}
                      {row.started_by_name ? ` · started by ${row.started_by_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.can_continue && (
                      <Button asChild size="sm" data-testid={`assessment-continue-${row.id}`}>
                        <Link to={`/assessments/${row.id}`}>Continue</Link>
                      </Button>
                    )}
                    {/* Phase 77 (JF20): a guardian continues a child's; only its starter or an admin discards it
                        (an older Worker sends no can_discard: the old rule). */}
                    {(row.can_discard ?? row.can_continue) && (
                      <Button size="sm" variant="outline" onClick={() => setDiscarding(row)} data-testid={`assessment-discard-${row.id}`}>
                        Discard
                      </Button>
                    )}
                    {row.can_review && (
                      <>
                        <Button asChild size="sm">
                          <Link to={`/assessments/${row.id}/review`}>
                            {row.reviewed_at ? 'Edit review' : row.review_draft ? 'Continue review' : 'Review'}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/assessments/${row.id}/pdf`}>
                            <FileTextIcon /> Submitted PDF
                          </Link>
                        </Button>
                      </>
                    )}
                    {row.reviewed_at && (
                      <Button asChild size="sm" variant={row.can_review ? 'outline' : 'default'}>
                        <Link to={`/assessments/${row.id}/pdf?kind=reviewed`}>Open the review</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={discarding !== null} onOpenChange={(open) => !open && setDiscarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              The writing on it is thrown away and it can no longer be submitted. It stays in the list as discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDiscard()}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
