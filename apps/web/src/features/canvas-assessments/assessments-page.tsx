import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileTextIcon } from 'lucide-react';
import {
  CANVAS_ASSESSMENT_STATUS_LABELS,
  formatRelativeTime,
  levelLabel,
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
import {
  useCanvasAssessmentLevels,
  useCanvasAssessments,
  useDiscardCanvasAssessment,
  useStartCanvasAssessment,
} from './api';

// Phase 38: the Assessment menu (beta), docs/canvas-assessment-plan.md.

export function AssessmentsPage() {
  return (
    <>
      <PageHeader
        title="Assessment"
        description="In beta. A student answers questions by hand, one per page, with nothing marked while they work. When it is submitted, their tutors get a PDF of the questions and the handwriting."
        actions={<Badge variant="secondary">Beta</Badge>}
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

  // Phase 50: "Start an assessment" elsewhere (the welcome wizard, the Assessment home) names the student.
  const [params] = useSearchParams();
  const [studentId, setStudentId] = useState(params.get('student') ?? '');
  const [levelId, setLevelId] = useState('');

  const chosenStudent = onlyStudent ? (user?.id ?? '') : studentId;
  const studentList = students.data?.data ?? [];
  const levelList = levels.data?.data ?? [];

  async function begin() {
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
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Start an assessment</h2>
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
                    {level.label} ·{' '}
                    {level.available === 0
                      ? 'no approved questions yet'
                      : `${Math.min(level.available, organization?.canvas_assessment_questions ?? 10)} question${level.available === 1 ? '' : 's'}` +
                        (level.unreviewed > 0 ? ' · includes unreviewed' : '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void begin()} disabled={!chosenStudent || !levelId || start.isPending} data-testid="assessment-begin">
            Start
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Up to {organization?.canvas_assessment_questions ?? 10} questions of the level, chosen at random
          {organization?.canvas_assessments_unreviewed
            ? ', including questions not yet reviewed in the bank (your organization is trying them out)'
            : ' from the approved ones'}
          . Multiple-choice questions are answered by choosing; the canvas is there for working. Work can be revisited and
          changed until it is submitted.
        </p>
      </CardContent>
    </Card>
  );
}

export function AssessmentList() {
  const list = useCanvasAssessments();
  const discard = useDiscardCanvasAssessment();
  const [discarding, setDiscarding] = useState<CanvasAssessment | null>(null);
  const rows = list.data?.data ?? [];

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
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Assessments</h2>
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
                      <span className="text-muted-foreground text-sm">{levelLabel(row.level_id)}</span>
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
                          ` · submitted ${formatRelativeTime(row.submitted_at ?? row.started_at)}` +
                          (row.reviewed_at && row.reviewed_by_name ? ` · reviewed by ${row.reviewed_by_name}` : '')
                        : `${row.question_count} questions · started ${formatRelativeTime(row.started_at)}`}
                      {row.started_by_name ? ` · started by ${row.started_by_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.can_continue && (
                      <>
                        <Button asChild size="sm">
                          <Link to={`/assessments/${row.id}`}>Continue</Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDiscarding(row)}>
                          Discard
                        </Button>
                      </>
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
