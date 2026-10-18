import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, DownloadIcon } from 'lucide-react';
import { formatRelativeTime, levelLabel } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { canvasAssessmentPdfUrl, useCanvasAssessmentSummary } from './api';
import { PdfViewer } from './pdf-viewer';

// Phase 38 and 40: an assessment's PDF, shown in the portal rather than
// downloaded. The submitted one (with the answers) is for the student's current
// tutors and the admins; the reviewed one (`?kind=reviewed`) for the student's
// whole audience, once a tutor has saved it as reviewed (R17).

export function AssessmentPdfPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const kind = params.get('kind') === 'reviewed' ? 'reviewed' : 'submitted';
  const summary = useCanvasAssessmentSummary(id);
  const assessment = summary.data?.data;

  if (summary.isPending) return <Skeleton className="h-96 w-full" />;

  const allowed = assessment && (kind === 'reviewed' ? Boolean(assessment.reviewed_at) : assessment.can_review);
  if (!assessment || !allowed) {
    return (
      <Card className="py-0">
        <CardContent className="grid gap-3 p-6 text-sm">
          <p>
            {kind === 'reviewed'
              ? 'This assessment has not been reviewed yet.'
              : 'This assessment’s PDF is for the student’s tutors and the office.'}
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/assessments">Back to Assessment</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const url = canvasAssessmentPdfUrl(id, kind);
  return (
    <div className="grid gap-4" data-testid={kind === 'reviewed' ? 'reviewed-assessment' : 'submitted-assessment'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/assessments">
              <ArrowLeftIcon /> Assessment
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {kind === 'reviewed' ? 'Review: ' : ''}
            {assessment.student_name} · {levelLabel(assessment.level_id)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {kind === 'reviewed'
              ? `Reviewed by ${assessment.reviewed_by_name ?? 'the tutor'} ${formatRelativeTime(assessment.reviewed_at!)}`
              : `${assessment.questions_written} of ${assessment.question_count} questions written` +
                (assessment.choice_questions
                  ? ` · multiple choice ${assessment.choices_correct} of ${assessment.choice_questions} correct`
                  : '') +
                (assessment.unreviewed_questions
                  ? ` · ${assessment.unreviewed_questions} not yet reviewed in the bank`
                  : '')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === 'submitted' && (
            <Button asChild size="sm">
              <Link to={`/assessments/${id}/review`}>{assessment.reviewed_at ? 'Edit the review' : 'Review'}</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={url} download>
              <DownloadIcon /> Download
            </a>
          </Button>
        </div>
      </div>
      <PdfViewer url={url} label={`${assessment.student_name}'s ${kind === 'reviewed' ? 'reviewed ' : ''}assessment`} />
    </div>
  );
}
