import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, DownloadIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PdfViewer } from '@/features/canvas-assessments/pdf-viewer';
import { progressReportUrl, useStudentProgress } from './api';

// Phase 58: the progress report, shown in the portal's pdf.js viewer the way an
// assessment's PDF is (docs/progress-report-plan.md). The Worker builds a fresh
// PDF on every open; a refused range (400) or a student this reader cannot see
// (404) shows the envelope's message in the viewer.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
}

export function ProgressReportPage() {
  const { studentId = '' } = useParams();
  const [params] = useSearchParams();
  // Only well-formed dates travel; anything else is left to the Worker's default.
  const from = ISO_DATE.test(params.get('from') ?? '') ? params.get('from')! : undefined;
  const to = ISO_DATE.test(params.get('to') ?? '') ? params.get('to')! : undefined;
  const original = params.get('original') === '1';

  // Usually cached from the progress page; it only names the student.
  const { data } = useStudentProgress(studentId);
  const name = data?.data.student.full_name;

  const url = progressReportUrl(studentId, { from, to, original });
  const range = from && to ? `${longDate(from)} → ${longDate(to)}` : 'From the plan’s start to today';

  return (
    <div className="mx-auto grid max-w-6xl gap-4" data-testid="progress-report-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to={`/progress/${studentId}`}>
              <ArrowLeftIcon /> {name ? `${name}'s progress` : 'Progress'}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Progress report{name ? `: ${name}` : ''}</h1>
          <p className="text-muted-foreground text-sm">
            {range}
            {original ? ' · with the original assessment' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={url} download data-testid="progress-report-download">
              <DownloadIcon /> Download
            </a>
          </Button>
        </div>
      </div>
      <PdfViewer url={url} label={`${name ?? 'The student'}'s progress report`} />
    </div>
  );
}
