// Field errors that come into view (ux-audit F-22). A failed save on a long sheet used to leave its
// messages below the fold (the people/edit failure in F-7), or above it. Every field error is a
// `FieldError`; it tells the screen it appeared, and the screen scrolls the topmost one into view
// (once per failed save, still under reduce motion) and announces it to a screen reader.
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import { HelperText } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';

interface Anchors {
  add: (view: RefObject<View | null>, message: string) => () => void;
}

const FieldErrorContext = createContext<Anchors | null>(null);

/** Room left above an error scrolled into view, so its field shows too. */
const ABOVE = 96;

/**
 * Provided by `Screen` around its scroll view. Errors arriving in the same frame are gathered,
 * then the topmost is scrolled to when it is outside the visible part of the screen.
 */
export function useFieldErrorAnchors(scroll: RefObject<ScrollView | null>, enabled: boolean) {
  const reduced = useReducedMotion();
  const offset = useRef(0);
  const pending = useRef(new Map<RefObject<View | null>, string>());
  const frame = useRef<number | null>(null);

  const reveal = useCallback(() => {
    frame.current = null;
    const anchors = [...pending.current.entries()];
    pending.current.clear();
    const list = scroll.current;
    const host = list?.getNativeScrollRef();
    if (!list || !host || anchors.length === 0) return;
    // Positions on screen: the scroll view's, then each error's; the topmost error wins.
    host.measureInWindow((_lx, listY, _lw, listHeight) => {
      let top: { y: number; message: string } | null = null;
      let pendingCount = anchors.length;
      const done = () => {
        pendingCount -= 1;
        if (pendingCount > 0 || !top) return;
        const within = top.y - listY;
        const visible = within >= 0 && within <= listHeight - 48;
        if (!visible) {
          list.scrollTo({ y: Math.max(0, offset.current + within - ABOVE), animated: !reduced });
        }
        AccessibilityInfo.announceForAccessibility(top.message);
      };
      for (const [ref, message] of anchors) {
        const node = ref.current;
        if (!node) {
          done();
          continue;
        }
        node.measureInWindow((_x, y) => {
          if (!top || y < top.y) top = { y, message };
          done();
        });
      }
    });
  }, [reduced, scroll]);

  const anchors = useMemo<Anchors>(
    () => ({
      add: (view, message) => {
        if (enabled) {
          pending.current.set(view, message);
          if (frame.current === null) frame.current = requestAnimationFrame(reveal);
        }
        return () => {
          pending.current.delete(view);
        };
      },
    }),
    [enabled, reveal],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return {
    anchors,
    onScroll: (y: number) => {
      offset.current = y;
    },
  };
}

export function FieldErrorProvider({ value, children }: { value: Anchors; children: ReactNode }) {
  return <FieldErrorContext value={value}>{children}</FieldErrorContext>;
}

/** A field's error message (Paper's error HelperText) that brings itself into view when it appears. */
export function FieldError({
  children,
  testID,
  padding = 'none',
}: {
  children: ReactNode;
  testID?: string;
  padding?: 'none' | 'normal';
}) {
  const anchors = use(FieldErrorContext);
  const ref = useRef<View>(null);
  const message = typeof children === 'string' ? children : '';
  useEffect(() => {
    if (!anchors || !message) return;
    return anchors.add(ref, message);
  }, [anchors, message]);
  return (
    <View ref={ref} collapsable={false}>
      <HelperText type="error" padding={padding} testID={testID}>
        {children}
      </HelperText>
    </View>
  );
}
