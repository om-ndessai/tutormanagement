// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (FormSection).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/** A titled group of fields in the write-up. */
export function FormSection({
  title,
  description,
  children,
  testID,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      testID={testID}
      style={{
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: radius.md,
        padding: space.md,
        gap: space.md,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text variant="titleSmall" accessibilityRole="header">
          {title}
        </Text>
        {description ? (
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
