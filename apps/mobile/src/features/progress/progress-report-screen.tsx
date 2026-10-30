// Phase 58 (docs/progress-report-plan.md): a student's progress report, shown in the app. The web
// opens the same PDF in its pdf.js viewer with a download link; the app reuses the assessment PDF's
// viewer (canvas-assessments/pdf-viewer.tsx) and offers no download or share sheet -- the bytes are
// fetched into memory and never written to the device. A refused range (400) or a student this
// reader cannot follow (404) shows the server's own words.
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { PdfViewer } from '@/features/canvas-assessments/pdf-viewer';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { fetchProgressReportPdf, useStudentProgress } from './api';
import { longDate } from './progress-model';

export function ProgressReportScreen() {
  const params = useLocalSearchParams<{ studentId: string; from?: string; to?: string; original?: string }>();
  const studentId = params.studentId ?? '';
  const from = params.from || undefined;
  const to = params.to || undefined;
  const original = params.original === '1';
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // Cached from the progress page this was opened from; only the name is read.
  const progress = useStudentProgress(studentId);
  const name = progress.data?.data.student.full_name;

  const range = from && to ? `${longDate(from)} → ${longDate(to)}` : 'From the plan’s start to today';
  const options = { from, to, original };

  return (
    <Screen
      testID="screen-progress-report"
      scroll={false}
      contentStyle={{ gap: space.sm, paddingTop: space.md, paddingBottom: insets.bottom }}
    >
      <Stack.Screen options={{ title: 'Progress report' }} />
      <View style={{ gap: space.xs }}>
        <Text testID="progress-report-title" variant="titleLarge" accessibilityRole="header">
          {name ? `${name} · Progress report` : 'Progress report'}
        </Text>
        <Text testID="progress-report-range" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          {original ? `${range} · with the original assessment` : range}
        </Text>
      </View>
      <PdfViewer
        load={() => fetchProgressReportPdf(studentId, options)}
        loadKey={`${studentId}:${from ?? ''}:${to ?? ''}:${original ? 1 : 0}`}
        label={name ? `${name}'s progress report` : 'Progress report'}
        testIDPrefix="progress-report-pdf"
        showServerError
      />
    </Screen>
  );
}
