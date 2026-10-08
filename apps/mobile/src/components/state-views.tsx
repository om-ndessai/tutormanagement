import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';

import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/** A centred spinner with a sentence, for a screen still loading. */
export function LoadingState({ label = 'Loading…', testID }: { label?: string; testID?: string }) {
  return (
    <View
      testID={testID ?? 'state-loading'}
      style={{ padding: space.xxl, alignItems: 'center', gap: space.md }}
    >
      <ActivityIndicator accessibilityLabel={label} />
      <Text variant="bodyMedium">{label}</Text>
    </View>
  );
}

/** What went wrong, in the server's own words, and a way to try again. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const theme = useAppTheme();
  const message =
    error instanceof ApiRequestError
      ? error.status === 404
        ? 'Not found. It may have been removed, or it is not yours to see.'
        : error.message
      : 'Something went wrong.';
  return (
    <View testID="state-error" style={{ padding: space.xl, alignItems: 'center', gap: space.md }}>
      <Icon source="alert-circle-outline" size={32} color={theme.colors.error} />
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry ? (
        <Button mode="outlined" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}

/** Nothing to show yet, said plainly; optionally the next step. */
export function EmptyState({
  icon = 'inbox-outline',
  title,
  body,
  action,
  testID,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <View testID={testID ?? 'state-empty'} style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}>
      <Icon source={icon} size={32} color={theme.colors.onSurfaceVariant} />
      <Text variant="titleMedium" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
