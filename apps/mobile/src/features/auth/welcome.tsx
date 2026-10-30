import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { AIM_AMBER, AIM_AMBER_TEXT } from '@/theme/brand-art';
import { space } from '@/theme/tokens';

import { LegalLine } from './legal-links';
import { ProviderSignInButton } from './provider-buttons';
import {
  WORDMARK_AIM,
  WORDMARK_ARROW_HEAD,
  WORDMARK_ARROW_SHAFT,
  WORDMARK_ARROW_STROKE,
  WORDMARK_ASPECT,
  WORDMARK_TRUE,
  WORDMARK_VIEWBOX,
} from './wordmark-paths.generated';

/** Where "Contact us" writes to: the developer's address, by the owner's choice (2026-10-13). */
const CONTACT_URL = 'mailto:om.ndessai@gmail.com';

/** The platform's mark on its tile, with the amber centre the app icon has, inside a soft glow. */
function HaloMark({ size = 132 }: { size?: number }) {
  const theme = useAppTheme();
  const halo = size * 1.75;
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={halo} height={halo} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="aim-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={AIM_AMBER} stopOpacity={0.32} />
            <Stop offset="68%" stopColor={AIM_AMBER} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#aim-halo)" />
      </Svg>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Rect width={48} height={48} rx={11} fill={theme.tokens.primary} />
        <G
          stroke={theme.tokens.primaryForeground}
          strokeWidth={4.2}
          strokeLinecap="round"
          fill="none"
          transform="translate(24 24) scale(1.1) translate(-23.65 -24.15)"
        >
          <Circle cx={22.5} cy={24.4} r={9.4} />
          <Path d="M34.2 13.9v20.5" />
          <Circle cx={22.5} cy={24.4} r={3.4} fill={AIM_AMBER} stroke="none" />
        </G>
      </Svg>
    </View>
  );
}

/** The platform's name as drawn art: "Aim" in amber, "True" in slate, the T's arm flying on as an arrow. */
function Wordmark({ width = 214 }: { width?: number }) {
  const theme = useAppTheme();
  const amber = theme.dark ? AIM_AMBER : AIM_AMBER_TEXT;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="AimTrue" testID="sign-in-wordmark">
      <Svg width={width} height={width / WORDMARK_ASPECT} viewBox={WORDMARK_VIEWBOX}>
        <Path d={WORDMARK_AIM} fill={amber} />
        <Path d={WORDMARK_TRUE} fill={theme.tokens.primary} />
        <Path d={WORDMARK_ARROW_SHAFT} fill={amber} />
        <Path
          d={WORDMARK_ARROW_HEAD}
          fill="none"
          stroke={amber}
          strokeWidth={WORDMARK_ARROW_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** The four things the platform does, in order, joined by small amber dots. */
const STEPS = ['Goals', 'Assess', 'Plan', 'Track'] as const;

/**
 * The way in for someone who signs in with Google (the production app): the mark, the platform's
 * name, its promise and what it does, together in the middle of the screen, then one button. No
 * card, no server, nothing a developer needs. An organization's own address shows its name and
 * tagline as text instead of the platform's drawn name.
 */
export function Welcome({
  busy,
  onSignIn,
  google = true,
  others,
}: {
  busy: boolean;
  onSignIn: () => void;
  /** Phase 55: whether Google's button shows (a server may offer only others). */
  google?: boolean;
  /** Phase 55: the other providers' buttons, below Google's. */
  others?: ReactNode;
}) {
  const brand = useBrand();
  const theme = useAppTheme();
  const platform = brand.slug === null;
  const amber = theme.dark ? AIM_AMBER : AIM_AMBER_TEXT;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          paddingTop: space.xl,
        }}
      >
        <HaloMark size={96} />
        {platform ? (
          <Wordmark />
        ) : (
          <Text
            variant="displaySmall"
            accessibilityRole="header"
            style={{ color: theme.tokens.primary, textAlign: 'center' }}
          >
            {brand.name}
          </Text>
        )}
        <Text
          variant="titleLarge"
          style={{
            marginTop: space.xs,
            color: theme.colors.onSurface,
            fontFamily: 'Nunito_600SemiBold_Italic',
            textAlign: 'center',
          }}
        >
          {platform ? 'Set Goals. Aim True' : brand.tagline}
        </Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          accessible
          accessibilityLabel={STEPS.join(', ')}
          testID="sign-in-steps"
        >
          {STEPS.map((step, index) => (
            <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {index > 0 ? (
                <Text variant="bodyMedium" style={{ color: amber }}>
                  •
                </Text>
              ) : null}
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.xl }}>
        {google ? (
          <ProviderSignInButton provider="google" label="Google" testID="sign-in-google" busy={busy} onPress={onSignIn} />
        ) : null}
        {others}
        {/* Phase 51: anyone may sign in now; continuing accepts the terms. */}
        <LegalLine testID="sign-in-legal" ids={{ terms: 'sign-in-terms', privacy: 'sign-in-privacy' }} />
      </View>

      <Pressable
        testID="sign-in-contact"
        accessibilityRole="link"
        hitSlop={12}
        onPress={() => void Linking.openURL(CONTACT_URL).catch(() => undefined)}
        style={{ alignSelf: 'center' }}
      >
        <Text variant="labelSmall" style={{ color: theme.tokens.primary, textDecorationLine: 'underline' }}>
          Contact us
        </Text>
      </Pressable>
    </View>
  );
}
