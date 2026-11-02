// Phase 62, P0 (docs/stickiness-plan.md; owner, 2026-11-01): the console's sign-in switches -- which
// ways in besides Google, and whether new people may sign up, chosen separately for the web portal
// and the app, for a few hours or until changed. On the web this is the console's Settings page
// (built in parallel); on the phone it is the Sign-in section of the console's Settings screen,
// one card per client. Google is always on and is not a switch; a provider this Worker has not set
// up is shown off and disabled ("Not set up here"), since it is never offered whatever is stored.
import {
  AUTH_PROVIDER_LABELS,
  SIGN_IN_CLIENT_LABELS,
  SIGN_IN_DURATIONS_HOURS,
  SWITCHABLE_PROVIDERS,
  describeProviders,
  type AuthProvider,
  type SignInClientStatus,
  type UpdateSignInSetting,
} from '@tmi/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Switch, Text } from 'react-native-paper';

import { Choice } from '@/components/form-choice';
import { Panel } from '@/components/section';
import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useSignInSettings, useUpdateSignInSetting } from './api';

type Switchable = (typeof SWITCHABLE_PROVIDERS)[number];
/** A duration in hours, or null: until changed. */
type Hours = (typeof SIGN_IN_DURATIONS_HOURS)[number] | null;

export const DEFAULT_SIGN_IN_HOURS: Hours = 3;

export function durationLabel(hours: Hours): string {
  if (hours === null) return 'Until changed';
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "9:30 PM" on the device's own clock; with the weekday when it is not today. */
export function untilLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, '0');
  const time = `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
  if (at.toDateString() === now.toDateString()) return time;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()];
  return `${weekday} ${time}`;
}

/** What is in force, in words: "Google and Facebook · sign-up open · until 9:30 PM". */
export function inForceLine(status: SignInClientStatus, configured: readonly AuthProvider[], now = new Date()) {
  const { effective } = status;
  const offered = effective.providers.filter((provider) => provider === 'google' || configured.includes(provider));
  const ways = describeProviders(offered);
  const signup = `sign-up ${effective.signup_open ? 'open' : 'closed'}`;
  if (effective.source === 'defaults') return `This address's defaults: ${ways} · ${signup}`;
  const until = effective.until ? `until ${untilLabel(effective.until, now)}` : 'until changed';
  return `${ways} · ${signup} · ${until}`;
}

/** The switches to start from: the stored setting while it is in force, else the defaults. */
function initialChoice(status: SignInClientStatus) {
  const source =
    status.effective.source === 'console' && status.setting
      ? { providers: status.setting.providers as AuthProvider[], signup_open: status.setting.signup_open }
      : status.defaults;
  return {
    providers: SWITCHABLE_PROVIDERS.filter((provider) => source.providers.includes(provider)),
    signup_open: source.signup_open,
  };
}

export function SignInSettingsSection() {
  const settings = useSignInSettings();
  if (settings.isPending) return <DetailSkeleton label="Loading the sign-in switches…" />;
  if (settings.isError) {
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  }
  const { clients, configured } = settings.data.data;
  return (
    <View testID="platform-sign-in" style={{ gap: space.lg }}>
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
        Sign-in
      </Text>
      {clients.map((status) => (
        // Keyed on what is stored, so a save (or another admin's) starts the switches afresh.
        <ClientCard
          key={`${status.client}:${JSON.stringify(status.setting)}:${status.effective.source}`}
          status={status}
          configured={configured}
        />
      ))}
    </View>
  );
}

function ClientCard({ status, configured }: { status: SignInClientStatus; configured: AuthProvider[] }) {
  const theme = useAppTheme();
  const toast = useToast();
  const update = useUpdateSignInSetting();
  const start = initialChoice(status);
  const [providers, setProviders] = useState<Switchable[]>(
    start.providers.filter((provider) => configured.includes(provider)),
  );
  const [signupOpen, setSignupOpen] = useState(start.signup_open);
  const [hours, setHours] = useState<Hours>(DEFAULT_SIGN_IN_HOURS);
  const { client } = status;
  const label = SIGN_IN_CLIENT_LABELS[client];
  const id = `platform-sign-in-${client}`;

  async function send(input: UpdateSignInSetting, done: string) {
    try {
      await update.mutateAsync(input);
      haptics.success();
      toast.success(done);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'That did not work. Try again.');
    }
  }

  function save() {
    haptics.selection();
    void send(
      { client, setting: { providers, signup_open: signupOpen, hours } },
      `Sign-in for the ${label.toLowerCase()} saved.`,
    );
  }

  function backToDefaults() {
    haptics.warning();
    Alert.alert(
      `Back to defaults for the ${label.toLowerCase()}?`,
      "This address's own sign-in settings apply again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Return to defaults',
          onPress: () =>
            void send({ client, setting: null }, `The ${label.toLowerCase()} is back to this address's defaults.`),
        },
      ],
    );
  }

  return (
    <Panel title={label} testID={id}>
      <View style={{ gap: space.md }}>
        <Text testID={`${id}-in-force`} variant="bodyMedium">
          {inForceLine(status, configured)}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Google is always on.
        </Text>
        {SWITCHABLE_PROVIDERS.map((provider) => {
          const setUp = configured.includes(provider);
          const on = setUp && providers.includes(provider);
          const disabled = !setUp || update.isPending;
          const name = AUTH_PROVIDER_LABELS[provider];
          return (
            <SwitchRow
              key={provider}
              testID={`${id}-${provider}`}
              label={name}
              hint={setUp ? undefined : 'Not set up here'}
              value={on}
              disabled={disabled}
              accessibilityLabel={`Offer ${name} in the ${label.toLowerCase()}`}
              onChange={(next) => {
                haptics.selection();
                setProviders((current) =>
                  next ? [...current, provider] : current.filter((chosen) => chosen !== provider),
                );
              }}
            />
          );
        })}
        <SwitchRow
          testID={`${id}-signup`}
          label="New people may sign up"
          value={signupOpen}
          disabled={update.isPending}
          accessibilityLabel={`New people may sign up in the ${label.toLowerCase()}`}
          onChange={(next) => {
            haptics.selection();
            setSignupOpen(next);
          }}
        />
        <View style={{ gap: space.xs }}>
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            For how long
          </Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {[...SIGN_IN_DURATIONS_HOURS, null].map((option) => (
              <Choice
                key={String(option)}
                wide
                testID={`${id}-hours-${option ?? 'until-changed'}`}
                label={durationLabel(option)}
                selected={hours === option}
                onPress={() => setHours(option)}
              />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button
            testID={`${id}-save`}
            mode="contained"
            loading={update.isPending}
            disabled={update.isPending}
            onPress={save}
          >
            Save
          </Button>
          {status.setting ? (
            <Button
              testID={`${id}-defaults`}
              mode="outlined"
              disabled={update.isPending}
              onPress={backToDefaults}
            >
              Back to defaults
            </Button>
          ) : null}
        </View>
      </View>
    </Panel>
  );
}

function SwitchRow({
  testID,
  label,
  hint,
  value,
  disabled,
  accessibilityLabel,
  onChange,
}: {
  testID: string;
  label: string;
  hint?: string;
  value: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onChange: (next: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelLarge" style={{ color: disabled && hint ? theme.tokens.mutedForeground : undefined }}>
          {label}
        </Text>
        {hint ? (
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  );
}
