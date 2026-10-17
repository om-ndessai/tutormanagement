import { useState } from 'react';
import { toast } from 'sonner';
import {
  AI_RUN_OUTCOME_LABELS,
  formatMicrodollars,
  type AiTaskStatus,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotificationsSwitch } from '@/features/organizations/notifications-switch';
import { cn, formatTimestamp } from '@/lib/utils';
import { useAiRuns, useAiTasks, useUpdateAiTask } from './api';
import { errorMessage } from './question-card';

const dollars = (cents: number) => (cents / 100).toFixed(2);

function TaskCard({ task }: { task: AiTaskStatus }) {
  const update = useUpdateAiTask();
  const [daily, setDaily] = useState(dollars(task.daily_cap_cents));
  const [monthly, setMonthly] = useState(dollars(task.monthly_cap_cents));
  const save = (input: Parameters<typeof update.mutate>[0]['input'], message: string) =>
    update.mutate(
      { task: task.id, input },
      { onSuccess: () => toast.success(message), onError: (error) => toast.error(errorMessage(error)) },
    );

  return (
    <Card className="py-0" data-testid={`ai-task-${task.id}`}>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{task.label}</p>
            <p className="text-muted-foreground text-sm">{task.description}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {task.model} ·{' '}
              {task.effective_provider === 'fake' ? 'answered by the test stand-in here, costing nothing' : 'Anthropic'}
              {task.child_input ? ' · needs parental consent' : ' · no personal data'}
            </p>
          </div>
          <NotificationsSwitch
            label={`${task.label} on`}
            checked={task.enabled}
            disabled={update.isPending}
            onCheckedChange={(enabled) => save({ enabled }, enabled ? `${task.label}: on.` : `${task.label}: off.`)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <Label htmlFor={`${task.id}-daily`}>
              Daily cap, $ · spent {formatMicrodollars(task.spent_today_microdollars)} today
            </Label>
            <Input id={`${task.id}-daily`} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${task.id}-monthly`}>
              Monthly cap, $ · spent {formatMicrodollars(task.spent_month_microdollars)} this month
            </Label>
            <Input id={`${task.id}-monthly`} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
          <Button
            variant="outline"
            disabled={update.isPending}
            onClick={() => {
              const daily_cap_cents = Math.round(Number(daily) * 100);
              const monthly_cap_cents = Math.round(Number(monthly) * 100);
              if (!Number.isFinite(daily_cap_cents) || !Number.isFinite(monthly_cap_cents) || daily_cap_cents < 0 || monthly_cap_cents < 0) {
                toast.error('Caps are amounts in dollars, like 5.00.');
                return;
              }
              save({ daily_cap_cents, monthly_cap_cents }, 'Caps saved.');
            }}
          >
            Save caps
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The AI page (Phase 36): each task's switch, caps and spend, and every call
 * made -- refused ones too -- with its outcome and cost. Never what was sent or
 * returned: the log holds neither.
 */
export function AiPage() {
  const tasks = useAiTasks();
  const runs = useAiRuns();

  return (
    <>
      <PageHeader
        title="AI"
        description="Every model call goes through one gateway: it checks the switch and the caps, refuses anything carrying an SSN or a child’s own work without consent, and logs the call without its content."
      />
      <div className="mb-8 grid gap-4">
        {(tasks.data?.data ?? []).map((task) => (
          <TaskCard key={`${task.id}-${task.daily_cap_cents}-${task.monthly_cap_cents}`} task={task} />
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold">Recent calls</h2>
      <Card className="py-0">
        <CardContent className="p-0">
          <ul className="divide-y" aria-label="Recent AI calls" data-testid="ai-runs">
            {(runs.data?.data ?? []).map((run) => (
              <li key={run.id} className="grid gap-0.5 px-4 py-2.5 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('border-transparent', run.outcome === 'ok' ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive')}
                  >
                    {AI_RUN_OUTCOME_LABELS[run.outcome]}
                  </Badge>
                  {run.task} · {run.model}
                  {run.detail && <span className="text-muted-foreground">({run.detail})</span>}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {run.input_tokens.toLocaleString()} in · {run.output_tokens.toLocaleString()} out ·{' '}
                  {formatMicrodollars(run.cost_microdollars)}
                  {run.provider === 'fake' ? ' (stand-in)' : ''} · {run.actor_name ?? '—'} · {formatTimestamp(run.created_at, '')}
                </span>
              </li>
            ))}
            {runs.isSuccess && runs.data.data.length === 0 && (
              <li className="text-muted-foreground px-4 py-6 text-sm">No calls yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
