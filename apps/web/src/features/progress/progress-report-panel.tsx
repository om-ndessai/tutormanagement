import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileTextIcon } from 'lucide-react';
import { progressReportRangeProblem } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/features/dashboard/stat-card';

// Phase 58 (docs/progress-report-plan.md): the progress report, at the very
// bottom of a student's progress page. Every reader of the page may make one;
// the Worker builds the PDF and lists only the lessons that reader could see.

/** YYYY-MM-DD, `days` before another (calendar arithmetic, no clock involved). */
function daysBefore(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function ProgressReportPanel({
  studentId,
  planStartsOn,
  today,
  index,
}: {
  studentId: string;
  /** The current plan's start, the default From; without a plan, 90 days back. */
  planStartsOn: string | null;
  /** Today on the organization's clock, from the progress response. */
  today: string;
  index: number;
}) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(() =>
    planStartsOn && planStartsOn <= today ? planStartsOn : daysBefore(today, 90),
  );
  const [to, setTo] = useState(today);
  const [original, setOriginal] = useState(false);

  const problem = !from || !to ? 'Choose both dates.' : progressReportRangeProblem(from, to);

  function generate() {
    if (problem) return;
    const params = new URLSearchParams({ from, to });
    if (original) params.set('original', '1');
    navigate(`/progress/${studentId}/report?${params.toString()}`);
  }

  return (
    <Panel index={index} title="Progress report">
      <div data-testid="progress-report" className="grid gap-3">
        <p className="text-muted-foreground text-xs">
          A PDF of the goal, the timeline and the lessons in these dates, with their notes. It carries no
          amounts.
        </p>
        {/* Stacked on phones: fixed-width fields side by side would push the page wider. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="progress-report-from">From</Label>
            <Input
              id="progress-report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full sm:w-44"
              data-testid="progress-report-from"
              aria-invalid={problem ? true : undefined}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="progress-report-to">To</Label>
            <Input
              id="progress-report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full sm:w-44"
              data-testid="progress-report-to"
              aria-invalid={problem ? true : undefined}
            />
          </div>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={original}
              onChange={(event) => setOriginal(event.target.checked)}
              data-testid="progress-report-original"
            />
            Include original assessment
          </label>
          <Button
            onClick={generate}
            disabled={problem !== null}
            className="w-full sm:ml-auto sm:w-auto"
            data-testid="progress-report-generate"
          >
            <FileTextIcon />
            Generate Progress
          </Button>
        </div>
        {problem && (
          <p className="text-destructive text-sm" role="alert" data-testid="progress-report-problem">
            {problem}
          </p>
        )}
      </div>
    </Panel>
  );
}
