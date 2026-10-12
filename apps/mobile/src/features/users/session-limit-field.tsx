// The web form's SessionLimitField @ 1132322: the longest a single lesson may run, as a choice rather
// than a typed number because it has to be a multiple of a quarter hour. Chips rather than a menu:
// a Paper menu renders in the app's root portal, behind a form sheet.
import { DEFAULT_MAX_SESSION_MINUTES, SESSION_LIMIT_CHOICES, formatDuration } from '@tmi/shared';
import { View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { Choice } from '@/components/form-choice';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

export function SessionLimitField({
  testID,
  value,
  onChange,
  hint,
}: {
  testID: string;
  /** Minutes, or "" for no limit of their own. */
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  const theme = useAppTheme();
  return (
    <View testID={testID} style={{ gap: space.xs }}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        Longest session (optional)
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Choice
          testID={`${testID}-none`}
          label={`No limit of their own (${formatDuration(DEFAULT_MAX_SESSION_MINUTES)})`}
          selected={value === ''}
          onPress={() => onChange('')}
          wide
        />
        {SESSION_LIMIT_CHOICES.map((minutes) => (
          <Choice
            key={minutes}
            testID={`${testID}-${minutes}`}
            label={formatDuration(minutes)}
            selected={value === String(minutes)}
            onPress={() => onChange(String(minutes))}
            wide
          />
        ))}
      </View>
      <HelperText type="info" padding="none">
        {hint}
      </HelperText>
    </View>
  );
}
