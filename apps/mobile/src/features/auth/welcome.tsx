import { Linking, Pressable, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { AIM_AMBER, AIM_AMBER_TEXT, GOOGLE_G } from '@/theme/brand-art';
import { radius, space } from '@/theme/tokens';

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

/**
 * The way in for someone who signs in with Google (the production app): the platform's name, its
 * tagline, what it is for, the mark in the middle of the screen, and one button. No card, no
 * server, nothing a developer needs.
 */
export function Welcome({ busy, onSignIn }: { busy: boolean; onSignIn: () => void }) {
  const brand = useBrand();
  const theme = useAppTheme();
  // The name in two colours, "Aim" in amber: its first syllable is the platform's whole idea.
  const lead = brand.name.slice(0, 3);
  const rest = brand.name.slice(3);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', gap: space.xs, paddingTop: space.lg }}>
        <Text variant="displaySmall" accessibilityRole="header" style={{ fontWeight: '800' }}>
          <Text style={{ color: theme.dark ? AIM_AMBER : AIM_AMBER_TEXT, fontWeight: '800' }}>{lead}</Text>
          <Text style={{ color: theme.tokens.primary, fontWeight: '800' }}>{rest}</Text>
        </Text>
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.onSurface,
            fontWeight: '300',
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          {brand.tagline}
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600', textAlign: 'center' }}
        >
          Plans, lessons and progress tracking
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <HaloMark />
      </View>

      <View style={{ alignItems: 'center', gap: space.sm, paddingBottom: space.xl }}>
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
            backgroundColor: theme.tokens.primary,
            opacity: pressed || busy ? 0.7 : 1,
          })}
        >
          {busy ? <ActivityIndicator size={20} color={theme.tokens.primaryForeground} /> : <GoogleG />}
          <Text variant="titleMedium" style={{ color: theme.tokens.primaryForeground, fontWeight: '600' }}>
            Sign in with Google
          </Text>
        </Pressable>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Access granted by admin
        </Text>
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
