// Ported from apps/web/src/features/quest/fullscreen-frame.tsx @ 82397b8 (working tree): Question
// Quest outside the portal's frame -- a title, the status at the top (points, a count, a level) and
// Exit. Mobile: the routes are full-screen modals outside the tabs (no tab bar); the browser's
// Fullscreen button has no counterpart. The frame asks for the status bar to be hidden, which Android
// honours; iOS does not, as the app is configured: under the scene life cycle the app-wide call is
// ignored, and per-screen status bars need `UIViewControllerBasedStatusBarAppearance` on (a native
// change, the owner's call). Keeping the screen awake (the plan's wish) needs `expo-keep-awake` as the
// app's own dependency, which it is not (only Expo's, transitively): left out until it is added with
// `npx expo install`. Confirmations are said in the frame itself (quest-notice.tsx), and a sheet over
// Quest portals into the frame's own host (the welcome too), and a saved answer's "+1" flies over
// the frame (quest-burst.tsx).
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode, RefObject } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Button, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConnectivityBanner } from '@/components/connectivity';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { QuestBurstHost } from './quest-burst';
import { QuestNoticeHost } from './quest-notice';

/** The widest the content grows on a large iPad: the question and the answer stay readable. */
const MAX_WIDTH = 1100;

/** Back to the Quest hub: down to it when it is beneath, in place of this screen when it is not. */
export function exitQuest() {
  router.dismissTo('/quest');
}

export function QuestFrame({
  title,
  status,
  children,
  testID,
  scrollRef,
}: {
  title: string;
  /** Points, a count, a level: the line under the title. */
  status?: ReactNode;
  children: ReactNode;
  testID: string;
  /** The body's scroll view, for a screen that goes back to the top on its next item. */
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const side = { paddingLeft: space.lg + insets.left, paddingRight: space.lg + insets.right };
  // iOS insets the scroll view for the keyboard itself; Android (edge to edge) does not resize the
  // window, so the content gets room to scroll Submit above it.
  const keyboard = useKeyboardHeight();
  const keyboardRoom = Platform.OS === 'android' ? keyboard : 0;

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <QuestNoticeHost>
        {/* A saved answer's "+1" flies over the whole frame, from Submit up to the points. */}
        <QuestBurstHost>
          {/* Sheets drawn over Quest (the flag reason) portal into this frame, never into the app's
            root host, which a full-screen modal covers on iOS. */}
          <Portal.Host>
            <StatusBar hidden animated />
            <View
              style={{
                ...side,
                paddingTop: Math.max(insets.top, space.md) + space.xs,
                paddingBottom: space.md,
                gap: space.xs,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Text
                  variant="titleLarge"
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={{ flex: 1, fontWeight: '700' }}
                >
                  {title}
                </Text>
                <Button testID="quest-exit" mode="outlined" icon="close" compact onPress={exitQuest}>
                  Exit
                </Button>
              </View>
              {status ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    columnGap: space.lg,
                    rowGap: 2,
                  }}
                >
                  {status}
                </View>
              ) : null}
            </View>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                ...side,
                paddingTop: space.lg,
                paddingBottom: space.xxl + insets.bottom + keyboardRoom,
                gap: space.lg,
                width: '100%',
                maxWidth: MAX_WIDTH + 2 * space.lg,
                alignSelf: 'center',
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
            >
              <ConnectivityBanner />
              {children}
            </ScrollView>
          </Portal.Host>
        </QuestBurstHost>
      </QuestNoticeHost>
    </View>
  );
}

/** A status entry under the title: muted, or `strong` for the points. */
export function QuestStatus({
  children,
  testID,
  strong = false,
}: {
  children: ReactNode;
  testID?: string;
  strong?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Text
      testID={testID}
      variant="bodyMedium"
      style={
        strong
          ? { color: theme.colors.onSurface, fontWeight: '700' }
          : { color: theme.tokens.mutedForeground }
      }
    >
      {children}
    </Text>
  );
}
