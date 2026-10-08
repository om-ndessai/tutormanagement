// Ported from apps/web/src/features/teaching/session-reflection.tsx @ 1132322
// (AnswerChip, ReflectionFlags, ReflectionChips, ReflectionView; the dialog is the reflection sheet)
import {
  REFLECTION_QUESTIONS,
  SESSION_REFLECTOR_LABELS,
  reflectionFlags,
  type Rating,
  type ReflectionKey,
  type SessionReflection,
} from '@tmi/shared';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { RatingChip, ScaleChip } from '@/features/progress/rating';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { firstName } from './reflection-logic';
import { PartHeading } from './session-notes';

/** One answer as a chip: the rating ramp for low-to-high, neutral for centred. */
function AnswerChip({ questionKey, value }: { questionKey: ReflectionKey; value: Rating | null }) {
  const question = REFLECTION_QUESTIONS.find((q) => q.key === questionKey)!;
  return question.centred ? (
    <ScaleChip value={value} labels={question.labels} />
  ) : (
    <RatingChip rating={value} labels={question.labels} />
  );
}

/** Where a lesson missed, as warning badges: "Too fast", "Little new". */
export function ReflectionFlags({ reflection }: { reflection: SessionReflection }) {
  const theme = useAppTheme();
  const flags = reflectionFlags(reflection);
  if (flags.length === 0) return null;
  const ink = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;
  return (
    <>
      {flags.map((flag) => (
        <View
          key={flag}
          style={{
            borderWidth: 1,
            borderColor: withAlpha(theme.tokens.warning, 0.6),
            borderRadius: radius.sm,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '500', color: ink }}>{flag}</Text>
        </View>
      ))}
    </>
  );
}

/** The four answers in a compact row, for a list. */
export function ReflectionChips({ reflection }: { reflection: SessionReflection }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 }}>
      {REFLECTION_QUESTIONS.map((question) => (
        <View key={question.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AnswerChip questionKey={question.key} value={reflection[question.key]} />
          <Text style={{ fontSize: 11, color: theme.tokens.mutedForeground }}>{question.short}</Text>
        </View>
      ))}
    </View>
  );
}

/** The student's reflection in full, for a lesson's detail. */
export function ReflectionView({
  reflection,
  studentName,
}: {
  reflection: SessionReflection;
  studentName: string;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <View testID="session-reflection" style={{ gap: space.sm }}>
      <PartHeading>{firstName(studentName)}’s reflection</PartHeading>
      <View style={{ gap: 6 }}>
        {REFLECTION_QUESTIONS.map((question) => {
          const value = reflection[question.key];
          return (
            <View key={question.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <AnswerChip questionKey={question.key} value={value} />
              <Text variant="bodySmall" style={{ color: muted }}>
                {question.short}
              </Text>
              <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                {value ? question.labels[value] : 'Not answered'}
              </Text>
            </View>
          );
        })}
      </View>
      {reflection.homework_notes ? (
        <Text variant="bodyMedium">
          <Text variant="bodySmall" style={{ color: muted }}>
            Homework notes:{' '}
          </Text>
          {reflection.homework_notes}
        </Text>
      ) : null}
      {reflection.comment ? <Text variant="bodyMedium">{reflection.comment}</Text> : null}
      {reflection.entered_as !== 'student' ? (
        <Text variant="bodySmall" style={{ color: muted }}>
          Entered {reflection.entered_by_name ? `by ${reflection.entered_by_name} ` : ''}(
          {SESSION_REFLECTOR_LABELS[reflection.entered_as]}) for {firstName(studentName)}.
        </Text>
      ) : null}
    </View>
  );
}
