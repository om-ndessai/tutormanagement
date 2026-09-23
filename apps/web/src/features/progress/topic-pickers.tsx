import { useMemo, useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import type { CurriculumLevel, Rating } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { RatingChip, RatingPicker, TopicName } from './rating';

/** Level picker shared by every form that needs one. "" means none. */
export function LevelSelect({
  id,
  levels,
  value,
  onChange,
  placeholder = 'Choose a level',
  allowNone = false,
}: {
  id?: string;
  levels: CurriculumLevel[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
}) {
  return (
    <Select value={value || (allowNone ? 'none' : '')} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">None</SelectItem>}
        {levels.map((level) => (
          <SelectItem key={level.id} value={level.id}>
            <span className="font-mono text-xs">{level.id}</span>
            <span className="ml-1.5">{level.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Scores topics one level at a time: "pick topic 10 from level 3 and mark it
 * 1". Choosing another level keeps what was scored elsewhere, and the chips
 * above the list show every score so far across all levels.
 */
export function TopicRatingsEditor({
  levels,
  ratings,
  onChange,
  initialLevel,
}: {
  levels: CurriculumLevel[];
  ratings: Map<string, Rating>;
  onChange: (next: Map<string, Rating>) => void;
  initialLevel?: string;
}) {
  const [levelId, setLevelId] = useState(initialLevel || levels[0]?.id || '');
  const level = levels.find((candidate) => candidate.id === levelId);

  const perLevel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const topicId of ratings.keys()) {
      const code = topicId.split('.')[0]!;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [ratings]);

  function set(topicId: string, value: Rating | null) {
    const next = new Map(ratings);
    if (value === null) next.delete(topicId);
    else next.set(topicId, value);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {levels.map((candidate) => {
          const count = perLevel.get(candidate.id) ?? 0;
          return (
            <Button
              key={candidate.id}
              type="button"
              size="sm"
              variant={candidate.id === levelId ? 'default' : 'outline'}
              className="h-7 px-2 font-mono text-xs"
              onClick={() => setLevelId(candidate.id)}
            >
              {candidate.id}
              {count > 0 && (
                <span className="bg-background/25 rounded px-1 font-sans text-[10px]">{count}</span>
              )}
            </Button>
          );
        })}
      </div>

      {level && (
        <div className="rounded-md border">
          <p className="bg-muted/50 border-b px-3 py-2 text-xs font-medium">
            {level.name}
            {level.grade_band && (
              <span className="text-muted-foreground font-normal"> · {level.grade_band}</span>
            )}
          </p>
          <ul className="divide-y">
            {level.topics.map((topic) => (
              <li
                key={topic.id}
                className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <TopicName id={topic.id} name={topic.name} unit={topic.unit} className="text-sm" />
                <RatingPicker
                  name={`${topic.id} ${topic.name}`}
                  value={ratings.get(topic.id) ?? null}
                  onChange={(value) => set(topic.id, value)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Chooses the plan's topics, in teaching order. Topics are added from any
 * level -- the "add some topics from a lower level" case -- and the chosen
 * list reads top to bottom as the order they will be taught.
 */
export function PlanTopicsEditor({
  levels,
  value,
  onChange,
  baseline,
}: {
  levels: CurriculumLevel[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Scores from the assessment, shown beside each topic to guide the choice. */
  baseline: Map<string, Rating>;
}) {
  const [levelId, setLevelId] = useState(value[0]?.split('.')[0] ?? levels[0]?.id ?? '');
  const level = levels.find((candidate) => candidate.id === levelId);
  const chosen = new Set(value);

  const names = useMemo(() => {
    const map = new Map<string, { name: string; unit: string | null }>();
    for (const l of levels) for (const t of l.topics) map.set(t.id, t);
    return map;
  }, [levels]);

  function toggle(topicId: string) {
    onChange(chosen.has(topicId) ? value.filter((id) => id !== topicId) : [...value, topicId]);
  }

  function move(index: number, by: -1 | 1) {
    const next = [...value];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <LevelSelect levels={levels} value={levelId} onChange={setLevelId} />
        {level && (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {level.topics.map((topic) => {
              const selected = chosen.has(topic.id);
              return (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => toggle(topic.id)}
                    aria-pressed={selected}
                    className={cn(
                      'hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                      selected && 'bg-accent/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        selected && 'bg-primary border-primary text-primary-foreground',
                      )}
                    >
                      {selected && <CheckIcon className="size-3" />}
                    </span>
                    <TopicName id={topic.id} name={topic.name} className="flex-1" />
                    {baseline.has(topic.id) && <RatingChip rating={baseline.get(topic.id)!} className="size-5 text-[10px]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {value.length === 0
            ? 'No topics chosen yet. Pick them from any level, in the order to teach them.'
            : `${value.length} ${value.length === 1 ? 'topic' : 'topics'}, in teaching order`}
        </p>
        {value.length > 0 && (
          <ol className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {value.map((topicId, index) => (
              <li key={topicId} className="flex items-center gap-1 px-2 py-1 text-sm">
                <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">
                  {index + 1}
                </span>
                <TopicName id={topicId} name={names.get(topicId)?.name} className="flex-1 truncate" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Move ${topicId} earlier`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Move ${topicId} later`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Remove ${topicId}`}
                  onClick={() => toggle(topicId)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
