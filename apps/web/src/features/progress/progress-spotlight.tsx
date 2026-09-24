import { Link } from 'react-router-dom';
import type { StudentProgress } from '@tmi/shared';

import { Card, CardContent } from '@/components/ui/card';
import { ENTER, EmptyNote, stagger } from '@/features/dashboard/stat-card';
import { cn } from '@/lib/utils';
import { ProgressChart } from './progress-chart';
import { ProgressStatusBadge } from './rating';

/**
 * The dashboard's Progress section (Phase 21): a handful of students, each a
 * small card with the compressed goal timeline. The whole card opens that
 * student's progress page, where the full chart is.
 */
export function ProgressSpotlight({
  students,
  index,
  empty,
}: {
  students: StudentProgress[];
  index: number;
  empty: string;
}) {
  if (students.length === 0) return <EmptyNote>{empty}</EmptyNote>;

  return (
    <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {students.map((progress, position) => (
        <ProgressSpotlightCard
          key={progress.student.user_id}
          progress={progress}
          index={index + position}
        />
      ))}
    </div>
  );
}

function ProgressSpotlightCard({ progress, index }: { progress: StudentProgress; index: number }) {
  const { plan, summary, student } = progress;

  return (
    <Link
      to={`/progress/${student.user_id}`}
      className={cn('group block min-w-0', ENTER)}
      style={stagger(index)}
      data-testid="progress-spotlight-card"
    >
      <Card className="hover:border-primary/40 h-full gap-0 py-0 transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full flex-col px-3.5 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium">{student.full_name}</p>
            <ProgressStatusBadge status={summary.status} />
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {plan
              ? `${summary.mastered_count} of ${summary.topic_count} topics · ${summary.percent}%`
              : 'No learning plan yet'}
          </p>

          <div className="mt-auto pt-2">
            {plan ? (
              <ProgressChart
                compact
                plan={plan}
                summary={summary}
                timeline={progress.timeline}
                today={progress.today}
                cancellations={progress.cancellations}
              />
            ) : (
              <div className="bg-muted/50 h-16 rounded-md" aria-hidden />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
