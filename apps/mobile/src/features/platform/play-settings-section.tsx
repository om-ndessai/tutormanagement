// Ported from apps/web/src/features/platform/play-settings-section.tsx @ 0e3ec7a (working tree).
// Phase 62 (P5, docs/stickiness-plan.md): the tiles and the Play settings, on the console's Settings
// screen. Edited here and saved together: the Play home's switch, the Daily set (Phase 64), how many
// questions a level needs before members see its tiles, and the ordered list -- each tile open, locked
// or hidden for guests (Phase 63), shown or not to members. The same copy and requests as the web.
//
// Mobile: the level is an inline picker, the kind and each tile's guest state are radio chips, the
// order is moved with up and down buttons; the whole list is checked with the shared updatePlaySchema
// before it is sent.
import {
  QUESTION_BANK_LEVEL_IDS,
  TILE_LEVEL_WORDS,
  tileCode,
  tileValueProblem,
  tileWords,
  updatePlaySchema,
  type PlaySettings,
  type PlayConsoleResponse,
  type QuestTileInput,
  type QuestionBankLevelId,
  type TileFormat,
  type TileGuestState,
} from '@tmi/shared';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Switch, Text, TextInput } from 'react-native-paper';

import { Choice } from '@/components/form-choice';
import { IconButton } from '@/components/icon-button';
import { OptionPicker } from '@/components/option-picker';
import { Panel } from '@/components/section';
import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { usePlayConsole, useResetTiles, useSavePlay } from './api';

export const GUEST_LABELS: Record<TileGuestState, string> = {
  open: 'Open',
  locked: 'Locked',
  hidden: 'Hidden',
};
export const FORMAT_LABELS: Record<TileFormat, string> = { Q: 'Questions', T: 'Minutes', A: 'Assessment' };

export function shapeOf(format: TileFormat): Pick<QuestTileInput, 'kind' | 'mode'> {
  return format === 'A'
    ? { kind: 'assessment', mode: 'count' }
    : { kind: 'quest', mode: format === 'T' ? 'timed' : 'count' };
}

const LEVEL_OPTIONS = QUESTION_BANK_LEVEL_IDS.map((id) => ({ id, label: TILE_LEVEL_WORDS[id] }));

function editable(data: PlayConsoleResponse): QuestTileInput[] {
  return data.tiles.map(({ kind, level_id, mode, value, guest, members }) => ({
    kind,
    level_id,
    mode,
    value,
    guest,
    members,
  }));
}

export function PlaySettingsSection() {
  const play = usePlayConsole();
  if (play.isPending) return <DetailSkeleton label="Loading the Play settings…" />;
  if (play.isError) return <ErrorState error={play.error} onRetry={() => void play.refetch()} />;
  // Keyed on what is stored, so a save or "Default tiles" starts the editor afresh.
  return <PlayEditor key={JSON.stringify(play.data.data)} data={play.data.data} />;
}

function PlayEditor({ data }: { data: PlayConsoleResponse }) {
  const theme = useAppTheme();
  const toast = useToast();
  const save = useSavePlay();
  const reset = useResetTiles();
  const [settings, setSettings] = useState<PlaySettings>(data.settings);
  const [tiles, setTiles] = useState<QuestTileInput[]>(() => editable(data));
  const [level, setLevel] = useState<QuestionBankLevelId>('NC26.4');
  const [format, setFormat] = useState<TileFormat>('Q');
  const [value, setValue] = useState('5');
  const [depth, setDepth] = useState(String(data.settings.min_depth));

  const draft = useMemo(
    () => ({ ...shapeOf(format), level_id: level, value: Number(value) }),
    [format, level, value],
  );
  const draftProblem = tileValueProblem(draft);
  const draftCode = draftProblem ? null : tileCode(draft);
  const duplicate = draftCode !== null && tiles.some((tile) => tileCode(tile) === draftCode);

  const move = (index: number, by: number) => {
    haptics.selection();
    setTiles((list) => {
      const next = [...list];
      const [tile] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, tile!);
      return next;
    });
  };
  const update = (index: number, patch: Partial<QuestTileInput>) =>
    setTiles((list) => list.map((tile, i) => (i === index ? { ...tile, ...patch } : tile)));

  async function submit() {
    const parsed = updatePlaySchema.safeParse({ settings, tiles });
    if (!parsed.success) {
      haptics.error();
      toast.error(parsed.error.issues[0]?.message ?? 'The Play settings could not be saved.');
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      haptics.success();
      toast.success('Play settings saved.');
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError ? caught.message : 'The Play settings could not be saved.',
      );
    }
  }

  function defaults() {
    haptics.warning();
    void reset.mutateAsync().then(
      () => toast.success('The default tiles are back.'),
      () => toast.error('The default tiles could not be put back.'),
    );
  }

  return (
    <View testID="play-settings" style={{ gap: space.lg }}>
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
        Play
      </Text>
      <Panel testID="play-settings-home">
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelLarge">Play home</Text>
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                Members start a quest in one tap from their home: Continue, favorites and the tiles below.
              </Text>
            </View>
            <Switch
              testID="play-settings-play-home"
              value={settings.play_home}
              onValueChange={(on) => {
                haptics.selection();
                setSettings({ ...settings, play_home: on });
              }}
              accessibilityLabel="Play home"
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.play_home }}
            />
          </View>
          <Divider />
          {/* Phase 64 (P19): the Daily set, on by default. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelLarge">Daily set</Text>
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                Five questions a level, the same for everyone each day, played once, with a share grid.
              </Text>
            </View>
            <Switch
              testID="play-settings-daily"
              value={settings.daily}
              onValueChange={(on) => {
                haptics.selection();
                setSettings({ ...settings, daily: on });
              }}
              accessibilityLabel="Daily set"
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.daily }}
            />
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelLarge">Questions a level needs</Text>
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                Members see a tile only while its level has this many to play.
              </Text>
            </View>
            <TextInput
              testID="play-settings-min-depth"
              mode="outlined"
              dense
              keyboardType="number-pad"
              accessibilityLabel="Questions a level needs"
              value={depth}
              onChangeText={(text) => {
                setDepth(text);
                setSettings({ ...settings, min_depth: Number(text) || 1 });
              }}
              style={{ width: 96 }}
            />
          </View>
        </View>
      </Panel>

      <Panel title="Tiles" testID="play-settings-tiles">
        <View style={{ gap: space.md }}>
          <OptionPicker
            testID="play-settings-level"
            label="Level"
            placeholder="Choose a level"
            options={LEVEL_OPTIONS}
            value={level}
            onChange={(id) => setLevel(id as QuestionBankLevelId)}
            defaultOpen={false}
          />
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            {(Object.keys(FORMAT_LABELS) as TileFormat[]).map((f) => (
              <Choice
                key={f}
                testID={`play-settings-kind-${f}`}
                label={FORMAT_LABELS[f]}
                selected={format === f}
                onPress={() => setFormat(f)}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
            <TextInput
              testID="play-settings-value"
              mode="outlined"
              dense
              label={format === 'T' ? 'Minutes' : 'Questions'}
              accessibilityLabel="How many"
              keyboardType="number-pad"
              value={value}
              onChangeText={setValue}
              style={{ width: 120 }}
            />
            <Button
              testID="play-settings-add"
              mode="outlined"
              disabled={draftCode === null || duplicate}
              onPress={() => {
                haptics.selection();
                setTiles((list) => [...list, { ...draft, guest: 'locked', members: draft.kind === 'quest' }]);
              }}
            >
              {`Add ${draftCode ?? 'tile'}`}
            </Button>
          </View>
          <Text
            testID="play-settings-draft"
            variant="bodySmall"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {draftProblem ?? (duplicate ? `${draftCode} is already listed.` : tileWords(draft))}
          </Text>

          {tiles.map((tile, index) => {
            const code = tileCode(tile);
            return (
              <View key={code} testID={`tile-${code}`} style={{ gap: space.sm }}>
                <Divider />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                      {code}
                    </Text>
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      style={{ color: theme.tokens.mutedForeground }}
                    >
                      {tileWords(tile)}
                    </Text>
                  </View>
                  <IconButton
                    testID={`tile-${code}-up`}
                    icon="arrow-up"
                    size={20}
                    accessibilityLabel={`Move ${code} up`}
                    disabled={index === 0}
                    onPress={() => move(index, -1)}
                  />
                  <IconButton
                    testID={`tile-${code}-down`}
                    icon="arrow-down"
                    size={20}
                    accessibilityLabel={`Move ${code} down`}
                    disabled={index === tiles.length - 1}
                    onPress={() => move(index, 1)}
                  />
                  <IconButton
                    testID={`tile-${code}-remove`}
                    icon="close"
                    size={20}
                    accessibilityLabel={`Remove ${code}`}
                    onPress={() => {
                      haptics.warning();
                      setTiles((list) => list.filter((_, i) => i !== index));
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
                  <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                    Guests
                  </Text>
                  <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.xs }}>
                    {(Object.keys(GUEST_LABELS) as TileGuestState[]).map((state) => (
                      <Choice
                        key={state}
                        testID={`tile-${code}-guest-${state}`}
                        label={GUEST_LABELS[state]}
                        accessibilityLabel={`Guests: ${code}, ${GUEST_LABELS[state]}`}
                        selected={tile.guest === state}
                        onPress={() => update(index, { guest: state })}
                      />
                    ))}
                  </View>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginLeft: 'auto' }}
                  >
                    <Text variant="bodySmall">Members</Text>
                    <Switch
                      testID={`tile-${code}-members`}
                      value={tile.members}
                      disabled={tile.kind === 'assessment'}
                      onValueChange={(on) => update(index, { members: on })}
                      accessibilityLabel={`Members: ${code}`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: tile.members, disabled: tile.kind === 'assessment' }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </Panel>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button
          testID="play-settings-save"
          mode="contained"
          loading={save.isPending}
          disabled={save.isPending}
          onPress={() => void submit()}
        >
          Save Play settings
        </Button>
        {!data.is_default ? (
          <Button
            testID="play-settings-defaults"
            mode="outlined"
            disabled={reset.isPending}
            onPress={defaults}
          >
            Default tiles
          </Button>
        ) : null}
      </View>
    </View>
  );
}
