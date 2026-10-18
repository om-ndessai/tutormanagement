// Ported from apps/web/src/features/canvas-assessments/review-assessment-page.tsx @ 22b9701.
//
// Phase 38: the tutor reviews an assessment's PDF here, in the app, without downloading it. Only the
// student's current tutors and the admins may (R17); for anybody else the row says it cannot be
// reviewed, and the PDF itself answers 404. Mobile: the web's Download button is left out -- the
// PDF carries the answer key and the worked solutions, and is never written to the device.
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
import { reviewSummary } from './assessment-model';
import { PdfViewer } from './pdf-viewer';

export function ReviewAssessmentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const summary = useCanvasAssessmentSummary(id);
  const assessment = summary.data?.data;

  if (summary.isPending) {
    return (
      <Screen testID="screen-assessment-review">
        <Stack.Screen options={{ title: 'Assessment' }} />
        <DetailSkeleton label="Loading the assessment…" rows={3} />
      </Screen>
    );
  }

  if (!assessment || !assessment.can_review) {
    return (
      <Screen testID="screen-assessment-review">
        <Stack.Screen options={{ title: 'Assessment' }} />
        <OutlinedCard testID="assessment-review-denied">
          <View style={{ gap: space.md, padding: space.lg }}>
            <Text variant="bodyMedium">This assessment’s PDF is for the student’s tutors and the office.</Text>
            <Button
              mode="outlined"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/assessments'))}
            >
              Back to Assessment
            </Button>
          </View>
        </OutlinedCard>
      </Screen>
    );
  }

  const title = `${assessment.student_name} · ${levelLabel(assessment.level_id)}`;
  return (
    <Screen
      testID="screen-assessment-review"
      scroll={false}
      contentStyle={{ gap: space.sm, paddingTop: space.md, paddingBottom: insets.bottom }}
    >
      <Stack.Screen options={{ title: 'Assessment' }} />
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {title}
        </Text>
        <Text testID="assessment-review-summary" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          {reviewSummary(assessment)}
        </Text>
      </View>
      <PdfViewer assessmentId={id} label={`${assessment.student_name}'s assessment`} />
    </Screen>
  );
}
