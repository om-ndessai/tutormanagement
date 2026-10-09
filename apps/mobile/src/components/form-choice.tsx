// Small form pieces shared by the sheets: a labelled field with its error, and one choice of a
// small set (a weekday, a length, sessions a week) as a radio button at a full touch target.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="bodyMedium" style={{ color: error ? theme.colors.error : theme.tokens.mutedForeground }}>
        {label}
      </Text>
      {children}
      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

/** One choice of a small set. */
export function Choice({
  testID,
  label,
  accessibilityLabel,
  selected,
  onPress,
  wide = false,
}: {
  testID: string;
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: wide ? undefined : 1,
        minWidth: wide ? 72 : undefined,
        minHeight: MIN_TARGET,
        paddingHorizontal: wide ? space.md : 0,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.outline,
        backgroundColor: selected
          ? theme.colors.primary
          : pressed
            ? theme.colors.primaryContainer
            : 'transparent',
      })}
    >
      <Text
        variant="labelMedium"
        style={{ color: selected ? theme.colors.onPrimary : theme.colors.onSurface }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
