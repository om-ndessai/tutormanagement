// The record's label/value rows and sections, from apps/web/src/features/users/user-detail-view.tsx
// (Detail, Section, Muted) @ 1132322.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Divider, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

export function Detail({
  icon,
  label,
  children,
  testID,
}: {
  icon: string;
  label: string;
  children: ReactNode;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <View testID={testID} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon source={icon} size={14} color={theme.tokens.mutedForeground} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: theme.tokens.mutedForeground,
          }}
        >
          {label}
        </Text>
      </View>
      {typeof children === 'string' ? <Text variant="bodyMedium">{children}</Text> : children}
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
      {children}
    </Text>
  );
}

export function Section({
  title,
  icon,
  children,
  testID,
}: {
  title: string;
  icon: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ gap: space.lg }}>
      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon source={icon} size={16} />
        <Text variant="titleSmall" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
