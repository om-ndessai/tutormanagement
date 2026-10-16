// Ported from apps/web/src/features/progress/topic-pickers.tsx @ 1132322 (Phase 35's curriculum
// switch, unit groups and descriptions carried over with it). The web's level Select becomes a row
// of level chips (with how many topics each holds so far), and the plan's two columns stack: the
// chosen list, in teaching order, above the topics to choose from. The web's curriculum buttons are
// a row of chips above the level chips.
import {
  indexCurriculum,
  pickerLevels,
  topicsByUnit,
  type Curriculum,
  type CurriculumLevel,
  type CurriculumTopic,
  type Rating,
} from '@tmi/shared';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Chip, Divider, Icon, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OptionPicker } from '@/components/option-picker';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { CHIP_HIT_SLOP, MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCurricula } from './api';
import { countByLevel, moveTopic, toggleTopic } from './progress-model';
import { RatingChip, RatingPicker, TopicName } from './rating';

const NONE = 'none';

// Phase 35: an organization may offer several curricula. The pickers show the levels of those still
// offered -- a retired one's only where something already chosen is in it, so an old plan still
// shows (and saves) its topics -- and offer a switch between curricula only when there are two or
// more to switch between. With one, as at the institute, there is no switch.

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

/** Which curriculum a picker opens on: the one holding its first level, else the first it may show. */
function startingCurriculum(levels: CurriculumLevel[], levelId: string | undefined): string {
  return levels.find((level) => level.id === levelId)?.curriculum_id ?? levels[0]?.curriculum_id ?? '';
}

/**
 * The curriculum switch's state for a picker: the levels it may show, the chosen curriculum and
 * level. What it keeps showing is everything chosen since it opened, so clearing an old plan's last
 * retired topic does not pull that curriculum out from under the reader.
 */
function usePickerState(allLevels: CurriculumLevel[], keep: Iterable<string>, startLevel: string | undefined) {
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

/** Two or more curricula: one chip each (`<testID>-<curriculumId>`). One: nothing at all. */
export function CurriculumSwitch({
  testID,
  curricula,
  value,
  onChange,
}: {
  testID: string;
  curricula: Curriculum[];
  value: string;
  onChange: (curriculumId: string) => void;
}) {
  if (curricula.length < 2) return null;
  return (
    <ScrollView
      horizontal
      style={{ marginVertical: -CHIP_HIT_SLOP.top }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingVertical: CHIP_HIT_SLOP.top }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Curriculum"
    >
      {curricula.map((curriculum) => {
        const selected = curriculum.id === value;
        return (
          <Chip
            hitSlop={CHIP_HIT_SLOP}
            key={curriculum.id}
            testID={`${testID}-${curriculum.id}`}
            selected={selected}
            showSelectedCheck={false}
            mode={selected ? 'flat' : 'outlined'}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(curriculum.id);
            }}
          >
            {curriculumLabel(curriculum)}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

/** A level's topics under their unit (a guide book, a domain), in teaching order. */
function TopicRows({
  topics,
  render,
}: {
  topics: CurriculumTopic[];
  render: (topic: CurriculumTopic) => React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <>
      {topicsByUnit(topics).map((group, index) => (
        <Fragment key={`${group.unit ?? ''}-${index}`}>
          {group.unit ? (
            <View>
              <Divider />
              <Text
                variant="labelSmall"
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: 4,
                  color: theme.tokens.mutedForeground,
                  backgroundColor: withAlpha(theme.tokens.muted, 0.4),
                  textTransform: 'uppercase',
                }}
              >
                {group.unit}
              </Text>
            </View>
          ) : null}
          {group.topics.map(render)}
        </Fragment>
      ))}
    </>
  );
}

/** The topic's description, as a second line under its name: what a state standard asks. */
function TopicDescription({ text }: { text: string | null }) {
  const theme = useAppTheme();
  if (!text) return null;
  return (
    <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.tokens.mutedForeground }}>
      {text}
    </Text>
  );
}

/** A level picker for a form field. "" means none. */
export function LevelPicker({
  testID,
  label,
  levels: allLevels,
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
  // A retired curriculum's levels only where one is the value; with two or more curricula, each
  // level says whose it is.
  const levels = useMemo(() => pickerLevels(allLevels, value ? [value] : []), [allLevels, value]);
  const curricula = useSwitchable(levels);
  const names = new Map(curricula.map((curriculum) => [curriculum.id, curriculumLabel(curriculum)]));
  return (
    <OptionPicker
      testID={testID}
      label={label}
      placeholder={placeholder}
      options={[
        { id: NONE, label: 'None' },
        ...levels.map((level) => ({
          id: level.id,
          label: level.code,
          detail: curricula.length < 2 ? level.name : `${level.name} · ${names.get(level.curriculum_id) ?? ''}`,
        })),
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
            {count > 0 ? `${level.code} · ${count}` : level.code}
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

/**
 * Scores topics one level at a time: "pick topic 10 from level 3 and mark it 1". Choosing another
 * level keeps what was scored elsewhere, and the chips show every level's count so far.
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
  const theme = useAppTheme();
  const picker = usePickerState(allLevels, ratings.keys(), initialLevel || undefined);
  const { levels, levelId, setLevelId, level } = picker;
  const catalog = useMemo(() => indexCurriculum(allLevels), [allLevels]);
  const counts = useMemo(() => countByLevel(ratings.keys(), catalog), [ratings, catalog]);

  function set(topicId: string, value: Rating | null) {
    const next = new Map(ratings);
    if (value === null) next.delete(topicId);
    else next.set(topicId, value);
    onChange(next);
  }

  return (
    <View style={{ gap: space.md }}>
      <CurriculumSwitch
        testID="assessment-curriculum"
        curricula={picker.curricula}
        value={picker.curriculumId}
        onChange={picker.chooseCurriculum}
      />
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
          <TopicRows
            topics={level.topics}
            render={(topic) => (
            <View key={topic.id}>
              <Divider />
              <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm }}>
                <View>
                  <TopicName code={topic.code} name={topic.name} />
                  <TopicDescription text={topic.description} />
                </View>
                <RatingPicker
                  testID={`assessment-topic-${topic.id}`}
                  name={`${topic.code} ${topic.name}`}
                  value={ratings.get(topic.id) ?? null}
                  onChange={(value) => set(topic.id, value)}
                />
              </View>
            </View>
            )}
          />
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
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const catalog = useMemo(() => indexCurriculum(allLevels), [allLevels]);
  const picker = usePickerState(allLevels, value, (value[0] && catalog.get(value[0])?.level_id) || undefined);
  const { levels, levelId, setLevelId, level } = picker;
  const chosen = new Set(value);
  const counts = useMemo(() => countByLevel(value, catalog), [value, catalog]);
  /** A topic's code, or its id if the catalog no longer lists it. */
  const codeOf = (topicId: string) => catalog.get(topicId)?.code ?? topicId;

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
                  <TopicName code={codeOf(topicId)} name={catalog.get(topicId)?.name} />
                </View>
                <IconButton
                  testID={`plan-up-${topicId}`}
                  icon="arrow-up"
                  size={18}
                  accessibilityLabel={`Move ${codeOf(topicId)} earlier`}
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
                  accessibilityLabel={`Move ${codeOf(topicId)} later`}
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
                  accessibilityLabel={`Remove ${codeOf(topicId)}`}
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
      <CurriculumSwitch
        testID="plan-curriculum"
        curricula={picker.curricula}
        value={picker.curriculumId}
        onChange={picker.chooseCurriculum}
      />
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
          <TopicRows
            topics={level.topics}
            render={(topic) => {
            const selected = chosen.has(topic.id);
            const score = baseline.get(topic.id);
            return (
              <View key={topic.id}>
                <Divider />
                <Pressable
                  testID={`plan-topic-${topic.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${topic.code} ${topic.name}${score ? `, assessed ${score}` : ''}`}
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
                    <TopicName code={topic.code} name={topic.name} />
                    <TopicDescription text={topic.description} />
                  </View>
                  {score ? <RatingChip rating={score} size={20} /> : null}
                </Pressable>
              </View>
            );
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
