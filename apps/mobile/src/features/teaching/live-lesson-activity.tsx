// The Live Activity's layout (iOS only; imported by live-surface-driver.ios.ts). The 'widget'
// function is turned into a string by babel-preset-expo and evaluated in the widget extension's own
// runtime: no hooks, no imports beyond @expo/ui/swift-ui, no module-scope values -- everything
// comes in through props. The contract (live-surface.ts): the title and a time the SYSTEM ticks
// from the server's start, nothing else. The clock stops at the server's limit while the app is in
// the background (`timerInterval`), so it never runs on past an auto-stop nobody has seen yet.
// Neutral system styling: the activity is drawn outside the app's theme, and no organization's
// colour or name goes on the Lock Screen.
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type LiveLessonProps = {
  title: string;
  startedAtMs: number;
  endsAtMs: number | null;
};

const LiveLessonActivity = (props: LiveLessonProps, environment: LiveActivityEnvironment) => {
  'widget';
  const start = new Date(props.startedAtMs);
  const end = props.endsAtMs ? new Date(props.endsAtMs) : null;
  const dim = environment.isLuminanceReduced;
  // A timer text claims the width of its longest value; the compact island gets a fixed one.
  const clock = (size: number, width?: number) => {
    const style = [
      font({ size, weight: 'semibold' }),
      monospacedDigit(),
      multilineTextAlignment('trailing'),
      ...(width ? [frame({ width, alignment: 'trailing' })] : []),
    ];
    return end ? (
      <Text timerInterval={{ lower: start, upper: end }} countsDown={false} modifiers={style} />
    ) : (
      <Text date={start} dateStyle="timer" modifiers={style} />
    );
  };
  const glyph = (size: number) => (
    <Image
      systemName="timer"
      size={size}
      modifiers={[foregroundStyle({ type: 'hierarchical', style: dim ? 'secondary' : 'primary' })]}
    />
  );
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 })]}>
        {glyph(22)}
        <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{props.title}</Text>
        <Spacer />
        {clock(22, 96)}
      </HStack>
    ),
    compactLeading: glyph(15),
    compactTrailing: clock(15, 56),
    minimal: glyph(14),
    expandedLeading: <VStack modifiers={[padding({ leading: 8, top: 8 })]}>{glyph(22)}</VStack>,
    expandedCenter: <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.title}</Text>,
    expandedTrailing: <VStack modifiers={[padding({ trailing: 8, top: 4 })]}>{clock(20, 88)}</VStack>,
  };
};

export default createLiveActivity<LiveLessonProps>('LiveLesson', LiveLessonActivity);
