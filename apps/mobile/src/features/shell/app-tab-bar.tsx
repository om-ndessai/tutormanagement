// The tab bar, drawn by the app (UI upgrades U2; revised 2026-10-15 to the owner's option B). The
// system's bar (NativeTabs) holds at most five items and has no room for a "+" of our own, so the
// bar is ours: Home and Sessions, the "+", Progress and More -- two either side, so the "+" sits in
// the middle. For a reader with something to create, the bar's top edge rises in a hump that holds
// an amber "+"; anyone else gets four evenly spaced tabs on a flat bar.
//
// Schedule left the bar and lives inside Sessions (a Lessons | Schedule switch heads both). Its
// route and stack are unchanged, so every link to it still works; the bar leaves it out and
// lights Sessions while it is in front (`TAB_HOME`).
//
// The flat bar is a fixed height (`TAB_BAR_ABOVE_INSET`); the hump rises `TAB_BAR_HUMP` above
// it, which the live banner, the toast, the reminder sheet and the screens' bottom padding clear.
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';

import { featureOn, type FeatureState } from '@tmi/shared';

import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { AIM_AMBER, AIM_AMBER_INK } from '@/theme/brand-art';
import { radius } from '@/theme/tokens';
import { useTourTarget } from '@/features/onboarding/tour-targets';
import { TAB_BAR_ABOVE_INSET, TAB_BAR_HUMP } from '@/features/teaching/live-session';
import { CreateSheet } from './create-sheet';
import {
  CREATE_DISC,
  DISC_CENTRE_BELOW_EDGE,
  HUMP_HALF_WIDTH,
  humpEdgePath,
  humpFillPath,
  useTabBarHump,
} from './tab-bar-hump';

/**
 * The tabs the bar shows, in its order, with their label and icon (Material Community Icons):
 * outlined at rest, filled when chosen. A route of the tabs layout that is not here is not in the
 * bar.
 */
export const TAB_ITEMS: Record<string, { label: string; icon: string; focusedIcon: string }> = {
  dashboard: { label: 'Home', icon: 'home-outline', focusedIcon: 'home' },
  sessions: { label: 'Sessions', icon: 'book-open-outline', focusedIcon: 'book-open-variant' },
  progress: { label: 'Progress', icon: 'chart-line', focusedIcon: 'chart-line' },
  more: { label: 'More', icon: 'dots-horizontal-circle-outline', focusedIcon: 'dots-horizontal-circle' },
};

/** A route that lives inside another tab: while it is in front, that tab shows as chosen. */
export const TAB_HOME: Record<string, string> = { schedule: 'sessions' };

export type TabName = 'dashboard' | 'sessions' | 'progress' | 'more';

/**
 * Phase 50: the tabs the bar shows here. Sessions and Progress are Tutoring's, so a space without it
 * has Home and More (Assessment and Quest stay under More: in an Assessment-only space Home is the
 * Assessment home). The tabs layout still declares every route, for deep links; the gates answer them.
 */
export function visibleTabs(organization: Partial<FeatureState> | null | undefined): TabName[] {
  return featureOn(organization, 'tutoring') ? ['dashboard', 'sessions', 'progress', 'more'] : ['dashboard', 'more'];
}

/** The create button goes after this many tabs: the middle (2 of 4, between Sessions and Progress; 1 of 2). */
export function createSlot(count: number): number {
  return Math.floor(count / 2);
}

const BAR_HEIGHT = Platform.OS === 'android' ? TAB_BAR_ABOVE_INSET.android : TAB_BAR_ABOVE_INSET.ios;
const ANDROID = Platform.OS === 'android';

/** The soft shadow above the bar's edge: wide and faint to narrow and less faint (a drawn blur). */
const EDGE_SHADOW = [
  { width: 10, opacity: 0.025 },
  { width: 6, opacity: 0.035 },
  { width: 3, opacity: 0.05 },
] as const;

export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useAppTheme();
  const sheet = useRef<BottomSheetModal>(null);
  const showCreate = useTabBarHump();
  const { organization } = useAuth();
  const shown: readonly string[] = visibleTabs(organization);
  const [width, setWidth] = useState(0);

  const focusedName = state.routes[state.index]?.name ?? '';
  const chosen = TAB_HOME[focusedName] ?? focusedName;

  const tabs = state.routes
    .map((route, routeIndex) => ({ route, routeIndex }))
    .filter(({ route }) => shown.includes(route.name))
    .map(({ route, routeIndex }, index) => {
      const item = TAB_ITEMS[route.name];
      const selected = route.name === chosen;
      // In front itself, not standing in for a route inside it (Schedule for Sessions).
      const inFront = state.index === routeIndex;
      const label = item?.label ?? descriptors[route.key]?.options.title ?? route.name;
      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        // A second tap on the open tab is left to its stack, which goes back to its first page.
        // Sessions tapped from Schedule goes back to Lessons.
        if (!inFront && !event.defaultPrevented) {
          haptics.selection();
          navigation.navigate(route.name, route.params);
        }
      };
      return (
        <TabButton
          key={route.key}
          name={route.name}
          index={index}
          label={label}
          icon={selected ? (item?.focusedIcon ?? 'circle') : (item?.icon ?? 'circle-outline')}
          focused={selected}
          onPress={onPress}
        />
      );
    });

  if (showCreate) {
    tabs.splice(
      createSlot(tabs.length),
      0,
      <CreateButton
        key="create"
        onPress={() => {
          haptics.impact();
          sheet.current?.present();
        }}
      />,
    );
  }

  const height = BAR_HEIGHT + insets.bottom;

  return (
    <>
      <View
        testID="tab-bar"
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          setWidth((current) => (current === next ? current : next));
        }}
        style={
          showCreate
            ? { height }
            : {
                height,
                backgroundColor: theme.colors.surface,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.outlineVariant,
              }
        }
      >
        {showCreate && width > 0 ? (
          // The bar itself, hump and all: drawn from the bar's real width so the hump stays
          // centred on every phone. It takes no touches; the "+" covers the hump.
          <Svg
            testID="tab-bar-hump"
            pointerEvents="none"
            width={width}
            height={height + TAB_BAR_HUMP}
            style={{ position: 'absolute', left: 0, top: -TAB_BAR_HUMP }}
          >
            {/* A shadow does not read on a dark ground: the hairline carries the edge there. */}
            {(theme.dark ? [] : EDGE_SHADOW).map((shade) => (
              <Path
                key={shade.width}
                d={humpEdgePath(width)}
                fill="none"
                stroke={theme.colors.shadow}
                strokeOpacity={shade.opacity}
                strokeWidth={shade.width}
              />
            ))}
            <Path d={humpFillPath(width, height + TAB_BAR_HUMP)} fill={theme.colors.surface} />
            <Path
              d={humpEdgePath(width)}
              fill="none"
              stroke={theme.colors.outlineVariant}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          </Svg>
        ) : null}
        <View
          accessibilityRole="tablist"
          style={{
            flex: 1,
            flexDirection: 'row',
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          {tabs}
        </View>
      </View>
      {showCreate ? <CreateSheet sheetRef={sheet} /> : null}
    </>
  );
}

const TabButton = memo(function TabButton({
  name,
  index,
  label,
  icon,
  focused,
  onPress,
}: {
  name: string;
  index: number;
  label: string;
  icon: string;
  focused: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  // The feature tour lights the real tab (`tab-<index>`, its place in the bar, the "+" not
  // counted).
  const tourRef = useTourTarget(`tab-${index}`);
  const color = focused ? theme.colors.primary : theme.colors.onSurfaceVariant;
  return (
    <Pressable
      ref={tourRef}
      testID={`tab-${name}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: ANDROID ? 4 : 2 }}
    >
      <View
        style={{
          // Material 3's active indicator behind the icon on Android; iOS tints alone.
          width: ANDROID ? 64 : undefined,
          height: ANDROID ? 32 : undefined,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ANDROID && focused ? theme.colors.primaryContainer : 'transparent',
        }}
      >
        <Icon
          source={icon}
          size={24}
          color={ANDROID && focused ? theme.colors.onPrimaryContainer : color}
        />
      </View>
      <Text
        variant="labelMedium"
        numberOfLines={1}
        // The bar is a fixed height; the label grows a little, then stops (the system bar's rule).
        maxFontSizeMultiplier={1.3}
        style={{ color, fontWeight: focused ? '600' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

/**
 * The "+": an amber disc centred in the hump. The whole hump is its target -- a tap there would
 * otherwise fall through to whatever the hump hides -- so it reaches `TAB_BAR_HUMP` above the bar.
 */
function CreateButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ width: HUMP_HALF_WIDTH * 2 }}>
      <Pressable
        testID="create-button"
        accessibilityRole="button"
        accessibilityLabel="Create"
        accessibilityHint="Record, start or schedule a lesson, and more"
        onPress={onPress}
        style={{
          position: 'absolute',
          top: -TAB_BAR_HUMP,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
        }}
      >
        {({ pressed }) => (
          <View
            style={{
              marginTop: TAB_BAR_HUMP + DISC_CENTRE_BELOW_EDGE - CREATE_DISC / 2,
              width: CREATE_DISC,
              height: CREATE_DISC,
              borderRadius: CREATE_DISC / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: AIM_AMBER,
              // A soft amber glow beneath it (Android: the elevation's shadow, tinted on API 28+).
              shadowColor: AIM_AMBER,
              shadowOpacity: 0.45,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            }}
          >
            <Icon source="plus" size={30} color={AIM_AMBER_INK} />
          </View>
        )}
      </Pressable>
    </View>
  );
}
