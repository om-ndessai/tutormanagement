import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { AIM_AMBER, AIM_AMBER_INK, AIM_AMBER_TEXT, GOOGLE_G } from '@/theme/brand-art';
import { radius, space } from '@/theme/tokens';

import { LegalLine } from './legal-links';
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

/** Google's "G", in its own colours, on the white plate its branding asks for on a coloured button. */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-6 -6 60 60">
      <Circle cx={24} cy={24} r={30} fill={GOOGLE_G.plate} />
      <Path
        fill={GOOGLE_G.red}
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"
      />
      <Path
        fill={GOOGLE_G.blue}
        d="M46.9 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.9c-.6 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 7.4-17.4z"
      />
      <Path
        fill={GOOGLE_G.yellow}
        d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.700s.3-3.200.8-4.700l-7.900-6.100C1 16.400 0 20.100 0 24s1 7.600 2.600 10.800l7.900-6.100z"
      />
      <Path
        fill={GOOGLE_G.green}
        d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.300-5.700c-2.100 1.400-4.900 2.300-8.600 2.300-6.300 0-11.600-4.200-13.500-10l-7.900 6.100C6.500 42.600 14.600 48 24 48z"
      />
    </Svg>
  );
}

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
        <Pressable
          testID="sign-in-google"
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={onSignIn}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            minHeight: 48,
            paddingHorizontal: space.lg,
            borderRadius: radius.pill,
            // Amber, so the button does not repeat the slate tile above it.
            backgroundColor: AIM_AMBER,
            opacity: pressed || busy ? 0.7 : 1,
          })}
        >
          {busy ? <ActivityIndicator size={20} color={AIM_AMBER_INK} /> : <GoogleG />}
          <Text variant="titleMedium" style={{ color: AIM_AMBER_INK, fontWeight: '600' }}>
            Sign in with Google
          </Text>
        </Pressable>
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
