// Ported from apps/web/src/features/platform/guest-settings-section.tsx @ 0e3ec7a (working tree).
// Phase 63 (P16, docs/stickiness-plan.md): guest play in the console -- its switches, the sign-up
// offer's timing and words, the home bar, and each level's free questions (the guest pool: reserved for
// guests, never served to members). The same copy and requests as the web.
//
// Mobile: on the console's Settings screen under Play; the settings are checked with the shared
// guestSettingsSchema before they are sent; a level's pool opens beneath its chip, its questions as
// plain text (mathToText), with "Use the suggestion".
import {
  TILE_LEVEL_WORDS,
  guestSettingsSchema,
  type GuestConsoleResponse,
  type GuestSettings,
  type QuestionBankLevelId,
} from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Divider, Switch, Text, TextInput } from 'react-native-paper';

import { Panel } from '@/components/section';
import { DetailSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { mathToText } from '@/features/question-bank/math-text';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, space } from '@/theme/tokens';
import { useGuestConsole, useGuestPoolConsole, useSaveGuestPool, useSaveGuestSettings } from './api';

const levelWords = (level: string) => TILE_LEVEL_WORDS[level as QuestionBankLevelId] ?? level;

export function GuestSettingsSection() {
  const guest = useGuestConsole();
  if (guest.isPending) return <DetailSkeleton label="Loading guest play…" />;
  if (guest.isError) return <ErrorState error={guest.error} onRetry={() => void guest.refetch()} />;
  // Keyed on what is stored, so a save starts the editor afresh.
  return <GuestEditor key={JSON.stringify(guest.data.data.settings)} data={guest.data.data} />;
}

function GuestEditor({ data }: { data: GuestConsoleResponse }) {
  const theme = useAppTheme();
  const toast = useToast();
  const save = useSaveGuestSettings();
  const [settings, setSettings] = useState<GuestSettings>(data.settings);
  const [after, setAfter] = useState(String(data.settings.nudge_after));
  const [cooldown, setCooldown] = useState(String(data.settings.nudge_cooldown_hours));
  const [level, setLevel] = useState<string | null>(null);
  const muted = { color: theme.tokens.mutedForeground };
  const set = <K extends keyof GuestSettings>(key: K, value: GuestSettings[K]) => setSettings({ ...settings, [key]: value });

  async function submit() {
    const parsed = guestSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      haptics.error();
      toast.error(parsed.error.issues[0]?.message ?? 'Guest play could not be saved.');
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      haptics.success();
      toast.success('Guest play saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Guest play could not be saved.');
    }
  }

  const switchRow = (label: string, hint: string, key: 'enabled' | 'assessment_enabled', testID: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelLarge">{label}</Text>
        <Text variant="bodySmall" style={muted}>
          {hint}
        </Text>
      </View>
      <Switch
        testID={testID}
        value={settings[key]}
        onValueChange={(on) => {
          haptics.selection();
          set(key, on);
        }}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: settings[key] }}
      />
    </View>
  );

  const numberRow = (
    label: string,
    hint: string,
    value: string,
    onChange: (text: string) => void,
    testID: string,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelLarge">{label}</Text>
        <Text variant="bodySmall" style={muted}>
          {hint}
        </Text>
      </View>
      <TextInput
        testID={testID}
        mode="outlined"
        dense
        keyboardType="number-pad"
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        style={{ width: 96 }}
      />
    </View>
  );

  return (
    <View testID="guest-settings" style={{ gap: space.lg }}>
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
        Guest play
      </Text>
      {!data.address_allows ? (
        <Text testID="guest-settings-address-off" variant="bodyMedium" style={muted}>
          This address does not offer guest play (its GUEST_PLAY is off), whatever is set here.
        </Text>
      ) : null}
      <Panel testID="guest-settings-switches">
        <View style={{ gap: space.md }}>
          {switchRow('Guest play', 'Anyone may play the open tiles without signing in.', 'enabled', 'guest-settings-enabled')}
          <Divider />
          {switchRow(
            'Guest assessment',
            'Assessment tiles (G4A5) for guests, answered and marked on the device.',
            'assessment_enabled',
            'guest-settings-assessment',
          )}
          <Divider />
          {numberRow(
            'Sign-up offer after question',
            '0 turns the offer during a quest off.',
            after,
            (text) => {
              setAfter(text);
              set('nudge_after', Number(text) || 0);
            },
            'guest-settings-after',
          )}
          {numberRow(
            'Not again for (hours)',
            'After someone closes the offer, on that device.',
            cooldown,
            (text) => {
              setCooldown(text);
              set('nudge_cooldown_hours', Number(text) || 0);
            },
            'guest-settings-cooldown',
          )}
          <TextInput
            testID="guest-settings-right"
            mode="outlined"
            label="After a right answer"
            value={settings.nudge_right}
            onChangeText={(text) => set('nudge_right', text)}
          />
          <TextInput
            testID="guest-settings-wrong"
            mode="outlined"
            label="After a wrong answer"
            value={settings.nudge_wrong}
            onChangeText={(text) => set('nudge_wrong', text)}
          />
          <TextInput
            testID="guest-settings-home-bar"
            mode="outlined"
            label="The home bar"
            multiline
            value={settings.home_bar}
            onChangeText={(text) => set('home_bar', text)}
          />
          <Button
            testID="guest-settings-save"
            mode="contained"
            style={{ alignSelf: 'flex-start' }}
            loading={save.isPending}
            disabled={save.isPending}
            onPress={() => void submit()}
          >
            Save guest play
          </Button>
        </View>
      </Panel>

      <Panel title="Free questions per level" testID="guest-settings-pools">
        <View style={{ gap: space.md }}>
          <Text variant="bodySmall" style={muted}>
            Reserved for guests: members never meet them. An open tile shows only where its level has some.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {data.pools.map((pool) => (
              <Chip
                key={pool.level_id}
                testID={`guest-pool-${pool.level_id}`}
                hitSlop={CHIP_HIT_SLOP}
                selected={level === pool.level_id}
                showSelectedCheck={false}
                onPress={() => setLevel(level === pool.level_id ? null : pool.level_id)}
              >
                {`${levelWords(pool.level_id)} · ${pool.size}`}
              </Chip>
            ))}
          </View>
          {level ? <PoolEditor level={level} /> : null}
        </View>
      </Panel>
    </View>
  );
}

function PoolEditor({ level }: { level: string }) {
  const theme = useAppTheme();
  const toast = useToast();
  const pool = useGuestPoolConsole(level);
  const save = useSaveGuestPool();
  const data = pool.data?.data;
  if (pool.isPending) return <DetailSkeleton label="Loading the free questions…" />;
  if (!data) return null;
  const muted = { color: theme.tokens.mutedForeground };

  async function use(ids: string[]) {
    try {
      await save.mutateAsync({ level_id: level, question_ids: ids });
      await pool.refetch();
      haptics.success();
      toast.success(`${levelWords(level)} has ${ids.length} free questions.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'The free questions could not be saved.');
    }
  }

  const list = (items: typeof data.current) =>
    items.map((q) => {
      const stem = mathToText(q.stem, 'display');
      return (
        <Text key={q.id} variant="bodySmall">
          <Text variant="bodySmall" style={muted}>
            {`D${q.difficulty}${q.status === 'checked' ? ' · Beta' : ''}  `}
          </Text>
          {stem.length > 140 ? `${stem.slice(0, 140)}…` : stem}
        </Text>
      );
    });

  return (
    <View testID="guest-pool-editor" style={{ gap: space.md }}>
      <Divider />
      <View style={{ gap: space.xs }}>
        <Text variant="labelMedium">{`Now (${data.current.length})`}</Text>
        {data.current.length === 0 ? (
          <Text variant="bodySmall" style={muted}>
            None yet: this level has no open guest tiles.
          </Text>
        ) : (
          list(data.current)
        )}
      </View>
      <View style={{ gap: space.xs }}>
        <Text variant="labelMedium">{`Suggested (${data.suggestion.length})`}</Text>
        {list(data.suggestion)}
        <Button
          testID="guest-pool-use-suggestion"
          mode="outlined"
          style={{ alignSelf: 'flex-start' }}
          disabled={save.isPending || data.suggestion.length < 5}
          onPress={() => void use(data.suggestion.map((q) => q.id))}
        >
          Use the suggestion
        </Button>
      </View>
    </View>
  );
}
