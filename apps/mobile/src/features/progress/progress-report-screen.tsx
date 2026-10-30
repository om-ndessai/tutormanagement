// Phase 58 (docs/progress-report-plan.md): a student's progress report, shown in the app. The web
// opens the same PDF in its pdf.js viewer with a download link; the app reuses the assessment PDF's
// viewer (canvas-assessments/pdf-viewer.tsx), with the bytes in memory only. Share (owner,
// 2026-10-30) is the web's download link here: the report is fetched again, written to the cache,
// handed to the share sheet and deleted when it closes (lib/download.ts), as CSV exports are. A
// refused range or a student this reader cannot follow shows the server's own words.
import { progressReportPath } from '@tmi/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { PdfViewer } from '@/features/canvas-assessments/pdf-viewer';
import { useAppTheme } from '@/providers/theme-provider';
import { downloadAndShare } from '@/lib/download';
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
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function share() {
    setSharing(true);
    setShareError(null);
    try {
      await downloadAndShare(progressReportPath(studentId, options), 'progress-report.pdf');
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Could not share the report.');
    } finally {
      setSharing(false);
    }
  }

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
        <Button
          testID="progress-report-share"
          mode="contained-tonal"
          icon="share-variant"
          loading={sharing}
          disabled={sharing}
          onPress={share}
          style={{ alignSelf: 'flex-start', marginTop: space.xs }}
        >
          Share report
        </Button>
        {shareError ? (
          <HelperText testID="progress-report-share-error" type="error" visible>
            {shareError}
          </HelperText>
        ) : null}
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
