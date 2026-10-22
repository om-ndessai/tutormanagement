// Ported from apps/web/src/features/quest/games-card.tsx @ cd0378d (working tree): StartGameDialog
// and its Toggle.
//
// Phase 46: start a Quest game -- a level of the bank with how many questions it has to draw, a
// number of questions or a time limit, the marking, the team size. docs/quest-games-plan.md.
// Mobile (design 60): the `quest/new-game` form sheet, in the QuickSheet shell with a scrolling body
// (four inputs); the length is a segmented control, the marking and the team size choices. The
// amount is kept per mode, as on the web. Checked with the shared createGameSchema before it is sent;
// a refusal (too few questions to draw) shows above the action. Created, the sheet gives way to the
// game.
import { GAME_LIMITS, gameMarkingLabel, type GameMode } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';

import { Choice, Field } from '@/components/form-choice';
import { OptionPicker, type PickerOption } from '@/components/option-picker';
import { QuickSheet } from '@/components/quick-sheet';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { amountHint, amountProblem, createInput, teamSizeLabel, teamSizeSpeech } from './game-model';
import { useCreateGame, useGameLevels } from './games-api';

const MODE_TABS = [
  { value: 'count', label: 'A number of questions', icon: 'format-list-numbered', testID: 'game-mode-count' },
  { value: 'timed', label: 'Against the clock', icon: 'timer-outline', testID: 'game-mode-timed' },
] as const;

const TEAM_SIZES = Array.from({ length: GAME_LIMITS.maxTeamSize }, (_, i) => i + 1);

export function NewGameSheet() {
  const theme = useAppTheme();
  const levels = useGameLevels();
  const create = useCreateGame();
  const [levelId, setLevelId] = useState('');
  const [mode, setMode] = useState<GameMode>('count');
  const [count, setCount] = useState('10');
  const [minutes, setMinutes] = useState('5');
  const [negative, setNegative] = useState(false);
  const [teamSize, setTeamSize] = useState<number>(GAME_LIMITS.defaultTeamSize);
  const [refusal, setRefusal] = useState<string | null>(null);

  const options: PickerOption[] = (levels.data?.data ?? [])
    .filter((level) => level.available > 0)
    .map((level) => ({ id: level.level_id, label: level.label, detail: `· ${level.available} questions` }));
  const amount = mode === 'count' ? count : minutes;
  const problem = amountProblem(mode, amount);
  const input = createInput({ levelId, mode, amount, negativeMarking: negative, teamSize });

  async function submit() {
    if (!input) return;
    setRefusal(null);
    try {
      const game = await create.mutateAsync(input);
      // The sheet gives way to the game; its Exit lands on the hub beneath.
      router.replace({ pathname: '/quest/games/[gameId]', params: { gameId: game.data.id } });
    } catch (caught) {
      setRefusal(caught instanceof ApiRequestError ? caught.message : 'Could not start the game.');
    }
  }

  return (
    <QuickSheet
      testID="screen-quest-new-game"
      primaryTestID="game-create"
      title="Start a game"
      description="Choose the questions and the rules. You will get a code to share."
      primaryLabel="Create the game"
      primaryIcon="gamepad-variant-outline"
      primaryDisabled={!input}
      loading={create.isPending}
      error={refusal}
      onPrimary={() => submit()}
    >
      <OptionPicker
        testID="game-level"
        label="Level"
        placeholder={levels.isPending ? 'Loading…' : 'Choose a level'}
        options={options}
        value={levelId}
        onChange={setLevelId}
        emptyText={levels.isSuccess ? 'No level has approved questions to play yet.' : undefined}
        searchPlaceholder="Search levels"
        scroll
      />

      <Field label="Length">
        <View style={{ gap: space.sm }}>
          <SegmentedTabs tabs={MODE_TABS} value={mode} onChange={setMode} testID="game-mode" />
          <TextInput
            testID="game-amount"
            mode="outlined"
            label={mode === 'count' ? 'Questions' : 'Minutes'}
            value={amount}
            onChangeText={(text) => (mode === 'count' ? setCount : setMinutes)(text.replace(/[^0-9]/g, ''))}
            // iOS's number pad has no return key, so it could never be put away, and it covers the
            // team sizes and Create: this one has (as the location form's reminder).
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad'}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            maxLength={3}
            error={problem !== null}
            style={{ maxWidth: 160 }}
          />
          <Text
            testID="game-amount-hint"
            variant="bodySmall"
            style={{ color: problem ? theme.colors.error : theme.tokens.mutedForeground }}
          >
            {problem ?? amountHint(mode)}
          </Text>
        </View>
      </Field>

      <Field label="Marking">
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          <Choice
            testID="game-marking-off"
            label={gameMarkingLabel(false)}
            selected={!negative}
            onPress={() => setNegative(false)}
            wide
          />
          <Choice
            testID="game-marking-on"
            label={gameMarkingLabel(true)}
            accessibilityLabel="Right plus 1, wrong minus 1"
            selected={negative}
            onPress={() => setNegative(true)}
            wide
          />
        </View>
      </Field>

      <Field label="Team size">
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
        >
          {TEAM_SIZES.map((size) => (
            <Choice
              key={size}
              testID={`game-team-size-${size}`}
              label={teamSizeLabel(size)}
              accessibilityLabel={teamSizeSpeech(size)}
              selected={teamSize === size}
              onPress={() => setTeamSize(size)}
              wide
            />
          ))}
        </View>
      </Field>
    </QuickSheet>
  );
}
