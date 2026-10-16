import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { curriculumOfferingSchema, type CurriculumOffering } from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCurriculumOfferings, useUpdateCurriculumOffering } from './api';
import { NotificationsSwitch } from './notifications-switch';

interface Choice {
  offered: string[];
  defaultId: string;
}

function choiceOf(rows: CurriculumOffering[]): Choice {
  return {
    offered: rows.filter((row) => row.offered).map((row) => row.id),
    defaultId: rows.find((row) => row.is_default)?.id ?? '',
  };
}

/**
 * Phase 35: which curricula the organization teaches from, and its default --
 * one row per curriculum with an Offered switch and a default radio, saved
 * together. Leaving one out retires it: it disappears from the pickers, and
 * every plan, assessment and lesson written against it still reads.
 */
export function CurriculaCard() {
  const offerings = useCurriculumOfferings(true);
  const update = useUpdateCurriculumOffering();
  const rows = useMemo(() => offerings.data?.data ?? [], [offerings.data]);

  const [choice, setChoice] = useState<Choice>({ offered: [], defaultId: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChoice(choiceOf(rows));
    setError(null);
  }, [rows]);

  const saved = choiceOf(rows);
  const changed =
    saved.defaultId !== choice.defaultId ||
    saved.offered.length !== choice.offered.length ||
    saved.offered.some((id) => !choice.offered.includes(id));

  function setOffered(id: string, on: boolean) {
    setChoice((previous) => ({
      ...previous,
      offered: on ? [...previous.offered, id] : previous.offered.filter((other) => other !== id),
    }));
  }

  async function save() {
    setError(null);
    // In the catalog's order, so the request reads like the card.
    const input = {
      offered: rows.map((row) => row.id).filter((id) => choice.offered.includes(id)),
      default_curriculum_id: choice.defaultId,
    };
    const verdict = curriculumOfferingSchema.safeParse(input);
    if (!verdict.success) {
      setError(verdict.error.issues[0]?.message ?? 'Check the choice.');
      return;
    }
    try {
      await update.mutateAsync(verdict.data);
      toast.success('Curricula saved.');
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const fields = caught.fieldErrors;
        setError(fields.offered ?? fields.default_curriculum_id ?? caught.message);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the curricula.');
      }
    }
  }

  return (
    <Card className="py-0" data-testid="curricula-card">
      <CardContent className="grid gap-4 p-5 text-sm">
        <div className="grid gap-1">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Curricula</h2>
          <p className="text-muted-foreground text-xs">
            What plans, assessments and lessons are scored against. Turning one off retires it: it
            leaves the pickers, and everything already written against it still reads. New plans and
            assessments start in the default.
          </p>
        </div>

        {offerings.isPending ? (
          <p className="text-muted-foreground text-xs">Loading the curricula…</p>
        ) : (
          <ul className="divide-y rounded-md border" aria-label="Curricula">
            {rows.map((row) => {
              const offered = choice.offered.includes(row.id);
              const isDefault = choice.defaultId === row.id;
              return (
                <li
                  key={row.id}
                  data-testid={`curriculum-${row.id}`}
                  className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center"
                >
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      <span className="min-w-0 break-words">{row.name}</span>
                      {row.is_default && <Badge variant="secondary">Default</Badge>}
                      {row.retired && <Badge variant="outline">Retired</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs break-words">
                      {[row.source, `${row.level_count} levels`, `${row.topic_count} topics`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label
                      className={cn(
                        'flex items-center gap-1.5 text-xs',
                        !offered && 'text-muted-foreground opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name="default-curriculum"
                        className="accent-primary size-4"
                        checked={isDefault}
                        disabled={!offered || update.isPending}
                        aria-label={`Make ${row.name} the default`}
                        onChange={() => setChoice((previous) => ({ ...previous, defaultId: row.id }))}
                      />
                      Default
                    </label>
                    <span className="flex items-center gap-2 text-xs">
                      Offered
                      <NotificationsSwitch
                        checked={offered}
                        // The default is always offered: choose another default first.
                        disabled={isDefault || update.isPending}
                        label={`Offer ${row.name}`}
                        onCheckedChange={(next) => setOffered(row.id, next)}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {changed && (
            <Button
              type="button"
              variant="ghost"
              disabled={update.isPending}
              onClick={() => {
                setChoice(saved);
                setError(null);
              }}
            >
              Undo
            </Button>
          )}
          <Button type="button" onClick={() => void save()} disabled={!changed || update.isPending}>
            Save curricula
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
