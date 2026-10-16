import { Fragment, useMemo, useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import {
  indexCurriculum,
  pickerLevels,
  topicsByUnit,
  type Curriculum,
  type CurriculumLevel,
  type CurriculumTopic,
  type Rating,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCurricula } from './api';
import { RatingChip, RatingPicker, TopicName } from './rating';

// Phase 35: an organization may offer several curricula. The pickers show the
// levels of those still offered -- a retired one's only where something
// already chosen is in it, so an old plan still shows (and saves) its topics --
// and offer a switch between curricula only when there are two or more to
// switch between. With one, as at the institute, there is no switch.

/** The curricula a picker can switch between: those with a level it may show, in the list's order. */
function useSwitchable(levels: CurriculumLevel[]): Curriculum[] {
  const { data } = useCurricula();
  return useMemo(() => {
    const present = new Set(levels.map((level) => level.curriculum_id));
    return (data?.data ?? []).filter((curriculum) => present.has(curriculum.id));
  }, [data, levels]);
}

/** A curriculum's label in a switch: its name, and "retired" where it is. */
function curriculumLabel(curriculum: Curriculum) {
  return curriculum.retired ? `${curriculum.name} (retired)` : curriculum.name;
}

/** Two or more curricula: one button each. One: nothing at all. */
export function CurriculumSwitch({
  curricula,
  value,
  onChange,
}: {
  curricula: Curriculum[];
  value: string;
  onChange: (curriculumId: string) => void;
}) {
  if (curricula.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Curriculum" className="flex flex-wrap gap-1.5" data-testid="curriculum-switch">
      {curricula.map((curriculum) => (
        <Button
          key={curriculum.id}
          type="button"
          size="sm"
          role="radio"
          aria-checked={curriculum.id === value}
          variant={curriculum.id === value ? 'secondary' : 'ghost'}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(curriculum.id)}
        >
          {curriculumLabel(curriculum)}
        </Button>
      ))}
    </div>
  );
}

/**
 * Which curriculum a picker opens on: the one holding the level it starts at,
 * else the first it may show (the default, which the API lists first).
 */
function startingCurriculum(levels: CurriculumLevel[], levelId: string | undefined): string {
  return levels.find((level) => level.id === levelId)?.curriculum_id ?? levels[0]?.curriculum_id ?? '';
}

/**
 * The curriculum switch's state for a picker: the levels it may show, the
 * chosen curriculum and level. What it keeps showing is everything chosen
 * since it opened, so clearing an old plan's last retired topic does not pull
 * that curriculum out from under the reader.
 */
function usePickerState(allLevels: CurriculumLevel[], keep: string[], startLevel: string | undefined) {
  const [seen] = useState(() => new Set<string>());
  for (const id of keep) seen.add(id);
  if (startLevel) seen.add(startLevel);
  const shown = pickerLevels(allLevels, seen);
  const curricula = useSwitchable(shown);

  const [chosenCurriculum, setCurriculumId] = useState(() => startingCurriculum(shown, startLevel));
  const curriculumId = shown.some((level) => level.curriculum_id === chosenCurriculum)
    ? chosenCurriculum
    : startingCurriculum(shown, startLevel);
  const levels = shown.filter((level) => level.curriculum_id === curriculumId);
  const [chosenLevel, setLevelId] = useState(startLevel || levels[0]?.id || '');
  const level = levels.find((candidate) => candidate.id === chosenLevel);

  function chooseCurriculum(next: string) {
    setCurriculumId(next);
    setLevelId(shown.find((candidate) => candidate.curriculum_id === next)?.id ?? '');
  }

  return { curricula, curriculumId, chooseCurriculum, levels, levelId: level?.id ?? '', setLevelId, level };
}

/** A level's topics under their unit (a guide book, a domain), in teaching order. */
function TopicRows({
  topics,
  render,
}: {
  topics: CurriculumTopic[];
  render: (topic: CurriculumTopic) => React.ReactNode;
}) {
  return (
    <>
      {topicsByUnit(topics).map((group, index) => (
        <Fragment key={`${group.unit ?? ''}-${index}`}>
          {group.unit && (
            <li
              role="presentation"
              className="bg-muted/30 text-muted-foreground px-3 py-1 text-[11px] font-medium tracking-wide uppercase"
            >
              {group.unit}
            </li>
          )}
          {group.topics.map(render)}
        </Fragment>
      ))}
    </>
  );
}

/** The topic's description, as a second line under its name: what a state standard asks. */
function TopicDescription({ text }: { text: string | null }) {
  if (!text) return null;
  return <span className="text-muted-foreground line-clamp-2 block text-xs">{text}</span>;
}

/**
 * Level picker shared by every form that needs one. "" means none. Levels of
 * a retired curriculum are left out unless one is the value; with two or more
 * curricula the list is grouped under their names.
 */
export function LevelSelect({
  id,
  levels: allLevels,
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
  const levels = useMemo(() => pickerLevels(allLevels, value ? [value] : []), [allLevels, value]);
  const curricula = useSwitchable(levels);
  const item = (level: CurriculumLevel) => (
    <SelectItem key={level.id} value={level.id}>
      <span className="font-mono text-xs">{level.code}</span>
      <span className="ml-1.5">{level.name}</span>
    </SelectItem>
  );

  return (
    <Select value={value || (allowNone ? 'none' : '')} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">None</SelectItem>}
        {curricula.length < 2
          ? levels.map(item)
          : curricula.map((curriculum) => (
              <SelectGroup key={curriculum.id}>
                <SelectLabel>{curriculumLabel(curriculum)}</SelectLabel>
                {levels.filter((level) => level.curriculum_id === curriculum.id).map(item)}
              </SelectGroup>
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
  levels: allLevels,
  ratings,
  onChange,
  initialLevel,
}: {
  levels: CurriculumLevel[];
  ratings: Map<string, Rating>;
  onChange: (next: Map<string, Rating>) => void;
  initialLevel?: string;
}) {
  const picker = usePickerState(allLevels, [...ratings.keys()], initialLevel || undefined);
  const { levels, level, levelId } = picker;

  const catalog = useMemo(() => indexCurriculum(allLevels), [allLevels]);

  const perLevel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const topicId of ratings.keys()) {
      const levelOf = catalog.get(topicId)?.level_id;
      if (levelOf) counts.set(levelOf, (counts.get(levelOf) ?? 0) + 1);
    }
    return counts;
  }, [ratings, catalog]);

  function set(topicId: string, value: Rating | null) {
    const next = new Map(ratings);
    if (value === null) next.delete(topicId);
    else next.set(topicId, value);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <CurriculumSwitch curricula={picker.curricula} value={picker.curriculumId} onChange={picker.chooseCurriculum} />
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
              onClick={() => picker.setLevelId(candidate.id)}
            >
              {candidate.code}
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
            <TopicRows
              topics={level.topics}
              render={(topic) => (
                <li
                  key={topic.id}
                  className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <TopicName code={topic.code} name={topic.name} className="text-sm" />
                    <TopicDescription text={topic.description} />
                  </span>
                  <RatingPicker
                    name={`${topic.code} ${topic.name}`}
                    value={ratings.get(topic.id) ?? null}
                    onChange={(value) => set(topic.id, value)}
                  />
                </li>
              )}
            />
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
  levels: allLevels,
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
  const catalog = useMemo(() => indexCurriculum(allLevels), [allLevels]);
  const picker = usePickerState(allLevels, value, (value[0] && catalog.get(value[0])?.level_id) || undefined);
  const { levels, level } = picker;
  const chosen = new Set(value);
  /** A topic's code, or its id if the catalog no longer lists it. */
  const codeOf = (topicId: string) => catalog.get(topicId)?.code ?? topicId;

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
      <div className="min-w-0 space-y-2">
        <CurriculumSwitch curricula={picker.curricula} value={picker.curriculumId} onChange={picker.chooseCurriculum} />
        <LevelSelect levels={levels} value={picker.levelId} onChange={picker.setLevelId} />
        {level && (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
            <TopicRows
              topics={level.topics}
              render={(topic) => {
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
                      <span className="min-w-0 flex-1">
                        <TopicName code={topic.code} name={topic.name} />
                        <TopicDescription text={topic.description} />
                      </span>
                      {baseline.has(topic.id) && (
                        <RatingChip rating={baseline.get(topic.id)!} className="size-5 text-[10px]" />
                      )}
                    </button>
                  </li>
                );
              }}
            />
          </ul>
        )}
      </div>

      <div className="min-w-0 space-y-2">
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
                <TopicName code={codeOf(topicId)} name={catalog.get(topicId)?.name} className="flex-1 truncate" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Move ${codeOf(topicId)} earlier`}
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
                  aria-label={`Move ${codeOf(topicId)} later`}
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
                  aria-label={`Remove ${codeOf(topicId)}`}
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
