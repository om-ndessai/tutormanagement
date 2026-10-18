// Ported from apps/web/src/features/canvas-assessments/assessment-pdf-page.tsx (Phase 40), which
// replaced the Phase 38 review-assessment-page.tsx this screen was first ported from.
//
// An assessment's PDF, shown in the app rather than downloaded. The submitted one (with the answer
// key) is for the student's current tutors and the admins; the reviewed one (`?kind=reviewed`) for
// the student's whole audience, once a tutor has saved it as reviewed (R17). Mobile: the web's
// Download button is left out -- a PDF is never written to the device.
import { levelLabel } from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { DetailSkeleton } from '@/components/skeletons';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useCanvasAssessmentSummary } from './api';
import { PdfViewer } from './pdf-viewer';
import { mayOpenPdf, pdfScreenSummary } from './review-model';

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/assessments');
}

export function AssessmentPdfScreen() {
  const { id = '', kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind = kindParam === 'reviewed' ? 'reviewed' : 'submitted';
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const summary = useCanvasAssessmentSummary(id);
  const assessment = summary.data?.data;
  const screenTitle = kind === 'reviewed' ? 'Review' : 'Assessment';

  if (summary.isPending) {
    return (
      <Screen testID="screen-assessment-pdf">
        <Stack.Screen options={{ title: screenTitle }} />
        <DetailSkeleton label="Loading the assessment…" rows={3} />
      </Screen>
    );
  }

  if (!assessment || !mayOpenPdf(assessment, kind)) {
    return (
      <Screen testID="screen-assessment-pdf">
        <Stack.Screen options={{ title: screenTitle }} />
        <OutlinedCard testID="assessment-pdf-denied">
          <View style={{ gap: space.md, padding: space.lg }}>
            <Text variant="bodyMedium">
              {kind === 'reviewed'
                ? 'This assessment has not been reviewed yet.'
                : 'This assessment’s PDF is for the student’s tutors and the office.'}
            </Text>
            <Button mode="outlined" style={{ alignSelf: 'flex-start' }} onPress={back}>
              Back to Assessment
            </Button>
          </View>
        </OutlinedCard>
      </Screen>
    );
  }

  const title = `${kind === 'reviewed' ? 'Review: ' : ''}${assessment.student_name} · ${levelLabel(assessment.level_id)}`;
  return (
    <Screen
      testID="screen-assessment-pdf"
      scroll={false}
      contentStyle={{ gap: space.sm, paddingTop: space.md, paddingBottom: insets.bottom }}
    >
      <Stack.Screen options={{ title: screenTitle }} />
      <View style={{ gap: space.xs }}>
        <Text testID="assessment-pdf-title" variant="titleLarge" accessibilityRole="header">
          {title}
        </Text>
        <Text testID="assessment-review-summary" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          {pdfScreenSummary(assessment, kind)}
        </Text>
        {kind === 'submitted' ? (
          <Button
            testID="assessment-pdf-edit-review"
            mode="contained"
            compact
            icon="draw-pen"
            style={{ alignSelf: 'flex-start', marginTop: space.xs }}
            onPress={() => router.push({ pathname: '/assessments/review/[id]', params: { id } })}
          >
            {assessment.reviewed_at ? 'Edit the review' : 'Review'}
          </Button>
        ) : null}
      </View>
      <PdfViewer
        assessmentId={id}
        kind={kind}
        label={`${assessment.student_name}'s ${kind === 'reviewed' ? 'reviewed ' : ''}assessment`}
      />
    </Screen>
  );
}
