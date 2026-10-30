// Ported from apps/web/src/features/progress/progress-report-panel.tsx (Phase 58, working tree on
// main @ 8e5539b).
//
// The progress report, at the very bottom of a student's progress page
// (docs/progress-report-plan.md). Every reader of the page may make one; the Worker builds the PDF
// and lists only the lessons that reader could see. Mobile: "Generate Progress" opens the in-app
// pdf.js viewer (`/progress/report/[studentId]`); the PDF is never written to the device.
import { addDays, progressReportRangeProblem } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Checkbox, Text } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { Panel } from '@/components/section';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/** The default From: the current plan's start, else 90 days before today. */
export function defaultReportFrom(planStartsOn: string | null, today: string): string {
  return planStartsOn && planStartsOn <= today ? planStartsOn : addDays(today, -90);
}

export function ProgressReportPanel({
  studentId,
  planStartsOn,
  today,
}: {
  studentId: string;
  /** The current plan's start, the default From; without a plan, 90 days back. */
  planStartsOn: string | null;
  /** Today on the organization's clock, from the progress response. */
  today: string;
}) {
  const theme = useAppTheme();
  const [from, setFrom] = useState(() => defaultReportFrom(planStartsOn, today));
  const [to, setTo] = useState(today);
  const [original, setOriginal] = useState(false);

  const problem = progressReportRangeProblem(from, to);

  function generate() {
    if (problem) return;
    router.push({
      pathname: '/progress/report/[studentId]',
      params: { studentId, from, to, ...(original ? { original: '1' } : {}) },
    });
  }

  return (
    <Panel testID="progress-report" title="Progress report">
      <View style={{ gap: space.sm }}>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          A PDF of the goal, the timeline and the lessons in these dates, with their notes. It carries no
          amounts.
        </Text>
        <DateTimeField
          testID="progress-report-from"
          mode="date"
          label="From"
          value={from}
          maximumDate={to}
          onChange={setFrom}
          error={problem !== null}
        />
        <DateTimeField
          testID="progress-report-to"
          mode="date"
          label="To"
          value={to}
          onChange={setTo}
          error={problem !== null}
        />
        <Checkbox.Item
          testID="progress-report-original"
          label="Include original assessment"
          status={original ? 'checked' : 'unchecked'}
          onPress={() => {
            haptics.selection();
            setOriginal((value) => !value);
          }}
          position="leading"
          mode="android"
          labelStyle={{ textAlign: 'left' }}
          style={{ paddingHorizontal: 0 }}
        />
        {problem ? (
          <Text
            testID="progress-report-problem"
            variant="bodyMedium"
            accessibilityRole="alert"
            style={{ color: theme.colors.error }}
          >
            {problem}
          </Text>
        ) : null}
        <Button
          testID="progress-report-generate"
          mode="contained"
          icon="file-document-outline"
          disabled={problem !== null}
          onPress={generate}
        >
          Generate Progress
        </Button>
      </View>
    </Panel>
  );
}
