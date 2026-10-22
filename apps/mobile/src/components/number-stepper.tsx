// Ported from apps/web/src/features/quest/start-game-page.tsx @ 9eccdf2 (working tree): Stepper.
//
// A number counter with − and + (Phase 47, design 61): typed or stepped, kept within its bounds. The
// value is a field that shows `format(value)` ("+2", "−3") and the raw number while it is being typed;
// typed "−3" or "-3" commits on blur or Done, clamped, and junk keeps the value. The buttons are full
// targets, labelled the web's way ("Questions: one less"), disabled at the bounds; holding one repeats
// after 400 ms every 90 ms. The range sits beside it, or under it at the largest text sizes. Each part
// stays its own element (an accessible group would fold them into one on Android).
import { useEffect, useRef, useState } from 'react';
import { Platform, View, type KeyboardTypeOptions } from 'react-native';
import { Text, TextInput } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { useLargeText } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/** Holding − or + repeats after this long, then every REPEAT_MS. */
export const REPEAT_AFTER_MS = 400;
export const REPEAT_MS = 90;

export function clampStep(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** What typed text commits to: the number in it ("−3" and "-3" alike), clamped; else `current`. */
export function stepperCommit(text: string, min: number, max: number, current: number): number {
  const n = Number.parseInt(text.trim().replace('−', '-'), 10);
  return Number.isFinite(n) ? clampStep(n, min, max) : current;
}

/**
 * The keyboard: iOS's numbers and punctuation (the number pad has no return key, so it could never be
 * put away); Android's number pad, or its phone pad when the value may be negative (its first page has
 * the minus sign).
 */
export function stepperKeyboard(os: string, min: number): KeyboardTypeOptions {
  if (os === 'ios') return 'numbers-and-punctuation';
  return min < 0 ? 'phone-pad' : 'number-pad';
}

/** "1 to 50", or "−10 to 0" through the format. */
export function stepperRange(min: number, max: number, format?: (value: number) => string): string {
  return format ? `${format(min)} to ${format(max)}` : `${min} to ${max}`;
}

export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
  format,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  /** The value field's; the buttons are `<testID>-minus` and `<testID>-plus`. */
  testID: string;
}) {
  const theme = useAppTheme();
  const large = useLargeText();
  // The raw text while the field is being typed in; null shows the formatted value.
  const [text, setText] = useState<string | null>(null);
  const latest = useRef(value);
  const timer = useRef<{ wait?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
  // A hold that repeated: the press that ends it is not one more step.
  const repeated = useRef(false);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  function stop() {
    if (timer.current.wait) clearTimeout(timer.current.wait);
    if (timer.current.repeat) clearInterval(timer.current.repeat);
    timer.current = {};
  }
  useEffect(() => stop, []);

  /** One step; false at the bound. */
  function step(delta: number): boolean {
    const next = clampStep(latest.current + delta, min, max);
    if (next === latest.current) return false;
    latest.current = next;
    haptics.selection();
    onChange(next);
    return true;
  }

  function hold(delta: number) {
    stop();
    repeated.current = false;
    timer.current.wait = setTimeout(() => {
      repeated.current = true;
      if (!step(delta)) return;
      timer.current.repeat = setInterval(() => {
        if (!step(delta)) stop();
      }, REPEAT_MS);
    }, REPEAT_AFTER_MS);
  }

  function commit() {
    if (text === null) return;
    const next = stepperCommit(text, min, max, value);
    setText(null);
    if (next !== value) onChange(next);
  }

  const range = (
    <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
      {stepperRange(min, max, format)}
    </Text>
  );

  const button = (delta: number) => {
    const at = delta < 0 ? value <= min : value >= max;
    return (
      <IconButton
        testID={`${testID}-${delta < 0 ? 'minus' : 'plus'}`}
        icon={delta < 0 ? 'minus' : 'plus'}
        mode="outlined"
        accessibilityLabel={`${label}: one ${delta < 0 ? 'less' : 'more'}`}
        disabled={at}
        onPress={() => {
          if (!repeated.current) step(delta);
          repeated.current = false;
        }}
        onPressIn={() => hold(delta)}
        onPressOut={stop}
      />
    );
  };

  return (
    <View style={{ gap: space.xs }}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {button(-1)}
        <TextInput
          testID={testID}
          mode="outlined"
          accessibilityLabel={label}
          dense
          value={text ?? (format ? format(value) : String(value))}
          onFocus={() => setText(String(value))}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={stepperKeyboard(Platform.OS, min)}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          selectTextOnFocus
          maxLength={4}
          style={{ width: 84, textAlign: 'center', fontSize: 20, fontWeight: '600' }}
        />
        {button(1)}
        {large ? null : range}
      </View>
      {large ? range : null}
    </View>
  );
}
