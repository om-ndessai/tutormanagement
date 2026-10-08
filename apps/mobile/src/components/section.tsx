// Ported from apps/web/src/features/dashboard/stat-card.tsx (DashboardSection, Panel, EmptyNote) @ 1132322
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { slug } from '@/components/stat-card';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

export interface SectionAction {
  label: string;
  to: Href;
}

/** "All sessions →": a section's link to the full view, at a full-size touch target. */
function ActionLink({ action, testID }: { action: SectionAction; testID: string }) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={action.label}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      onPress={() => router.navigate(action.to)}
      style={{ minHeight: MIN_TARGET / 2, justifyContent: 'center' }}
    >
      {({ pressed }) => (
        <Text
          variant="labelMedium"
          style={{ color: pressed ? theme.colors.primary : theme.tokens.mutedForeground }}
        >
          {action.label} →
        </Text>
      )}
    </Pressable>
  );
}

/**
 * A titled band of the dashboard (Phase 21): Analytics, Tutoring Sessions, Progress, Recent
 * Activity. A heading and an optional link, over content that brings its own cards -- unlike
 * Panel, which is itself one card. `tourId` is what the feature tour (34) points at: keep it
 * when moving markup.
 */
export function DashboardSection({
  title,
  action,
  children,
  tourId,
}: {
  title: string;
  action?: SectionAction;
  children: ReactNode;
  tourId?: string;
}) {
  const id = `dashboard-section-${slug(title)}`;
  return (
    <View testID={id} nativeID={tourId} style={{ minWidth: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.sm,
          marginBottom: space.sm,
        }}
      >
        <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
          {title}
        </Text>
        {action ? <ActionLink action={action} testID={`${id}-action`} /> : null}
      </View>
      {children}
    </View>
  );
}

/** A titled block of content in one card, with an optional link to the full view. */
export function Panel({
  title,
  action,
  children,
  tourId,
  testID,
}: {
  title?: string;
  action?: SectionAction;
  children: ReactNode;
  tourId?: string;
  testID?: string;
}) {
  return (
    <Card
      mode="outlined"
      testID={testID}
      nativeID={tourId}
      style={{ borderRadius: radius.lg }}
      contentStyle={{ padding: 0 }}
    >
      <View style={{ paddingHorizontal: space.lg, paddingVertical: title ? space.lg : space.sm }}>
        {title ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: space.sm,
              marginBottom: space.md,
            }}
          >
            <Text variant="titleSmall" accessibilityRole="header">
              {title}
            </Text>
            {action ? <ActionLink action={action} testID={`${testID ?? 'panel'}-action`} /> : null}
          </View>
        ) : null}
        {children}
      </View>
    </Card>
  );
}

/** A quiet sentence where a list would be. */
export function EmptyNote({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useAppTheme();
  return (
    <Text
      testID={testID}
      variant="bodyMedium"
      style={{ color: theme.tokens.mutedForeground, textAlign: 'center', paddingVertical: space.xl }}
    >
      {children}
    </Text>
  );
}
