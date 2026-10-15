// Ported from apps/web/src/features/progress/topic-pickers.tsx @ 1132322. The web's level Select
// becomes a row of level chips (with how many topics each holds so far), and the plan's two
// columns stack: the chosen list, in teaching order, above the topics to choose from.
import type { CurriculumLevel, Rating } from '@tmi/shared';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Chip, Divider, Icon, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OptionPicker } from '@/components/option-picker';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { CHIP_HIT_SLOP, MIN_TARGET, radius, space } from '@/theme/tokens';
import { levelOf, moveTopic, toggleTopic } from './progress-model';
import { RatingChip, RatingPill, TopicName } from './rating';

const NONE = 'none';

/** A level picker for a form field. "" means none. */
export function LevelPicker({
  testID,
  label,
  levels,
  value,
  onChange,
  placeholder,
  error,
}: {
  testID: string;
  label: string;
  levels: CurriculumLevel[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <OptionPicker
      testID={testID}
      label={label}
      placeholder={placeholder}
      options={[
        { id: NONE, label: 'None' },
        ...levels.map((level) => ({ id: level.id, label: level.id, detail: level.name })),
      ]}
      // None is a choice like any other, so the field starts closed on it.
      value={value || NONE}
      onChange={(id) => onChange(id === NONE ? '' : id)}
      error={error}
      searchPlaceholder="Find a level"
    />
  );
}

/** One chip per level; a count shows how many of its topics are rated or chosen. */
export function LevelTabs({
  testID,
  levels,
  value,
  onChange,
  counts,
}: {
  /** Each chip is `<testID>-<levelId>`. */
  testID: string;
  levels: CurriculumLevel[];
  value: string;
  onChange: (levelId: string) => void;
  counts: Map<string, number>;
}) {
  return (
    <ScrollView
      horizontal
      // The row is as tall as the chips' slop, so Android does not clip the touch (F-5).
      style={{ marginVertical: -CHIP_HIT_SLOP.top }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingVertical: CHIP_HIT_SLOP.top }}
      accessibilityRole="tablist"
    >
      {levels.map((level) => {
        const selected = level.id === value;
        const count = counts.get(level.id) ?? 0;
        return (
          <Chip
            hitSlop={CHIP_HIT_SLOP}
            key={level.id}
            testID={`${testID}-${level.id}`}
            selected={selected}
            showSelectedCheck={false}
            mode={selected ? 'flat' : 'outlined'}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${level.name}${count > 0 ? `, ${count}` : ''}`}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(level.id);
            }}
          >
            {count > 0 ? `${level.id} · ${count}` : level.id}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

function LevelHeading({ level }: { level: CurriculumLevel }) {
  const theme = useAppTheme();
  return (
    <View
      style={{ backgroundColor: theme.tokens.muted, paddingHorizontal: space.md, paddingVertical: space.sm }}
    >
      <Text variant="labelLarge">
        {level.name}
        {level.grade_band ? (
          <Text style={{ color: theme.tokens.mutedForeground }}> · {level.grade_band}</Text>
        ) : null}
      </Text>
    </View>
  );
}

function countByLevel(ids: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(levelOf(id), (counts.get(levelOf(id)) ?? 0) + 1);
  return counts;
}

/**
 * The assessment's topic scores (UI upgrades U5): the topics of the student's learning plan first,
 * each with a five-step pill, then every level of the ladder collapsed until it is opened -- a level
 * says how many of its topics are rated, so a score in a closed level is never lost from sight.
 * Opening one level keeps the others as they were. A topic in the plan is rated in the plan's list
 * only, so no topic has two pills.
 */
export function AssessmentTopicsEditor({
  levels,
  ratings,
  onChange,
  plannedIds = [],
}: {
  levels: CurriculumLevel[];
  ratings: Map<string, Rating>;
  onChange: (next: Map<string, Rating>) => void;
  /** The active plan's topics, in teaching order. */
  plannedIds?: readonly string[];
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const planned = useMemo(() => new Set(plannedIds), [plannedIds]);
  const topics = useMemo(() => {
    const map = new Map<string, CurriculumLevel['topics'][number]>();
    for (const level of levels) for (const topic of level.topics) map.set(topic.id, topic);
    return map;
  }, [levels]);
  // A level counts the scores it holds itself: a planned topic's is counted in the plan's list.
  const counts = useMemo(
    () => countByLevel([...ratings.keys()].filter((id) => !planned.has(id))),
    [planned, ratings],
  );
  const plannedRated = plannedIds.filter((id) => ratings.has(id)).length;

  function set(topicId: string, value: Rating | null) {
    const next = new Map(ratings);
    if (value === null) next.delete(topicId);
    else next.set(topicId, value);
    onChange(next);
  }

  function toggle(levelId: string) {
    haptics.selection();
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  const box = {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };

  return (
    <View style={{ gap: space.md }}>
      {plannedIds.length > 0 ? (
        <View testID="assessment-planned" style={box}>
          <View
            style={{ backgroundColor: theme.tokens.muted, paddingHorizontal: space.md, paddingVertical: space.sm }}
          >
            <Text variant="labelLarge" accessibilityRole="header">
              In their plan
              <Text style={{ color: muted }}>{` · ${plannedRated} of ${plannedIds.length} rated`}</Text>
            </Text>
          </View>
          {plannedIds.map((id) => (
            <TopicRatingRow
              key={id}
              id={id}
              name={topics.get(id)?.name}
              unit={topics.get(id)?.unit}
              value={ratings.get(id) ?? null}
              onChange={(value) => set(id, value)}
            />
          ))}
        </View>
      ) : (
        <Text testID="assessment-no-plan" variant="bodySmall" style={{ color: muted }}>
          No learning plan yet: open a level to rate its topics.
        </Text>
      )}

      <View style={{ gap: space.sm }}>
        {levels.map((level) => {
          const expanded = open.has(level.id);
          const count = counts.get(level.id) ?? 0;
          const rest = level.topics.filter((topic) => !planned.has(topic.id));
          if (rest.length === 0) return null;
          return (
            <View key={level.id} style={box}>
              <Pressable
                testID={`assessment-group-${level.id}`}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${level.name}${count > 0 ? `, ${count} rated` : ''}`}
                onPress={() => toggle(level.id)}
                style={({ pressed }) => ({
                  minHeight: MIN_TARGET + 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingHorizontal: space.md,
                  backgroundColor: pressed || expanded ? theme.tokens.muted : 'transparent',
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="labelLarge">
                    {level.name}
                    {level.grade_band ? <Text style={{ color: muted }}> · {level.grade_band}</Text> : null}
                  </Text>
                </View>
                {count > 0 ? (
                  <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                    {`${count} rated`}
                  </Text>
                ) : null}
                <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />
              </Pressable>
              {expanded
                ? rest.map((topic) => (
                    <TopicRatingRow
                      key={topic.id}
                      id={topic.id}
                      name={topic.name}
                      unit={topic.unit}
                      value={ratings.get(topic.id) ?? null}
                      onChange={(value) => set(topic.id, value)}
                    />
                  ))
                : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** One topic: its code and name, and the pill underneath. */
function TopicRatingRow({
  id,
  name,
  unit,
  value,
  onChange,
}: {
  id: string;
  name: string | undefined;
  unit?: string | null;
  value: Rating | null;
  onChange: (value: Rating | null) => void;
}) {
  return (
    <View>
      <Divider />
      <View testID={`assessment-row-${id}`} style={{ paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm }}>
        <TopicName id={id} name={name} unit={unit} />
        <RatingPill testID={`assessment-topic-${id}`} name={`${id} ${name ?? ''}`} value={value} onChange={onChange} />
      </View>
    </View>
  );
}

/**
 * Chooses the plan's topics, in teaching order. Topics are added from any level -- the "add some
 * topics from a lower level" case -- and the chosen list reads top to bottom as the order they
 * will be taught.
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
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const [levelId, setLevelId] = useState(value[0] ? levelOf(value[0]) : (levels[0]?.id ?? ''));
  const level = levels.find((candidate) => candidate.id === levelId);
  const chosen = new Set(value);
  const counts = useMemo(() => countByLevel(value), [value]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of levels) for (const topic of l.topics) map.set(topic.id, topic.name);
    return map;
  }, [levels]);

  const box = {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };

  return (
    <View style={{ gap: space.md }}>
      <Text testID="plan-chosen-count" variant="bodySmall" style={{ color: muted }}>
        {value.length === 0
          ? 'No topics chosen yet. Pick them from any level, in the order to teach them.'
          : `${value.length} ${value.length === 1 ? 'topic' : 'topics'}, in teaching order`}
      </Text>
      {value.length > 0 ? (
        <View testID="plan-chosen" style={box}>
          {value.map((topicId, index) => (
            <View key={topicId}>
              {index > 0 ? <Divider /> : null}
              <View
                testID={`plan-chosen-${topicId}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: space.sm,
                  minHeight: MIN_TARGET,
                }}
              >
                <Text variant="bodySmall" style={{ width: 22, color: muted, fontVariant: ['tabular-nums'] }}>
                  {index + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <TopicName id={topicId} name={names.get(topicId)} />
                </View>
                <IconButton
                  testID={`plan-up-${topicId}`}
                  icon="arrow-up"
                  size={18}
                  accessibilityLabel={`Move ${topicId} earlier`}
                  disabled={index === 0}
                  onPress={() => {
                    haptics.selection();
                    onChange(moveTopic(value, index, -1));
                  }}
                  style={{ margin: 0 }}
                />
                <IconButton
                  testID={`plan-down-${topicId}`}
                  icon="arrow-down"
                  size={18}
                  accessibilityLabel={`Move ${topicId} later`}
                  disabled={index === value.length - 1}
                  onPress={() => {
                    haptics.selection();
                    onChange(moveTopic(value, index, 1));
                  }}
                  style={{ margin: 0 }}
                />
                <IconButton
                  testID={`plan-remove-${topicId}`}
                  icon="close"
                  size={18}
                  accessibilityLabel={`Remove ${topicId}`}
                  onPress={() => {
                    haptics.selection();
                    onChange(toggleTopic(value, topicId));
                  }}
                  style={{ margin: 0 }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text variant="labelLarge">Add topics</Text>
      <LevelTabs
        testID="plan-level-tab"
        levels={levels}
        value={levelId}
        onChange={setLevelId}
        counts={counts}
      />
      {level ? (
        <View style={box}>
          <LevelHeading level={level} />
          {level.topics.map((topic) => {
            const selected = chosen.has(topic.id);
            const score = baseline.get(topic.id);
            return (
              <View key={topic.id}>
                <Divider />
                <Pressable
                  testID={`plan-topic-${topic.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${topic.id} ${topic.name}${score ? `, assessed ${score}` : ''}`}
                  onPress={() => {
                    haptics.selection();
                    onChange(toggleTopic(value, topic.id));
                  }}
                  style={({ pressed }) => ({
                    minHeight: MIN_TARGET,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingHorizontal: space.md,
                    paddingVertical: 6,
                    backgroundColor: selected
                      ? withAlpha(theme.tokens.accent, 0.6)
                      : pressed
                        ? theme.tokens.muted
                        : 'transparent',
                  })}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: selected ? theme.colors.primary : theme.colors.outline,
                      backgroundColor: selected ? theme.colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? <Icon source="check" size={14} color={theme.colors.onPrimary} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <TopicName id={topic.id} name={topic.name} />
                  </View>
                  {score ? <RatingChip rating={score} size={20} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
