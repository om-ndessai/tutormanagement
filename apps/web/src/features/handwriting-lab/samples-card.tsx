import { toast } from 'sonner';
import { CheckIcon, DownloadIcon, Trash2Icon, XIcon } from 'lucide-react';
import { HANDWRITING_SAMPLE_CATEGORY_LABELS } from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimestamp } from '@/lib/utils';
import { MathText } from '@/features/question-bank/math-text';
import { errorMessage } from '@/features/question-bank/question-card';
import { corpusUrl, useDeleteHandwritingSample, useHandwritingSamples } from './api';

const percent = (part: number, whole: number) => (whole === 0 ? '–' : `${Math.round((part / whole) * 100)}%`);

/** The lab's corpus: how often the reader was right when each line was saved, and the newest lines. */
export function SamplesCard() {
  const samples = useHandwritingSamples();
  const remove = useDeleteHandwritingSample();
  const list = samples.data?.data;

  return (
    <Card className="py-0" data-testid="samples-card">
      <CardContent className="grid gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-medium">Samples</h2>
            <p className="text-muted-foreground text-sm text-pretty">
              Lines kept with what they say. Run them through the reader again with{' '}
              <code className="bg-muted rounded px-1 text-xs">npm run handwriting:eval</code> after changing it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={corpusUrl('samples')} download>
                <DownloadIcon /> Samples
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={corpusUrl('synthetic')} download>
                <DownloadIcon /> Synthetic set
              </a>
            </Button>
          </div>
        </div>

        {samples.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !list || list.summary.total === 0 ? (
          <p className="text-muted-foreground text-sm">No samples yet. Write a line, then say whether it was read right.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" data-testid="samples-summary">
              <Badge>
                {list.summary.total} {list.summary.total === 1 ? 'sample' : 'samples'} · read right{' '}
                {percent(list.summary.matched, list.summary.total)}
              </Badge>
              {list.summary.by_category.map((entry) => (
                <Badge key={entry.category} variant="outline">
                  {HANDWRITING_SAMPLE_CATEGORY_LABELS[entry.category]}: {entry.matched}/{entry.total}
                </Badge>
              ))}
            </div>
            <ul className="divide-border grid divide-y" aria-label="Newest samples">
              {list.samples.map((sample) => (
                <li key={sample.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm" data-testid="sample-row">
                  {sample.matched ? (
                    <CheckIcon className="text-primary size-4 shrink-0" aria-label="Read right" />
                  ) : (
                    <XIcon className="text-destructive size-4 shrink-0" aria-label="Misread" />
                  )}
                  <span className="min-w-0">
                    <MathText text={`$${sample.truth}$`} />
                  </span>
                  {!sample.matched && (
                    <span className="text-muted-foreground min-w-0 text-xs">
                      read as{' '}
                      {sample.reading ? <code className="bg-muted rounded px-1 break-all">{sample.reading}</code> : 'nothing'}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {HANDWRITING_SAMPLE_CATEGORY_LABELS[sample.category]} · {sample.reading_model ?? 'not read'} ·{' '}
                    {sample.written_by_name ?? 'someone'} · {formatTimestamp(sample.created_at, '')}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Delete sample"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(sample.id, {
                        onSuccess: () => toast.success('Sample deleted.'),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
