import { CheckIcon, CircleDashedIcon, CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface FlowStepItem {
  key: string;
  label: string;
}

/**
 * Where a guided setup is: each step ticked, current, or still to come. A
 * skipped step is simply not ticked -- skipping is always allowed.
 */
export function FlowSteps({
  steps,
  current,
  done,
}: {
  steps: FlowStepItem[];
  current: string;
  done: ReadonlySet<string>;
}) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Steps">
      {steps.map((step) => {
        const isDone = done.has(step.key);
        const isCurrent = step.key === current;
        const Icon = isDone ? CheckIcon : isCurrent ? CircleIcon : CircleDashedIcon;

        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1',
              isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground',
              isDone && 'text-success',
            )}
          >
            <Icon className="size-3.5" />
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

/** The current step: what it is for, and what to do or skip. */
export function StepPanel({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section className="bg-muted/40 grid gap-3 rounded-lg border p-4">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <div className="text-muted-foreground grid gap-2 text-sm">{children}</div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </section>
  );
}
