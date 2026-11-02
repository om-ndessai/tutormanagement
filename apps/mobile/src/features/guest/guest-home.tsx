// Ported from apps/web/src/features/guest/guest-home.tsx @ 0e3ec7a (working tree). Phase 63 (P10): the
// guest Play home -- the app's first screen for someone signed out while guest play is on. One tap
// plays: grade chips (remembered on this phone), the open tiles large, the locked ones as "Free with an
// account" (the offer), a strip for parents and tutors, the home bar, the trust line, and Sign in.
//
// Mobile: Sign in opens the sign-in screen (one tap away, as before); "Get started free" and the offer's
// Sign up open the sign-up sheet over this screen. Once signed in (by either), the app lands as usual:
// the person's space -- after sign-up, their personal one.
import { TILE_LEVEL_WORDS, type GuestTile, type QuestionBankLevelId } from '@tmi/shared';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Icon, Text } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { LegalLine } from '@/features/auth/legal-links';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { CHIP_HIT_SLOP, MIN_TARGET, radius, space } from '@/theme/tokens';
import { countEvent } from './guest-api';
import { benefitsFor, chosenLevel, homeLevels, playLink } from './guest-model';
import { openSignupSheet } from './guest-nav';
import { guestMemory } from './guest-store';
import { NudgeSheet } from './nudge-sheet';

export function GuestHome() {
  const theme = useAppTheme();
  const brand = useBrand();
  const { config, status } = useAuth();
  const focused = useIsFocused();
  const guest = config?.guest;
  const tiles = guest?.tiles ?? [];
  const levels = homeLevels(tiles);
  const [grade, setGrade] = useState<QuestionBankLevelId | undefined>(() => guestMemory.grade());
  const [locked, setLocked] = useState<GuestTile | null>(null);
  const chosen = chosenLevel(levels, grade);

  useEffect(() => countEvent({ name: 'home_viewed', source: 'home' }), []);

  // Signed in from here (the sheet or the sign-in screen): land as usual, once this screen is in front.
  useEffect(() => {
    if (focused && status === 'authenticated') router.replace('/');
  }, [focused, status]);

  if (!guest) return <Screen testID="screen-guest-home">{null}</Screen>;
  const open = tiles.filter((tile) => !tile.locked && tile.level_id === chosen);
  const lockedTiles = tiles.filter((tile) => tile.locked && tile.level_id === chosen);
  const muted = { color: theme.tokens.mutedForeground };

  return (
    <Screen testID="screen-guest-home" edges={['top', 'bottom']}>
      <View testID="guest-home" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <LogoMark size={36} />
        <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
          {brand.name}
        </Text>
        <Button testID="guest-sign-in" mode="outlined" compact onPress={() => router.push('/sign-in')}>
          Sign in
        </Button>
      </View>
      <View
        style={{
          backgroundColor: withAlpha(theme.colors.primary, 0.1),
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
        }}
      >
        <Text testID="guest-home-bar" variant="bodyMedium" style={{ textAlign: 'center' }}>
          {guest.settings.home_bar}
        </Text>
      </View>

      <View style={{ gap: space.xs }}>
        <Text variant="headlineSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
          Math practice that feels like a game
        </Text>
        <Text variant="bodyMedium" style={muted}>
          No sign-up to start. Pick your grade and tap a quest.
        </Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Your grade" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {levels.map((level) => (
          <Chip
            key={level}
            testID={`guest-grade-${level}`}
            hitSlop={CHIP_HIT_SLOP}
            selected={level === chosen}
            showSelectedCheck={false}
            mode={level === chosen ? 'flat' : 'outlined'}
            accessibilityRole="radio"
            accessibilityState={{ checked: level === chosen }}
            onPress={() => {
              haptics.selection();
              setGrade(level);
              guestMemory.setGrade(level);
            }}
          >
            {TILE_LEVEL_WORDS[level]}
          </Chip>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="labelMedium" style={{ ...muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Play now
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {open.map((tile) => {
            const best = guestMemory.best(tile.code);
            return (
              <Pressable
                key={tile.code}
                testID={`guest-tile-${tile.code}`}
                accessibilityRole="button"
                accessibilityLabel={`Play ${tile.code}: ${tile.words}`}
                onPress={() => {
                  haptics.selection();
                  router.push({ pathname: '/play/[code]', params: { code: tile.code } });
                }}
                style={({ pressed }) => ({
                  flexGrow: 1,
                  flexBasis: '45%',
                  minHeight: 96,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  borderColor: pressed ? theme.colors.primary : theme.colors.outlineVariant,
                  backgroundColor: pressed ? withAlpha(theme.colors.primary, 0.06) : theme.colors.surface,
                  padding: space.lg,
                  gap: 2,
                })}
              >
                <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
                  {tile.code}
                </Text>
                <Text variant="bodySmall" style={muted}>
                  {tile.words}
                </Text>
                {best !== undefined ? (
                  <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                    {`Best: ${best}`}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {lockedTiles.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="labelMedium" style={{ ...muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            More with a free account
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {lockedTiles.map((tile) => (
              <Pressable
                key={tile.code}
                testID={`guest-locked-${tile.code}`}
                accessibilityRole="button"
                accessibilityLabel={`${tile.code} is free with an account`}
                onPress={() => {
                  haptics.selection();
                  countEvent({ name: 'locked_tile_tapped', tile: tile.code, source: 'locked' });
                  setLocked(tile);
                }}
                style={({ pressed }) => ({
                  flexGrow: 1,
                  flexBasis: '30%',
                  minHeight: MIN_TARGET + 24,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: pressed ? theme.tokens.muted : withAlpha(theme.tokens.muted, 0.5),
                  padding: space.md,
                  gap: 2,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Icon source="lock-outline" size={14} color={theme.tokens.mutedForeground} />
                  <Text variant="titleSmall" style={{ ...muted, fontWeight: '700' }}>
                    {tile.code}
                  </Text>
                </View>
                <Text variant="bodySmall" style={muted}>
                  {tile.words}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                  Free
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <OutlinedCard testID="guest-parents" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.xs }}>
          <Text variant="titleSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
            For parents and tutors
          </Text>
          <Text variant="bodyMedium" style={muted}>
            Start your family’s space: add your children, play family games, follow their progress and give assessments.
          </Text>
          <Button
            testID="guest-parents-start"
            mode="outlined"
            style={{ alignSelf: 'flex-start', marginTop: space.sm }}
            onPress={() => {
              countEvent({ name: 'signup_started', source: 'home' });
              openSignupSheet();
            }}
          >
            Get started free
          </Button>
        </View>
      </OutlinedCard>

      <Text variant="bodySmall" style={{ ...muted, textAlign: 'center' }}>
        No ads. No account needed to try. Written to NC standards, checked twice.
      </Text>
      <LegalLine testID="guest-legal" ids={{ terms: 'guest-terms', privacy: 'guest-privacy' }} />

      <NudgeSheet
        open={locked !== null}
        headline={locked ? `${locked.code} is free with an account` : ''}
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
    </Screen>
  );
}
