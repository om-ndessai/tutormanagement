// Ported from apps/web/src/features/progress/topic-pickers.tsx @ 1132322. The web's level Select
// becomes a row of level chips (with how many topics each holds so far), and the plan's two
// columns stack: the chosen list, in teaching order, above the topics to choose from.
import type { CurriculumLevel, Rating } from '@tmi/shared';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Chip, Divider, Icon, IconButton, Text } from 'react-native-paper';

import { OptionPicker } from '@/components/option-picker';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { levelOf, moveTopic, toggleTopic } from './progress-model';
import { RatingChip, RatingPicker, TopicName } from './rating';

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
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm }}
      accessibilityRole="tablist"
    >
      {levels.map((level) => {
        const selected = level.id === value;
        const count = counts.get(level.id) ?? 0;
        return (
          <Chip
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
 * Scores topics one level at a time: "pick topic 10 from level 3 and mark it 1". Choosing another
 * level keeps what was scored elsewhere, and the chips show every level's count so far.
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
  const theme = useAppTheme();
  const [levelId, setLevelId] = useState(initialLevel || levels[0]?.id || '');
  const level = levels.find((candidate) => candidate.id === levelId);
  const counts = useMemo(() => countByLevel(ratings.keys()), [ratings]);

  function set(topicId: string, value: Rating | null) {
    const next = new Map(ratings);
    if (value === null) next.delete(topicId);
    else next.set(topicId, value);
    onChange(next);
  }

  return (
    <View style={{ gap: space.md }}>
      <LevelTabs
        testID="assessment-level-tab"
        levels={levels}
        value={levelId}
        onChange={setLevelId}
        counts={counts}
      />
      {level ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          <LevelHeading level={level} />
          {level.topics.map((topic) => (
            <View key={topic.id}>
              <Divider />
              <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm }}>
                <TopicName id={topic.id} name={topic.name} unit={topic.unit} />
                <RatingPicker
                  testID={`assessment-topic-${topic.id}`}
                  name={`${topic.id} ${topic.name}`}
                  value={ratings.get(topic.id) ?? null}
                  onChange={(value) => set(topic.id, value)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
