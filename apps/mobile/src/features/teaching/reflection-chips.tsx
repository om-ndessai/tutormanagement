// Ported from apps/web/src/features/teaching/session-reflection.tsx @ 1132322
// (AnswerChip, ReflectionFlags, ReflectionChips; the dialog arrives with feature 21)
import {
  REFLECTION_QUESTIONS,
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
import { radius } from '@/theme/tokens';

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
