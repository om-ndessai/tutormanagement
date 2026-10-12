// A write-up field you can speak into (P3): the record sheet's NoteField plus a mic. While it
// listens, the field is read-only and the words being heard show UNDER it, never in it; only the
// recognizer's settled phrase is appended, so form state -- and the 3-second autosave -- only ever
// hold finished text. Never used in a finance, tax or person form (scripts/check-mobile-rules.mjs).
import { containsSsn, SSN_REJECTED_MESSAGE } from '@tmi/shared';
import { useEffect, useRef } from 'react';
import { Pressable, View, type TextInput as NativeTextInput } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { FieldError } from '@/components/field-error';
import { IconButton } from '@/components/icon-button';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { LISTENING_HINT } from './dictation-copy';
import { useDictation } from './use-dictation';

export interface DictationFieldProps {
  testID: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  /** The main notes: taller, and Return makes a new line instead of closing the keyboard. */
  long?: boolean;
  /** The shared schema's maximum for this field (2,000 for a part, 4,000 for the notes). */
  maxLength: number;
  /** Rewrites spoken curriculum codes ("B A three point ten" -> BA3.10). */
  normalise?: (text: string) => string;
}

const MIC = 48;

/** A soft ring round the live mic: a few pulses as it starts listening; still under reduce motion. */
function PulseRing({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    // A few breaths, then still: the filled stop button and the words under the field carry the
    // state from there (and a UI that never settles stalls UI automation on Android).
    scale.value = withRepeat(withTiming(1.25, { duration: 900 }), 4, true);
    return () => cancelAnimation(scale);
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: MIC,
          height: MIC,
          borderRadius: MIC / 2,
          borderWidth: 2,
          borderColor: color,
          opacity: 0.5,
        },
        style,
      ]}
    />
  );
}

export function DictationField({
  testID,
  label,
  value,
  onChange,
  placeholder,
  error,
  long = false,
  maxLength,
  normalise,
}: DictationFieldProps) {
  const theme = useAppTheme();
  const input = useRef<NativeTextInput>(null);
  const dictation = useDictation({ key: testID, label, value, onChange, maxLength, normalise });
  const { listening, phase, interim, message } = dictation;
  const muted = theme.tokens.mutedForeground;

  async function typeInstead() {
    await dictation.stopAndFlush();
    input.current?.focus();
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}>
        <View style={{ flex: 1 }}>
          <TextInput
            ref={input}
            testID={testID}
            mode="outlined"
            label={label}
            value={value}
            onChangeText={(text) => {
              dictation.clearMessage();
              onChange(text);
            }}
            placeholder={placeholder}
            multiline
            editable={!listening}
            error={Boolean(error || message)}
            style={{ minHeight: long ? 120 : 64 }}
            {...(long ? {} : { returnKeyType: 'done' as const, submitBehavior: 'blurAndSubmit' as const })}
          />
          {listening ? (
            // Tapping the field while it listens stops listening, then lets you type.
            <Pressable
              accessibilityLabel={`Stop dictating and type in ${label}`}
              onPress={() => void typeInstead()}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          ) : null}
        </View>
        <View
          style={{ width: MIC, height: MIC, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
        >
          {listening ? <PulseRing color={theme.colors.primary} /> : null}
          <IconButton
            testID={`dictate-${testID}`}
            icon={listening ? 'stop' : 'microphone'}
            mode={listening ? 'contained' : undefined}
            containerColor={listening ? theme.colors.primary : undefined}
            iconColor={listening ? theme.colors.onPrimary : theme.colors.primary}
            size={24}
            accessibilityLabel={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
            accessibilityState={{ selected: listening, busy: phase === 'preparing' }}
            onPress={dictation.toggle}
          />
        </View>
      </View>
      {listening ? (
        <View testID={`dictation-interim-${testID}`} style={{ paddingTop: space.xs, gap: 2 }}>
          <Text variant="bodySmall" style={{ color: muted }}>
            {LISTENING_HINT}
          </Text>
          {interim ? (
            containsSsn(interim) ? (
              // An early warning: nothing is committed, and the final will be refused.
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {SSN_REJECTED_MESSAGE}
              </Text>
            ) : (
              <Text variant="bodyMedium" style={{ color: muted, fontStyle: 'italic' }}>
                {interim}
              </Text>
            )
          ) : null}
        </View>
      ) : null}
      {message ? <FieldError testID={`dictation-error-${testID}`}>{message}</FieldError> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}
