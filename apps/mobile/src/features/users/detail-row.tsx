// The record's label/value rows and sections, from apps/web/src/features/users/user-detail-view.tsx
// (Detail, Section, Muted) @ 1132322.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Divider, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, space } from '@/theme/tokens';

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
            fontSize: 12,
            fontWeight: '600',
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
  onEdit,
  editTestID,
}: {
  title: string;
  icon: string;
  children: ReactNode;
  testID?: string;
  /** The section's own Edit (UI upgrades U5): only that part of the record. */
  onEdit?: () => void;
  editTestID?: string;
}) {
  return (
    <View testID={testID} style={{ gap: space.lg }}>
      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: onEdit ? MIN_TARGET : undefined }}>
        <Icon source={icon} size={16} />
        <Text variant="titleSmall" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {onEdit ? (
          <Button
            testID={editTestID}
            mode="text"
            compact
            icon="pencil-outline"
            onPress={onEdit}
            accessibilityLabel={`Edit ${title}`}
            contentStyle={{ minHeight: MIN_TARGET }}
            style={{ marginVertical: -space.sm }}
          >
            Edit
          </Button>
        ) : null}
      </View>
      {children}
    </View>
  );
}
