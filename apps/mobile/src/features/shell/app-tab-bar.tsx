// The tab bar, drawn by the app (UI upgrades U2). The system's bar (NativeTabs) holds at most five
// items -- react-native-screens refuses a sixth on Android and iOS folds it into a "More" of its
// own -- and the create button sits in the middle of the bar, beside the four tabs and More. So the
// bar is ours: the same five destinations in the same order, and a "+" between Schedule and
// Progress for anyone with something to create. It is a fixed height (`TAB_BAR_ABOVE_INSET`), so
// the live banner, toasts and the reminder sheet clear it exactly.
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius } from '@/theme/tokens';
import { useTourTarget } from '@/features/onboarding/tour-targets';
import { TAB_BAR_ABOVE_INSET } from '@/features/teaching/live-session';
import { hasCreateActions } from './create-actions';
import { CreateSheet } from './create-sheet';

/** Each tab's label and icon (Material Community Icons): outlined at rest, filled when chosen. */
export const TAB_ITEMS: Record<string, { label: string; icon: string; focusedIcon: string }> = {
  dashboard: { label: 'Home', icon: 'home-outline', focusedIcon: 'home' },
  sessions: { label: 'Sessions', icon: 'book-open-outline', focusedIcon: 'book-open-variant' },
  schedule: { label: 'Schedule', icon: 'calendar-month-outline', focusedIcon: 'calendar-month' },
  progress: { label: 'Progress', icon: 'chart-line', focusedIcon: 'chart-line' },
  more: { label: 'More', icon: 'dots-horizontal-circle-outline', focusedIcon: 'dots-horizontal-circle' },
};

/** The create button goes after this many tabs: between Schedule and Progress. */
export const CREATE_SLOT = 3;

const BAR_HEIGHT = Platform.OS === 'android' ? TAB_BAR_ABOVE_INSET.android : TAB_BAR_ABOVE_INSET.ios;
const ANDROID = Platform.OS === 'android';
/** The create button's disc: a full touch target on both platforms. */
const CREATE_DISC = 48;

export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const sheet = useRef<BottomSheetModal>(null);
  const showCreate = hasCreateActions(user?.roles);

  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const item = TAB_ITEMS[route.name];
    const label = item?.label ?? descriptors[route.key]?.options.title ?? route.name;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      // A second tap on the open tab is left to its stack, which goes back to its first page.
      if (!focused && !event.defaultPrevented) {
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
        icon={focused ? (item?.focusedIcon ?? 'circle') : (item?.icon ?? 'circle-outline')}
        focused={focused}
        onPress={onPress}
      />
    );
  });

  if (showCreate) {
    tabs.splice(
      CREATE_SLOT,
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

  return (
    <>
      <View
        testID="tab-bar"
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.outlineVariant,
        }}
      >
        {tabs}
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
  // The feature tour lights the real tab (`tab-<index>`, the tour's own numbering).
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

function CreateButton({ onPress }: { onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID="create-button"
      accessibilityRole="button"
      accessibilityLabel="Create"
      accessibilityHint="Record, start or schedule a lesson, and more"
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: CREATE_DISC,
            height: CREATE_DISC,
            borderRadius: CREATE_DISC / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          }}
        >
          <Icon source="plus" size={30} color={theme.colors.onPrimary} />
        </View>
      )}
    </Pressable>
  );
}
