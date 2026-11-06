// Ported from apps/web/src/features/auth/signup-page.tsx @ 9485a8e
//
// UI audit (JF8, JF35; Phase 70): under 13 is "Ask a grown-up to add you", with Keep playing where guest
// play is offered; this phone remembers the refusal (a key of the address, never the address: the guest
// store), so the same account is not asked its age again here; the month list shows all twelve months.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { guestMemory, guestMemoryReady, loadGuestMemory } from '@/features/guest/guest-store';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import { LegalLink } from './legal-links';
import { birthYears, birthYearStart, firstNameOf, MONTHS } from './sign-up-model';

const MONTH_OPTIONS = MONTHS.map((name, i) => ({ id: String(i + 1), label: name }));

/** The under-13 screen's words (the web's): with guest play, it says play goes on without an account. */
export const TOO_YOUNG_TITLE = 'Ask a grown-up to add you';
export const TOO_YOUNG_BODY =
  'You need to be 13 or older for an account of your own. You can keep playing without one, and a grown-up can sign up and add you to their space. Nothing about you was stored on our side.';
/** Where there is no guest play to go back to. */
export const TOO_YOUNG_BODY_NO_PLAY =
  'You need to be 13 or older for an account of your own. A grown-up can sign up and add you to their space. Nothing about you was stored on our side.';

/** Whether this phone refused this account as under 13: null until the guest memory has been read. */
function knownYoungNow(email: string | undefined): boolean | null {
  return guestMemoryReady() ? guestMemory.refusedYoung(email) : null;
}

/**
 * Phase 52: a newcomer Google vouched for (or, with sign-in off, a typed address) says their
 * birth month and year -- only the band is kept, never the date; under 13, nothing at all -- and
 * accepts the terms. Then (Phase 63, P13) the app lands in the personal space the server made for
 * them -- no Welcome screen. The month and year live in this screen's state only. It is also the
 * sign-up sheet's second step (features/guest/signup-sheet.tsx), which hears a cancel through
 * `onCancelled` and closes itself for Keep playing (`onKeepPlaying`; the route goes to the Play home).
 */
export function SignUpScreen({
  onCancelled,
  onKeepPlaying,
}: { onCancelled?: () => void; onKeepPlaying?: () => void } = {}) {
  const { pendingSignup, completeSignup, cancelSignup: cancelPending, config } = useAuth();
  const cancelSignup = async () => {
    await cancelPending();
    onCancelled?.();
  };
  const guestPlay = Boolean(config?.guest);
  // Under 13, with guest play: back to it. The sheet closes over the quest (and forgets the sign-up as it
  // goes); the route goes to the Play home, then forgets it (navigating first, so nothing redraws on the
  // way out).
  const keepPlaying = async () => {
    if (onKeepPlaying) {
      onKeepPlaying();
      return;
    }
    router.dismissTo('/play');
    await cancelSignup();
  };
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
  // Phase 78 (JF35): the list opens near an adult's year, every year a scroll away; or the year is typed.
  const [yearStart] = useState(() => String(birthYearStart(new Date())));
  // This account was refused as under 13 on this phone: the answer straight away, not the age question.
  const email = pendingSignup?.email;
  const [knownYoung, setKnownYoung] = useState<boolean | null>(() => knownYoungNow(email));
  useEffect(() => {
    if (knownYoung !== null) return;
    let live = true;
    void loadGuestMemory().then(() => {
      if (live) setKnownYoung(guestMemory.refusedYoung(email));
    });
    return () => {
      live = false;
    };
  }, [knownYoung, email]);

  if (!pendingSignup || knownYoung === null) return <Screen testID="screen-sign-up">{null}</Screen>;
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
      // Remembered on this phone, by a key of the address only (owner, 2026-11-04).
      if (refusal.code === 'too_young') {
        await loadGuestMemory();
        guestMemory.rememberYoung(who.email);
      }
      setProblem(refusal);
    } finally {
      setBusy(false);
    }
  }

  if (problem?.code === 'too_young' || knownYoung) {
    return (
      <Screen testID="screen-sign-up" edges={['top', 'bottom']}>
        <OutlinedCard testID="signup-too-young" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <Text testID="signup-too-young-title" variant="titleLarge" accessibilityRole="header">
              {TOO_YOUNG_TITLE}
            </Text>
            <Text testID="signup-too-young-body" variant="bodyMedium" style={muted}>
              {guestPlay ? TOO_YOUNG_BODY : TOO_YOUNG_BODY_NO_PLAY}
            </Text>
            {guestPlay ? (
              <Button
                testID="signup-too-young-keep-playing"
                mode="contained"
                icon="gamepad-variant-outline"
                onPress={() => void keepPlaying()}
                contentStyle={{ minHeight: 48 }}
              >
                Keep playing
              </Button>
            ) : (
              <Button
                testID="signup-too-young-back"
                mode="contained"
                onPress={() => void cancelSignup()}
                contentStyle={{ minHeight: 48 }}
              >
                Back to sign-in
              </Button>
            )}
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
        {/* One above the other, so the month's grid has the width for all twelve (JF35), and the year's
            list never opens beside it. */}
        <View style={{ gap: space.sm }}>
          <OptionPicker
            testID="signup-month"
            label="Month"
            placeholder="Month"
            options={MONTH_OPTIONS}
            value={month}
            onChange={setMonth}
            defaultOpen={false}
            columns={large ? 2 : 3}
          />
          <OptionPicker
            testID="signup-year"
            label="Year"
            placeholder="Year"
            options={years}
            value={year}
            onChange={setYear}
            defaultOpen={false}
            scroll
            startAt={yearStart}
            searchPlaceholder="Type a year"
          />
        </View>
        <Text variant="bodySmall" style={muted}>
          We keep only your age group, never the date.
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
