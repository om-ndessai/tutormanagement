// Swipe actions and a long-press menu for a list row (ux-audit F-8, immersive-design §8).
//
// The same verbs three ways: a swipe reveals them at the row's trailing edge, a long press opens
// them as a menu, and the row's own visible buttons stay — they are the path for a screen reader
// and for anyone who cannot swipe or hold (WCAG 2.5.1). Nothing acts on release alone: a swipe
// only reveals, and the caller decides whether a verb asks first (a hard delete) or runs with Undo
// (a soft delete, a cancelled date). A row given no actions is just the row: no swipe, no menu, so
// nothing is offered that the server would refuse.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type GestureResponderEvent,
} from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Icon, Menu, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';

export interface RowAction {
  /** Stable verb: `edit`, `delete`, `cancel`… — the menu item is `row-action-<key>`. */
  key: string;
  label: string;
  /** Material Community icon name. */
  icon: string;
  onPress: () => void;
  /** Drawn in the error colour, last. */
  destructive?: boolean;
}

const ACTION_WIDTH = 80;
const MENU_GUTTER = 16;

/** A long press, with where it happened (the menu opens there). */
export type OpenMenu = (event: GestureResponderEvent) => void;

/**
 * The `accessibilityActions` for a row that is ONE accessible element (the session card): each
 * verb by its label, plus `activate` when the row opens something.
 */
export function rowActionsA11y(actions: RowAction[], onActivate?: () => void) {
  const accessibilityActions: AccessibilityActionInfo[] = [
    ...(onActivate ? [{ name: 'activate' }] : []),
    ...actions.map((action) => ({ name: action.key, label: action.label })),
  ];
  return {
    accessibilityActions,
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === 'activate') {
        onActivate?.();
        return;
      }
      actions.find((action) => action.key === name)?.onPress();
    },
  };
}

export function SwipeRow({
  actions,
  testID,
  background,
  children,
}: {
  actions: RowAction[];
  /**
   * The row's backdrop while it slides, for a row that draws none of its own (a card does):
   * the actions sit behind the row and must not show through it.
   */
  background?: string;
  /** The row's own testID; the swipeable is `swipe-row-<testID>`. */
  testID: string;
  /**
   * The row. A row with its own Pressable takes the render function and wires
   * `onLongPress={openMenu}` itself (a parent Pressable never hears a press its child took);
   * anything else is wrapped in one that does.
   */
  children: ReactNode | ((helpers: { openMenu: OpenMenu }) => ReactNode);
}) {
  const theme = useAppTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);

  const openMenu = useCallback<OpenMenu>((event) => {
    haptics.impact();
    // At the press's height, from the screen's left gutter: anchored at the finger, Paper flips a
    // menu that would overflow to the right and can push it off the left edge instead.
    setAnchor({ x: MENU_GUTTER, y: event.nativeEvent.pageY });
  }, []);

  if (actions.length === 0) {
    return <>{typeof children === 'function' ? children({ openMenu: () => undefined }) : children}</>;
  }

  const ordered = [...actions.filter((a) => !a.destructive), ...actions.filter((a) => a.destructive)];

  const run = (action: RowAction) => () => {
    swipeable.current?.close();
    setAnchor(null);
    action.onPress();
  };

  const row =
    typeof children === 'function' ? (
      children({ openMenu })
    ) : (
      <Pressable accessible={false} onLongPress={openMenu} delayLongPress={400}>
        {children}
      </Pressable>
    );

  return (
    <View>
      <ReanimatedSwipeable
        ref={swipeable}
        testID={`swipe-row-${testID}`}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        // A vertical scroll wins over a sideways drag that has not yet committed.
        dragOffsetFromRightEdge={16}
        onSwipeableWillOpen={() => haptics.selection()}
        onSwipeableOpen={() => setOpen(true)}
        onSwipeableClose={() => setOpen(false)}
        childrenContainerStyle={background ? { backgroundColor: background } : undefined}
        renderRightActions={() => (
          // Hidden from screen readers until a swipe has opened them: the row's own buttons (or
          // its accessibility actions) are the way to the same verbs, and these sit off-screen.
          <View
            style={{ flexDirection: 'row' }}
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          >
            {ordered.map((action) => {
              const fill = action.destructive ? theme.colors.error : theme.colors.secondaryContainer;
              const ink = action.destructive ? theme.colors.onError : theme.colors.onSecondaryContainer;
              return (
                <Pressable
                  key={action.key}
                  testID={`row-swipe-${action.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={run(action)}
                  style={({ pressed }) => ({
                    width: ACTION_WIDTH,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    backgroundColor: fill,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Icon source={action.icon} size={22} color={ink} />
                  <Text variant="labelSmall" style={{ color: ink, textAlign: 'center' }} numberOfLines={2}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      >
        {row}
      </ReanimatedSwipeable>
      <Menu visible={anchor !== null} onDismiss={() => setAnchor(null)} anchor={anchor ?? { x: 0, y: 0 }}>
        {ordered.map((action) => (
          <Menu.Item
            key={action.key}
            testID={`row-action-${action.key}`}
            leadingIcon={action.icon}
            title={action.label}
            titleStyle={action.destructive ? { color: theme.colors.error } : undefined}
            onPress={run(action)}
          />
        ))}
      </Menu>
    </View>
  );
}
