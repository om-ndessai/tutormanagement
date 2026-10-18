// Ported from apps/web/src/features/canvas-assessments/drawing-canvas.tsx @ 22b9701.
//
// A page to write on. Mobile: react-native-svg draws, react-native-gesture-handler listens, and
// nothing native is added. The page is an `Svg` whose viewBox is the canvas's own units (a 1000 x
// 800 page, whatever the screen), so strokes are kept, drawn and sent in those units and the PDF
// never depends on the device. Two layers keep a long page smooth:
//   - the finished strokes, one memoized Svg that re-renders only when a stroke is added or taken;
//   - the stroke being written, one AnimatedPath whose path is built on the UI thread from the
//     touch points (a worklet), so writing never waits on JavaScript or re-renders the page.
// Input is a manual gesture with every touch's id, so one finger, a stylus or a mouse each draw
// one stroke; once a stylus has written here, touches are ignored, which is palm rejection. No
// feedback: it only draws.
import type { CanvasStroke } from '@tmi/shared';
import { memo, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useAppTheme } from '@/providers/theme-provider';
import { radius } from '@/theme/tokens';
import { finishStroke, PEN_WIDTH, strokeHits, strokePath, toCanvasUnits, type CanvasTool } from './drawing-model';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const VIEW_BOX = '0 0 1000 800';
/** No stroke is being written. */
const NONE = -1;

/** The finished strokes: drawn again only when the list itself changes. */
const FinishedStrokes = memo(function FinishedStrokes({
  strokes,
  ink,
}: {
  strokes: readonly CanvasStroke[];
  ink: string;
}) {
  return (
    <Svg width="100%" height="100%" viewBox={VIEW_BOX} style={{ position: 'absolute' }}>
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
}: {
  strokes: readonly CanvasStroke[];
  tool: CanvasTool;
  /** The page's size on screen, in points (5:4: the screen fits it, `fitCanvas`). */
  width: number;
  height: number;
  /** A finished stroke; the page decides whether it still fits, and says whether it kept it. */
  onStroke: (stroke: CanvasStroke) => boolean;
  /** The strokes the eraser touched, as the objects themselves (never indexes into a stale list). */
  onErase: (hit: CanvasStroke[]) => void;
  label: string;
}) {
  const theme = useAppTheme();
  const ink = theme.colors.onSurface;

  // The UI thread's side: the stroke being written, whose touch it is, and what the page knows.
  const live = useSharedValue<number[]>([]);
  const liveTouch = useSharedValue(NONE);
  const penSeen = useSharedValue(false);
  const erasing = useSharedValue(tool === 'eraser');
  const size = useSharedValue({ width, height });

  useEffect(() => {
    erasing.set(tool === 'eraser');
  }, [tool, erasing]);
  useEffect(() => {
    size.set({ width, height });
  }, [width, height, size]);

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
      const kept = points.length >= 2 && onStroke(finishStroke(points));
      if (!kept) clearLive();
    },
    [onStroke, clearLive],
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

  const gesture = Gesture.Manual()
    .onTouchesDown((event, manager) => {
      'worklet';
      if (event.pointerType === PointerType.STYLUS) penSeen.set(true);
      // Palm rejection: once a stylus has written here, a touch is a resting hand.
      if (event.pointerType === PointerType.TOUCH && penSeen.get()) return;
      if (liveTouch.get() !== NONE) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      manager.activate();
      liveTouch.set(touch.id);
      const { width: w, height: h } = size.get();
      const [x, y] = toCanvasUnits(touch.x, touch.y, w, h);
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
      const { width: w, height: h } = size.get();
      for (const touch of event.changedTouches) {
        if (touch.id !== id) continue;
        const [x, y] = toCanvasUnits(touch.x, touch.y, w, h);
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

  const liveProps = useAnimatedProps(() => ({ d: strokePath(live.get()) }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID="assessment-canvas"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        collapsable={false}
        style={{
          width,
          height,
          alignSelf: 'center',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
        }}
      >
        <FinishedStrokes strokes={strokes} ink={ink} />
        <Svg width="100%" height="100%" viewBox={VIEW_BOX} style={{ position: 'absolute' }}>
          <AnimatedPath
            animatedProps={liveProps}
            stroke={ink}
            strokeWidth={PEN_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    </GestureDetector>
  );
}
