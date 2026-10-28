// Ported from apps/web/src/features/handwriting-lab/reading-panel.tsx @ 4b16671 (working tree: Phase 54).
// What was read, beside the canvas, line by line. Each row says "I read: …" for its line; a reading that
// is not plain maths is shown only where `showNonMath` is set (the lab), never to a student -- no
// sentence a model wrote reaches a child that way (AI-13's third rule). Mobile (design #64): the maths
// is drawn natively (`MathLine`); a tap on a line's text marks it on the page (the web's hover, which an
// iPad's pointer also gives); the row's label says the line in words.
import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';

import { BadgePill } from '@/components/badge-pill';
import { OutlinedCard } from '@/components/outlined-card';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { confidenceText, lineLabel, readingView, sourceLabel, type ReadingView } from './lab-model';
import type { LineState } from './line-reader-model';
import { MathLine } from './math-line';

export const CODE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function ReadingPanel({
  lines,
  source,
  highlighted,
  onHighlight,
  renderActions,
  showNonMath = false,
}: {
  lines: LineState[];
  source: { provider: string; model: string } | null;
  /** The line the reader is pointing at, by index; the canvas marks it too. */
  highlighted: number | null;
  onHighlight: (index: number | null) => void;
  /** What the lab adds under each line: confirm, fix, the picture. */
  renderActions?: (state: LineState) => ReactNode;
  showNonMath?: boolean;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <OutlinedCard testID="reading-panel">
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Icon source="text-recognition" size={18} color={muted} />
          <Text variant="titleMedium" accessibilityRole="header" style={{ flex: 1 }}>
            What I read
          </Text>
          {source ? <BadgePill testID="reading-source" label={sourceLabel(source)} /> : null}
        </View>
        {source?.provider === 'fake' ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            The fake reader cannot see: it reads each line as its number of strokes. Real reading runs on
            production, or locally with AI_PROVIDER=anthropic and a key in apps/api/.dev.vars.
          </Text>
        ) : null}

        {lines.length === 0 ? (
          <Text testID="reading-empty" variant="bodyMedium" style={{ color: muted }}>
            Write a step on the page. Each line is read once the pen rests.
          </Text>
        ) : (
          <View style={{ gap: space.sm }}>
            {lines.map((state) => (
              <ReadingRow
                key={state.line.key}
                state={state}
                highlighted={highlighted === state.line.index}
                onHighlight={onHighlight}
                showNonMath={showNonMath}
                actions={renderActions?.(state)}
              />
            ))}
          </View>
        )}
      </View>
    </OutlinedCard>
  );
}

function ReadingText({ view }: { view: ReadingView }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  switch (view.kind) {
    case 'math':
    case 'raw':
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm }}>
          <Text variant="bodySmall" style={{ color: muted }}>
            I read:
          </Text>
          {view.kind === 'math' ? (
            <MathLine latex={view.latex} />
          ) : (
            <Text
              variant="bodyMedium"
              style={{
                fontFamily: CODE_FONT,
                backgroundColor: theme.tokens.muted,
                borderRadius: radius.sm,
                paddingHorizontal: space.xs,
              }}
            >
              {view.latex}
            </Text>
          )}
        </View>
      );
    case 'failed':
      return (
        <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
          {view.message}
        </Text>
      );
    case 'not-math':
      return (
        <Text variant="bodyMedium" style={{ color: muted }}>
          Read, but not as maths.
        </Text>
      );
    case 'unreadable':
      return (
        <Text variant="bodyMedium" style={{ color: muted }}>
          I could not read this line.
        </Text>
      );
    case 'waiting':
      return (
        <Text variant="bodyMedium" style={{ color: muted }}>
          Waiting for the pen to rest…
        </Text>
      );
  }
}

function ReadingRow({
  state,
  highlighted,
  onHighlight,
  showNonMath,
  actions,
}: {
  state: LineState;
  highlighted: boolean;
  onHighlight: (index: number | null) => void;
  showNonMath: boolean;
  actions: ReactNode;
}) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const muted = theme.tokens.mutedForeground;
  const { line, reading, previous, pending } = state;
  const view = readingView(reading ?? previous, showNonMath);
  const confidence = confidenceText(reading, pending);
  const number = line.index + 1;

  return (
    <View
      testID={`reading-line-${number}`}
      style={{
        gap: space.sm,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.sm + 2,
        borderColor: highlighted ? theme.colors.primary : theme.colors.outlineVariant,
        backgroundColor: highlighted ? withAlpha(theme.colors.primary, 0.05) : 'transparent',
      }}
    >
      <Pressable
        testID={`reading-text-${number}`}
        accessibilityRole="button"
        accessibilityLabel={lineLabel(number, view, confidence, pending)}
        accessibilityHint="Marks this line on the page"
        accessibilityState={{ selected: highlighted, busy: pending }}
        onPress={() => {
          haptics.selection();
          onHighlight(highlighted ? null : line.index);
        }}
        onHoverIn={() => onHighlight(line.index)}
        onHoverOut={() => onHighlight(null)}
        // 28pt tall, its slop inside the row's padding: a 44pt target.
        hitSlop={{ top: 8, bottom: 8 }}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 28 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.tokens.muted,
          }}
        >
          <Text variant="labelSmall" style={{ color: muted, fontWeight: '700' }}>
            {String(number)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, opacity: reading ? 1 : 0.6, paddingTop: 2 }}>
          <ReadingText view={view} />
        </View>
        {pending ? (
          reduceMotion ? (
            <Icon source="progress-clock" size={16} color={muted} />
          ) : (
            <ActivityIndicator size={14} color={muted} />
          )
        ) : confidence ? (
          <Text variant="labelSmall" style={{ color: muted, fontVariant: ['tabular-nums'], paddingTop: 4 }}>
            {confidence}
          </Text>
        ) : null}
      </Pressable>
      {showNonMath && reading?.status === 'read' && !reading.is_math ? (
        <View
          testID={`reading-not-math-${number}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
        >
          <Icon source="alert-outline" size={14} color={muted} />
          <Text variant="bodySmall" style={{ color: muted, flex: 1 }}>
            Not plain maths: a student would not be shown this reading.
          </Text>
        </View>
      ) : null}
      {actions}
    </View>
  );
}
