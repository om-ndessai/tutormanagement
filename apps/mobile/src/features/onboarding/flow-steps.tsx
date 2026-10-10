// Ported from apps/web/src/features/onboarding/flow-steps.tsx @ 1132322.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, Surface, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export interface FlowStepItem {
  key: string;
  label: string;
}

/**
 * Where a guided setup is: each step ticked, current, or still to come. A skipped step is simply
 * not ticked -- skipping is always allowed.
 */
export function FlowSteps({
  steps,
  current,
  done,
}: {
  steps: FlowStepItem[];
  current: string;
  done: ReadonlySet<string>;
}) {
  const theme = useAppTheme();
  return (
    <View
      testID="flow-steps"
      accessibilityLabel="Steps"
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}
    >
      {steps.map((step) => {
        const isDone = done.has(step.key);
        const isCurrent = step.key === current;
        const color = isDone
          ? theme.tokens.success
          : isCurrent
            ? theme.colors.onSurface
            : theme.tokens.mutedForeground;
        return (
          <View
            key={step.key}
            testID={`flow-step-${step.key}`}
            accessibilityLabel={`${step.label}${isDone ? ', done' : isCurrent ? ', current step' : ''}`}
            accessibilityState={{ selected: isCurrent, checked: isDone }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon
              source={isDone ? 'check' : isCurrent ? 'record-circle-outline' : 'circle-outline'}
              size={14}
              color={color}
            />
            <Text variant="labelMedium" style={{ color, fontWeight: isCurrent ? '600' : '400' }}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** The current step: what it is for, and what to do or skip. */
export function StepPanel({
  title,
  children,
  actions,
  testID,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <Surface
      testID={testID}
      elevation={0}
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.tokens.muted,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
        {title}
      </Text>
      <View style={{ gap: space.sm }}>{children}</View>
      <View style={{ gap: space.sm }}>{actions}</View>
    </Surface>
  );
}

/** A step's explanation, in the muted body text the web uses. */
export function StepText({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
      {children}
    </Text>
  );
}
