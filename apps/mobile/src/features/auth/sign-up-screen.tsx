// Ported from apps/web/src/features/auth/signup-page.tsx @ 9485a8e
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { OptionPicker } from '@/components/option-picker';
import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { CheckRow } from '@/components/check-row';
import { useLargeText } from '@/hooks/use-large-text';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import { LegalLink } from './legal-links';
import { birthYears, firstNameOf, MONTHS } from './sign-up-model';

const MONTH_OPTIONS = MONTHS.map((name, i) => ({ id: String(i + 1), label: name }));

/**
 * Phase 52: a newcomer Google vouched for (or, with sign-in off, a typed address) says their
 * birth month and year -- only the band is kept, never the date; under 13, nothing at all -- and
 * accepts the terms. Then the Welcome screen. The month and year live in this screen's state only.
 */
export function SignUpScreen() {
  const { pendingSignup, completeSignup, cancelSignup } = useAuth();
  const theme = useAppTheme();
  const large = useLargeText();
  const muted = { color: theme.colors.onSurfaceVariant };
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [devName, setDevName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const [years] = useState(() => birthYears(new Date()).map((y) => ({ id: String(y), label: String(y) })));

  if (!pendingSignup) return <Screen testID="screen-sign-up">{null}</Screen>;
  const who = pendingSignup;
  const shownName = who.dev ? devName.trim() || who.email.split('@')[0] || who.email : who.name;

  async function submit() {
    setBusy(true);
    setProblem(null);
    try {
      await completeSignup({
        birth_year: Number(year),
        birth_month: Number(month),
        ...(who.dev && devName.trim() ? { dev_name: devName.trim() } : {}),
      });
    } catch (caught) {
      const refusal =
        caught instanceof ApiRequestError && caught.status !== 0
          ? { code: caught.code, message: caught.message }
          : { code: 'internal_error', message: 'Could not sign you up. Please try again.' };
      if (refusal.code !== 'rate_limited' && refusal.code !== 'too_young') haptics.error();
      setProblem(refusal);
    } finally {
      setBusy(false);
    }
  }

  if (problem?.code === 'too_young') {
    return (
      <Screen testID="screen-sign-up" edges={['top', 'bottom']}>
        <OutlinedCard testID="signup-too-young" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <Text variant="titleLarge" accessibilityRole="header">
              Ask a parent to add you
            </Text>
            <Text variant="bodyMedium" style={muted}>
              You need to be 13 or older to have an account of your own. A parent can make a space and add you to it.
              Nothing about you has been kept.
            </Text>
            <Button testID="signup-too-young-back" mode="contained" onPress={() => void cancelSignup()}>
              Back to sign-in
            </Button>
          </View>
        </OutlinedCard>
      </Screen>
    );
  }

  // A token older than 15 minutes: the server's sentence, and a fresh start.
  const expired = !who.dev && problem !== null && (problem.code === 'unauthenticated' || problem.code === 'bad_request');
  const ready = Boolean(month && year && accepted) && !busy;

  return (
    <Screen testID="screen-sign-up" edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <LogoMark size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="titleLarge" accessibilityRole="header">
            {`Welcome, ${firstNameOf(shownName)}`}
          </Text>
          <Text variant="bodySmall" style={muted}>
            {who.email}
          </Text>
        </View>
      </View>

      {who.dev ? (
        <TextInput
          testID="signup-dev-name"
          mode="outlined"
          label="Your name"
          placeholder={who.email.split('@')[0]}
          value={devName}
          onChangeText={setDevName}
          autoCorrect={false}
          autoCapitalize="words"
        />
      ) : null}

      <View style={{ gap: space.sm }}>
        <Text variant="titleSmall">When were you born?</Text>
        <View style={{ flexDirection: large ? 'column' : 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: large ? undefined : 1, alignSelf: 'stretch' }}>
            <OptionPicker
              testID="signup-month"
              label="Month"
              placeholder="Month"
              options={MONTH_OPTIONS}
              value={month}
              onChange={setMonth}
              defaultOpen={false}
              scroll
            />
          </View>
          <View style={{ flex: large ? undefined : 1, alignSelf: 'stretch' }}>
            <OptionPicker
              testID="signup-year"
              label="Year"
              placeholder="Year"
              options={years}
              value={year}
              onChange={setYear}
              defaultOpen={false}
              searchPlaceholder="Type a year"
            />
          </View>
        </View>
        <Text variant="bodySmall" style={muted}>
          Only whether you are over 18 is kept, never the date.
        </Text>
      </View>

      <View style={{ gap: space.xs }}>
        <CheckRow
          testID="signup-accept"
          label="I agree to the Terms and the Privacy notice"
          checked={accepted}
          onChange={setAccepted}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingLeft: 30 }}>
          <LegalLink kind="terms" label="Read the Terms" testID="signup-terms" />
          <LegalLink kind="privacy" label="Read the Privacy notice" testID="signup-privacy" />
        </View>
      </View>

      {problem ? (
        <Text
          testID="signup-error"
          variant="bodyMedium"
          accessibilityLiveRegion="polite"
          style={{ color: problem.code === 'rate_limited' ? theme.colors.onSurfaceVariant : theme.colors.error }}
        >
          {problem.message}
        </Text>
      ) : null}

      {expired ? (
        <Button testID="signup-restart" mode="contained" onPress={() => void cancelSignup()}>
          Start again
        </Button>
      ) : (
        <Button testID="signup-submit" mode="contained" onPress={() => void submit()} disabled={!ready} loading={busy}>
          Continue
        </Button>
      )}
      <Button testID="signup-cancel" mode="text" onPress={() => void cancelSignup()} disabled={busy}>
        Cancel
      </Button>
    </Screen>
  );
}
