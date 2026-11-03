// Ported from apps/web/src/features/guest/guest-home.tsx @ 74c167b (working tree, the redesign). Phase 63
// (P10), redesigned 2026-11-02 as the Quest board (direction C, docs/landing-page-proposal.md, "The
// owner's decisions"): the app's first screen for someone signed out while guest play is on. A band in
// the brand's deepest blues (the mark, Sign in, the headline, the console's home bar), Today's 5 over its
// foot, a grade row (1-8, remembered on this phone), the grade's quests as game cards (the locked ones
// the offer), the advanced ones, two panels for grown-ups, three short answers, and the footer. A level
// is "Grade 4" or "Adv G4" to a guest: never a code or a curriculum's name.
//
// Mobile: Sign in opens the sign-in screen; "Create a free family space" and the offer's Sign up open the
// sign-up sheet over this screen. Once signed in (by either), the app lands as usual. Two columns of
// cards on a phone, four (and the panels side by side) on a wide screen.
import {
  GUEST_GRADES,
  GUEST_PROMISES,
  GUEST_TODAY_SIZE,
  PLATFORM_CONTACT_EMAIL,
  guestBoard,
  guestDay,
  guestLevelWords,
  guestTileDetail,
  guestTileName,
  guestTileTitle,
  guestTodayLevel,
  homeBarAfterSignUp,
  type GuestGrade,
  type GuestTile,
} from '@tmi/shared';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ConnectivityBanner } from '@/components/connectivity';
import { LogoMark } from '@/components/logo';
import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { openLegal } from '@/features/auth/legal-links';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { countEvent } from './guest-api';
import { benefitsFor, boardGrade, gradeLevel, playLink } from './guest-model';
import { openSignupSheet } from './guest-nav';
import { guestMemory, type GuestToday } from './guest-store';
import { NudgeSheet } from './nudge-sheet';

/** The three short answers under the grown-ups' panels (owner, 2026-11-02). */
export const GUEST_ANSWERS = [
  {
    question: 'Is it free?',
    answer:
      'Yes. Anyone can play the free quests without an account. A free account unlocks every quest, family games and progress.',
  },
  {
    question: 'Is it safe for my child?',
    answer:
      'Guests aren’t tracked: no account, no ads, and answers stay on this device. Children under 13 join through a parent’s account.',
  },
  { question: 'Which grades?', answer: 'Grades 1 to 8, with harder Adv quests for a stretch.' },
] as const;

/** What this phone remembers that the board shows, re-read whenever the board comes back into view. */
function readMemory(day: string): { today: GuestToday | undefined; bests: Record<string, number> } {
  return { today: guestMemory.todayOn(day), bests: guestMemory.bests() };
}

export function GuestHome() {
  const theme = useAppTheme();
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const { config, status } = useAuth();
  const focused = useIsFocused();
  const guest = config?.guest;
  const tiles = guest?.tiles ?? [];
  const [grade, setGrade] = useState<GuestGrade>(() => boardGrade(guestMemory.grade()));
  const [locked, setLocked] = useState<GuestTile | null>(null);
  const [day] = useState(() => guestDay());
  const [memory, setMemory] = useState(() => readMemory(day));
  const [bandSize, setBandSize] = useState({ width: 0, height: 0 });

  useEffect(() => countEvent({ name: 'home_viewed', source: 'home' }), []);

  // Back from a quest: its best score and Today's 5 as played.
  useEffect(() => {
    // Read from the phone's memory (a module) when the board is in front again: not a derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (focused) setMemory(readMemory(day));
  }, [focused, day]);

  // Signed in from here (the sheet or the sign-in screen): land as usual, once this screen is in front.
  useEffect(() => {
    if (focused && status === 'authenticated') router.replace('/');
  }, [focused, status]);

  if (!guest) return <Screen testID="screen-guest-home">{null}</Screen>;
  const board = guestBoard(tiles, grade);
  const todayLevel = guestTodayLevel(tiles, grade);
  const today = todayLevel && memory.today?.level === todayLevel ? memory.today : undefined;
  const signupOpen = config?.signup_open === true;
  const muted = { color: theme.tokens.mutedForeground };
  const gutter = { paddingHorizontal: space.lg };
  const onBand = theme.tokens.brand50;
  const homeBar = homeBarAfterSignUp(guest.settings.home_bar);

  function chooseGrade(next: GuestGrade) {
    haptics.selection();
    setGrade(next);
    guestMemory.setGrade(gradeLevel(tiles, next));
  }

  function openTile(tile: GuestTile) {
    haptics.selection();
    if (tile.locked) {
      countEvent({ name: 'locked_tile_tapped', tile: tile.code, source: 'locked' });
      setLocked(tile);
      return;
    }
    router.push({ pathname: '/play/[code]', params: { code: tile.code } });
  }

  function startAccount() {
    countEvent({ name: 'signup_started', source: 'home' });
    if (signupOpen) openSignupSheet();
    else router.push('/sign-in');
  }

  return (
    // Its own scroll view rather than Screen's: the band runs up under the status bar (no automatic
    // inset), so its blue meets the top of the screen.
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        testID="screen-guest-home"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ gap: space.xl, paddingBottom: space.xxl + insets.bottom }}
        contentInsetAdjustmentBehavior="never"
      >
        {focused ? <StatusBar style="light" /> : null}
        {/* The band: the brand's deepest blues, the bullseye's rings faint at its top right. */}
        <View
          testID="guest-home"
          onLayout={(e) =>
            setBandSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
          }
          style={{
            backgroundColor: theme.tokens.brand900,
            paddingTop: insets.top + space.md,
            paddingBottom: space.xxl + 40,
            paddingHorizontal: space.lg,
            gap: space.md,
            overflow: 'hidden',
          }}
        >
          <Svg
            style={{ position: 'absolute', top: 0, left: 0 }}
            width={bandSize.width}
            height={bandSize.height}
            aria-hidden
          >
            <Defs>
              {/* Top to bottom, flat under the status bar (its strip is brand-900), so no seam shows. */}
              <LinearGradient id="guest-band" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.tokens.brand900} />
                <Stop offset={bandSize.height ? insets.top / bandSize.height : 0} stopColor={theme.tokens.brand900} />
                <Stop offset="1" stopColor={theme.tokens.brand800} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={bandSize.width} height={bandSize.height} fill="url(#guest-band)" />
          </Svg>
          <View
            pointerEvents="none"
            aria-hidden
            style={{ position: 'absolute', top: insets.top - 70, right: -90, opacity: 0.09 }}
          >
            <Svg width={260} height={260} viewBox="0 0 260 260">
              {[124, 92, 60, 28].map((r) => (
                <Circle key={r} cx={130} cy={130} r={r} stroke={onBand} strokeWidth={10} fill="none" />
              ))}
            </Svg>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            {/* The mark on a light tile: on the band, the brand's own colour would vanish. */}
            <View style={{ backgroundColor: onBand, borderRadius: radius.md, padding: 3 }}>
              <LogoMark size={34} />
            </View>
            <Text
              variant="titleMedium"
              style={{ flex: 1, fontWeight: '700', color: onBand }}
              numberOfLines={1}
            >
              {brand.short}
            </Text>
            <Pressable
              testID="guest-sign-in"
              accessibilityRole="button"
              onPress={() => router.push('/sign-in')}
              hitSlop={4}
              style={({ pressed }) => ({
                minHeight: 40,
                justifyContent: 'center',
                paddingHorizontal: space.lg,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: withAlpha(onBand, 0.7),
                backgroundColor: pressed ? withAlpha(onBand, 0.12) : 'transparent',
              })}
            >
              <Text variant="titleSmall" style={{ color: onBand, fontWeight: '600' }}>
                Sign in
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: space.md, marginTop: space.sm }}>
            <View>
              <Text variant="headlineLarge" accessibilityRole="header" style={{ fontWeight: '800', color: onBand }}>
                Math quests.
              </Text>
              <Text variant="headlineLarge" style={{ fontWeight: '800', color: theme.tokens.warning }}>
                Hit the target.
              </Text>
            </View>
            <View testID="guest-promises" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs }}>
              {GUEST_PROMISES.map((promise) => (
                <View
                  key={promise}
                  style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: space.xs }}
                >
                  <Icon source="check-bold" size={16} color={theme.tokens.warning} />
                  <Text variant="bodyMedium" style={{ color: onBand, flexShrink: 1 }}>
                    {promise}
                  </Text>
                </View>
              ))}
            </View>
            <View
              testID="guest-home-bar"
              style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
            >
              {homeBar !== null && signupOpen ? (
                <>
                  <Pressable
                    testID="guest-band-signup"
                    accessibilityRole="button"
                    onPress={startAccount}
                    style={({ pressed }) => ({
                      minHeight: MIN_TARGET,
                      justifyContent: 'center',
                      paddingHorizontal: space.xl,
                      borderRadius: radius.pill,
                      backgroundColor: pressed ? withAlpha(onBand, 0.85) : onBand,
                    })}
                  >
                    <Text variant="titleSmall" style={{ color: theme.tokens.brand900, fontWeight: '700' }}>
                      Sign up
                    </Text>
                  </Pressable>
                  <Text variant="bodyMedium" style={{ color: theme.tokens.brand200, flexShrink: 1 }}>
                    {homeBar}
                  </Text>
                </>
              ) : (
                <Text variant="bodyMedium" style={{ color: theme.tokens.brand200 }}>
                  {guest.settings.home_bar}
                </Text>
              )}
            </View>
          </View>
        </View>

        {todayLevel ? (
          <View style={{ ...gutter, marginTop: -40 - space.xl }}>
            <ConnectivityBanner />
            <TodayCard
              level={todayLevel}
              played={today}
              onPlay={() => {
                haptics.selection();
                router.push({ pathname: '/play/today', params: { level: todayLevel } });
              }}
            />
          </View>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text
            variant="labelMedium"
            style={{ ...gutter, ...muted, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            Your grade
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="radiogroup"
            contentContainerStyle={{ ...gutter, gap: space.sm }}
          >
            {GUEST_GRADES.map((g) => {
              const selected = g === grade;
              return (
                <Pressable
                  key={g}
                  testID={`guest-grade-${g}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Grade ${g}`}
                  accessibilityState={{ checked: selected, selected }}
                  onPress={() => chooseGrade(g)}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: selected ? theme.tokens.primary : theme.colors.outlineVariant,
                    backgroundColor: selected
                      ? theme.tokens.primary
                      : pressed
                        ? withAlpha(theme.tokens.primary, 0.08)
                        : theme.colors.surface,
                  })}
                >
                  <Text
                    variant="titleMedium"
                    style={{
                      fontWeight: '700',
                      color: selected ? theme.tokens.primaryForeground : theme.colors.onSurface,
                    }}
                  >
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ ...gutter, gap: space.md }}>
          {board.standard.length === 0 && board.advanced.length === 0 ? (
            <Text testID="guest-board-empty" variant="bodyMedium" style={muted}>
              {`Quests for Grade ${grade} are on their way.`}
            </Text>
          ) : (
            <CardGrid tiles={board.standard} columns={wide ? 4 : 2} bests={memory.bests} onPress={openTile} />
          )}
          {board.advanced.length > 0 ? (
            <>
              <Text
                variant="titleMedium"
                accessibilityRole="header"
                style={{ fontWeight: '700', marginTop: space.sm }}
              >
                Advanced
              </Text>
              <CardGrid
                tiles={board.advanced}
                columns={wide ? 4 : 2}
                bests={memory.bests}
                onPress={openTile}
                advanced
              />
            </>
          ) : null}
        </View>

        <View style={{ ...gutter, gap: space.md, flexDirection: wide ? 'row' : 'column' }}>
          <PlayTogether signupOpen={signupOpen} onStart={startAccount} />
        </View>

        <View style={{ ...gutter, gap: space.xs }}>
          {GUEST_ANSWERS.map((item, index) => (
            <Answer key={item.question} index={index} question={item.question} answer={item.answer} />
          ))}
        </View>

        <View
          testID="guest-footer"
          style={{
            ...gutter,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <FooterLink testID="guest-privacy" label="Privacy" onPress={() => openLegal('privacy')} />
          <Text variant="bodyMedium" style={muted} aria-hidden>
            ·
          </Text>
          <FooterLink testID="guest-terms" label="Terms" onPress={() => openLegal('terms')} />
          <Text variant="bodyMedium" style={muted} aria-hidden>
            ·
          </Text>
          <FooterLink
            testID="guest-contact"
            label="Contact us"
            onPress={() => void Linking.openURL(`mailto:${PLATFORM_CONTACT_EMAIL}`).catch(() => undefined)}
          />
        </View>

        <NudgeSheet
          open={locked !== null}
          headline={locked ? `${guestTileTitle(locked)} is free with an account` : ''}
          benefits={benefitsFor(locked?.level_id, guest.member_counts)}
          onSignUp={() => {
            countEvent({ name: 'signup_started', source: 'locked', tile: locked?.code });
            setLocked(null);
            openSignupSheet();
          }}
          onClose={() => setLocked(null)}
          closeLabel="Not now"
          shareLink={playLink(serverOrigin())}
        />
      </ScrollView>
      {/* The status bar's own strip, in the band's blue: the light status text stays readable as the
          board scrolls beneath it. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: theme.tokens.brand900,
        }}
      />
    </View>
  );
}

/** Today's 5: the day's five of the grade's level, and once played, the hits. */
function TodayCard({
  level,
  played,
  onPlay,
}: {
  level: GuestTile['level_id'];
  played: GuestToday | undefined;
  onPlay: () => void;
}) {
  const theme = useAppTheme();
  const hits = played?.hits.filter(Boolean).length ?? 0;
  return (
    <OutlinedCard testID="guest-today" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text
          variant="labelMedium"
          style={{
            color: theme.tokens.primary,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {`Today’s 5 · ${guestLevelWords(level)}`}
        </Text>
        <Text testID="guest-today-line" variant="titleMedium" style={{ fontWeight: '700' }}>
          {played
            ? `You hit ${hits} of ${played.hits.length} today. A new five tomorrow.`
            : 'Five questions. Can you hit all five?'}
        </Text>
        <View
          testID="guest-today-rings"
          accessible
          accessibilityLabel={
            played ? `${hits} hit of ${played.hits.length}` : 'Five targets, not played yet'
          }
          style={{ flexDirection: 'row', gap: space.sm }}
        >
          {Array.from({ length: GUEST_TODAY_SIZE }, (_, i) => (
            <TargetRing
              key={i}
              state={
                played ? (played.hits[i] === undefined ? 'open' : played.hits[i] ? 'hit' : 'miss') : 'open'
              }
            />
          ))}
        </View>
        <Button
          testID="guest-today-play"
          mode="contained"
          buttonColor={theme.tokens.warning}
          textColor={theme.tokens.warningForeground}
          icon={played ? 'replay' : 'bullseye-arrow'}
          onPress={onPlay}
          contentStyle={{ minHeight: 48 }}
          labelStyle={{ fontWeight: '700' }}
        >
          {played ? 'Play again' : 'Play today’s 5'}
        </Button>
      </View>
    </OutlinedCard>
  );
}

/** One of Today's five targets: open, hit (filled amber) or missed (faint). */
function TargetRing({ state }: { state: 'open' | 'hit' | 'miss' }) {
  const theme = useAppTheme();
  const ink =
    state === 'hit'
      ? theme.tokens.warning
      : state === 'miss'
        ? theme.colors.outlineVariant
        : theme.tokens.primary;
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" aria-hidden>
      <Circle
        cx={18}
        cy={18}
        r={16}
        stroke={ink}
        strokeWidth={2.5}
        fill={state === 'hit' ? withAlpha(theme.tokens.warning, 0.22) : 'none'}
      />
      <Circle cx={18} cy={18} r={10} stroke={ink} strokeWidth={2.5} fill="none" />
      <Circle
        cx={18}
        cy={18}
        r={4}
        fill={state === 'miss' ? 'none' : ink}
        stroke={ink}
        strokeWidth={state === 'miss' ? 2 : 0}
      />
    </Svg>
  );
}

/** Cards in rows of `columns`, the last row's gaps kept empty so no card stretches. */
function CardGrid({
  tiles,
  columns,
  bests,
  onPress,
  advanced = false,
}: {
  tiles: GuestTile[];
  columns: number;
  bests: Record<string, number>;
  onPress: (tile: GuestTile) => void;
  advanced?: boolean;
}) {
  const rows: GuestTile[][] = [];
  for (let i = 0; i < tiles.length; i += columns) rows.push(tiles.slice(i, i + columns));
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row) => (
        <View key={row.map((t) => t.code).join()} style={{ flexDirection: 'row', gap: space.md }}>
          {row.map((tile) => (
            <QuestCard
              key={tile.code}
              tile={tile}
              best={bests[tile.code]}
              onPress={() => onPress(tile)}
              advanced={advanced}
            />
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`gap-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A quest as a game card: a coloured band with its icon, its title and its detail; locked, the offer. */
function QuestCard({
  tile,
  best,
  onPress,
  advanced,
}: {
  tile: GuestTile;
  best: number | undefined;
  onPress: () => void;
  advanced: boolean;
}) {
  const theme = useAppTheme();
  const timed = tile.kind === 'quest' && tile.mode === 'timed';
  // Locked: a big lock on a tinted band, so it reads at a glance and stands off the page.
  const icon = tile.locked
    ? 'lock'
    : tile.kind === 'assessment'
      ? 'pencil-outline'
      : timed
        ? 'timer-outline'
        : 'bullseye-arrow';
  const band = tile.locked
    ? withAlpha(theme.tokens.primary, 0.15)
    : timed
      ? theme.tokens.warning
      : theme.tokens.primary;
  const ink = tile.locked
    ? theme.tokens.primary
    : timed
      ? theme.tokens.warningForeground
      : theme.tokens.primaryForeground;
  const title = guestTileTitle(tile);
  const detail = advanced
    ? `${guestLevelWords(tile.level_id)} · ${guestTileDetail(tile)}`
    : guestTileDetail(tile);
  return (
    <Pressable
      testID={tile.locked ? `guest-locked-${tile.code}` : `guest-tile-${tile.code}`}
      accessibilityRole="button"
      accessibilityLabel={
        tile.locked ? `${title} is free with an account` : `Play ${guestTileName(tile)}: ${detail}`
      }
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        borderWidth: 1,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderColor: pressed ? theme.tokens.primary : theme.colors.outline,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.85 : 1,
        // Lift the card off the page: on a light page a card and the background are close.
        shadowColor: theme.colors.shadow,
        shadowOpacity: theme.dark ? 0 : 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      })}
    >
      <View
        style={{ height: 56, backgroundColor: band, justifyContent: 'center', paddingHorizontal: space.md }}
      >
        <Icon source={icon} size={tile.locked ? 34 : 28} color={ink} />
      </View>
      <View style={{ padding: space.md, gap: 2, minHeight: 84 }}>
        <Text
          variant="titleMedium"
          style={{
            fontWeight: '700',
            color: theme.colors.onSurface,
          }}
        >
          {title}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {detail}
        </Text>
        {tile.locked ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
            <Icon source="lock-outline" size={14} color={theme.tokens.primary} />
            <Text variant="labelMedium" style={{ color: theme.tokens.primary, fontWeight: '700' }}>
              Free account
            </Text>
          </View>
        ) : best !== undefined ? (
          <Text variant="labelMedium" style={{ color: theme.tokens.primary, marginTop: space.xs }}>
            {`Best: ${best}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "Play together": what family games look like, an example. */
function PlayTogether({ signupOpen, onStart }: { signupOpen: boolean; onStart: () => void }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const people = [
    { initial: 'M', color: theme.tokens.primary, ink: theme.tokens.primaryForeground },
    { initial: 'J', color: theme.tokens.warning, ink: theme.tokens.warningForeground },
    { initial: 'A', color: theme.tokens.success, ink: theme.tokens.successForeground },
  ];
  return (
    <OutlinedCard
      testID="guest-parents"
      style={{ borderRadius: radius.lg, flex: width >= 700 ? 1 : undefined }}
    >
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="titleSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
          Play together · One code, everyone joins
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
          <View
            accessible
            accessibilityLabel="Example game code Q F 7 K 2 M"
            style={{
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderRadius: radius.md,
              backgroundColor: withAlpha(theme.tokens.primary, 0.1),
            }}
          >
            <Text
              variant="titleLarge"
              style={{ fontWeight: '800', letterSpacing: 3, color: theme.tokens.primary }}
            >
              QF7K2M
            </Text>
          </View>
          <View style={{ flexDirection: 'row' }} aria-hidden>
            {people.map((p, i) => (
              <View
                key={p.initial}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  marginLeft: i === 0 ? 0 : -8,
                  borderWidth: 2,
                  borderColor: theme.colors.surface,
                  backgroundColor: p.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="labelLarge" style={{ color: p.ink, fontWeight: '700' }}>
                  {p.initial}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Family games with a free account. Example code.
        </Text>
        <Button testID="guest-parents-start" mode="contained" onPress={onStart} contentStyle={{ minHeight: 48 }}>
          {signupOpen ? 'Create a free family space' : 'Sign in'}
        </Button>
      </View>
    </OutlinedCard>
  );
}

/** One short answer, opened by a tap. */
function Answer({ index, question, answer }: { index: number; question: string; answer: string }) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant }}>
      <Pressable
        testID={`guest-answer-${index}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptics.selection();
          setOpen((o) => !o);
        }}
        style={{ minHeight: MIN_TARGET + 4, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Text variant="titleSmall" style={{ flex: 1, fontWeight: '600' }}>
          {question}
        </Text>
        <Icon source={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.tokens.mutedForeground} />
      </Pressable>
      {open ? (
        <Text
          testID={`guest-answer-${index}-text`}
          variant="bodyMedium"
          style={{ color: theme.tokens.mutedForeground, paddingBottom: space.md }}
        >
          {answer}
        </Text>
      ) : null}
    </View>
  );
}

function FooterLink({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={onPress}
      style={{ minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: space.sm }}
    >
      <Text variant="bodyMedium" style={{ color: theme.tokens.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}
