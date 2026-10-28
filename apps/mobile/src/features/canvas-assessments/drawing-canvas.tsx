// Ported from apps/web/src/features/canvas-assessments/drawing-canvas.tsx @ 37bdad1 and its Phase 40
// change (`size`, `penWidth`, `variant: 'overlay'`); Phase 54 adds `underlay` (the Handwriting lab).
//
// A surface to write on: the student's page, or (Phase 40) a transparent layer of the tutor's red
// ink over a rendered PDF page. Mobile: react-native-svg draws, react-native-gesture-handler
// listens, and nothing native is added. The surface is an `Svg` whose viewBox is its own units (a
// 1000 x 800 page, or the PDF page's 612 x 792 points, whatever the screen), so strokes are kept,
// drawn and sent in those units and never depend on the device. Two layers keep a long page smooth:
//   - the finished strokes, one memoized Svg that re-renders only when a stroke is added or taken;
//   - the stroke being written, one AnimatedPath whose path is built on the UI thread from the
//     touch points (a worklet), so writing never waits on JavaScript or re-renders the page.
// Input is a manual gesture with every touch's id, so one finger, a stylus or a mouse each draw
// one stroke; once a stylus has written here, touches are ignored, which is palm rejection (and
// inside a scroll view, such a touch is handed back to it, so a finger scrolls while a pen marks).
// No feedback: it only draws.
import { CANVAS_LIMITS, type CanvasStroke } from '@tmi/shared';
import { memo, useCallback, useEffect, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useAppTheme } from '@/providers/theme-provider';
import { radius } from '@/theme/tokens';
import {
  finishStroke,
  PEN_WIDTH,
  strokeHits,
  strokePath,
  toCanvasUnits,
  type CanvasSize,
  type CanvasTool,
} from './drawing-model';

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** No stroke is being written. */
const NONE = -1;

/** The finished strokes: drawn again only when the list itself changes. */
const FinishedStrokes = memo(function FinishedStrokes({
  strokes,
  ink,
  viewBox,
}: {
  strokes: readonly CanvasStroke[];
  ink: string;
  viewBox: string;
}) {
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} style={{ position: 'absolute' }}>
      {strokes.map((stroke, index) => (
        <Path
          key={index}
          d={strokePath(stroke.points)}
          stroke={ink}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
});

export function DrawingCanvas({
  strokes,
  tool,
  width,
  height,
  onStroke,
  onErase,
  label,
  size = CANVAS_LIMITS,
  penWidth = PEN_WIDTH,
  variant = 'page',
  disabled = false,
  scrollRef,
  testID = 'assessment-canvas',
  underlay,
}: {
  strokes: readonly CanvasStroke[];
  tool: CanvasTool;
  /** The surface's size on screen, in points (the screen fits its shape: `fitCanvas`). */
  width: number;
  height: number;
  /** A finished stroke; the page decides whether it still fits, and says whether it kept it. */
  onStroke: (stroke: CanvasStroke) => boolean;
  /** The strokes the eraser touched, as the objects themselves (never indexes into a stale list). */
  onErase: (hit: CanvasStroke[]) => void;
  label: string;
  /** Its own units: the student's 1000 x 800 page, or (Phase 40) a PDF page in points. */
  size?: CanvasSize;
  penWidth?: number;
  /**
   * 'page': the student's paper, its own card. 'overlay' (Phase 40): a transparent layer of the
   * tutor's red ink over a rendered PDF page.
   */
  variant?: 'page' | 'overlay';
  /** Shown, but takes no touches (a review saved as reviewed). */
  disabled?: boolean;
  /** The scroll view it sits in: a touch on the surface marks it rather than scrolling. */
  scrollRef?: RefObject<unknown>;
  testID?: string;
  /**
   * Phase 54: drawn under the ink, filling the surface, and taking no touches (the Handwriting lab's
   * rules and the lines it found). The assessment and the review pass none.
   */
  underlay?: ReactNode;
}) {
  const theme = useAppTheme();
  const overlay = variant === 'overlay';
  // The student's ink is the page's text colour; the tutor's is red, over the page beneath.
  const ink = overlay ? theme.colors.error : theme.colors.onSurface;
  const viewBox = `0 0 ${size.width} ${size.height}`;

  // The UI thread's side: the stroke being written, whose touch it is, and what the surface knows.
  const live = useSharedValue<number[]>([]);
  const liveTouch = useSharedValue(NONE);
  const penSeen = useSharedValue(false);
  const erasing = useSharedValue(tool === 'eraser');
  const box = useSharedValue({ width, height, unitsWide: size.width, unitsHigh: size.height });

  useEffect(() => {
    erasing.set(tool === 'eraser');
  }, [tool, erasing]);
  useEffect(() => {
    box.set({ width, height, unitsWide: size.width, unitsHigh: size.height });
  }, [width, height, size.width, size.height, box]);

  // Once the finished layer holds the stroke (or the page changed under it), the live one goes --
  // unless a new stroke has started since. The gesture is rebuilt on each render (as the progress
  // chart's), so its callbacks always see this render's strokes and handlers.
  const clearLive = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      if (liveTouch.get() === NONE) live.set([]);
    });
  }, [live, liveTouch]);
  useEffect(() => clearLive(), [strokes, clearLive]);

  const finish = useCallback(
    (points: number[]) => {
      // A kept stroke's live copy goes once the page holds it (the effect above), so it never
      // blinks; one the page refused (it is full) goes now.
      const kept = points.length >= 2 && onStroke(finishStroke(points, penWidth, size));
      if (!kept) clearLive();
    },
    [onStroke, clearLive, penWidth, size],
  );
  // The strokes as this render knows them: a touch that arrives before the next render names
  // strokes already gone, which the screen's reducer simply finds no longer there.
  const eraseAt = useCallback(
    (x: number, y: number) => {
      const hit = strokeHits(strokes, x, y).map((index) => strokes[index]!);
      if (hit.length > 0) onErase(hit);
    },
    [strokes, onErase],
  );

  let gesture = Gesture.Manual()
    .enabled(!disabled)
    .onTouchesDown((event, manager) => {
      'worklet';
      if (event.pointerType === PointerType.STYLUS) penSeen.set(true);
      // Palm rejection: once a stylus has written here, a touch is a resting hand (or, in a scroll
      // view, a finger scrolling): it is let go.
      if (event.pointerType === PointerType.TOUCH && penSeen.get()) {
        if (liveTouch.get() === NONE) manager.fail();
        return;
      }
      if (liveTouch.get() !== NONE) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      manager.activate();
      liveTouch.set(touch.id);
      const b = box.get();
      const [x, y] = toCanvasUnits(touch.x, touch.y, b.width, b.height, b.unitsWide, b.unitsHigh);
      if (erasing.get()) {
        live.set([]);
        scheduleOnRN(eraseAt, x, y);
      } else {
        live.set([x, y]);
      }
    })
    .onTouchesMove((event) => {
      'worklet';
      const id = liveTouch.get();
      if (id === NONE) return;
      const b = box.get();
      for (const touch of event.changedTouches) {
        if (touch.id !== id) continue;
        const [x, y] = toCanvasUnits(touch.x, touch.y, b.width, b.height, b.unitsWide, b.unitsHigh);
        if (erasing.get()) {
          scheduleOnRN(eraseAt, x, y);
        } else {
          live.modify((points) => {
            'worklet';
            points.push(x, y);
            return points;
          });
        }
      }
    })
    .onTouchesUp((event, manager) => {
      'worklet';
      const id = liveTouch.get();
      if (id !== NONE && event.changedTouches.some((touch) => touch.id === id)) {
        liveTouch.set(NONE);
        if (!erasing.get()) scheduleOnRN(finish, live.get().slice());
      }
      if (event.numberOfTouches === 0) manager.end();
    })
    .onTouchesCancelled((event, manager) => {
      'worklet';
      // As the web's pointercancel: what was written stays.
      const id = liveTouch.get();
      if (id !== NONE) {
        liveTouch.set(NONE);
        if (!erasing.get()) scheduleOnRN(finish, live.get().slice());
      }
      manager.end();
    });
  // Inside a scroll view, the scroll waits for this gesture: a touch on the surface marks it.
  if (scrollRef) gesture = gesture.blocksExternalGesture(scrollRef as never);

  const liveProps = useAnimatedProps(() => ({ d: strokePath(live.get()) }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        collapsable={false}
        style={
          overlay
            ? { position: 'absolute', left: 0, top: 0, width, height }
            : {
                width,
                height,
                alignSelf: 'center',
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
                overflow: 'hidden',
              }
        }
      >
        {underlay ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {underlay}
          </View>
        ) : null}
        <FinishedStrokes strokes={strokes} ink={ink} viewBox={viewBox} />
        <Svg width="100%" height="100%" viewBox={viewBox} style={{ position: 'absolute' }}>
          <AnimatedPath
            animatedProps={liveProps}
            stroke={ink}
            strokeWidth={penWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    </GestureDetector>
  );
}
