// Ported from apps/web/src/features/progress/assessment-dialog.tsx @ 1132322.
// The dialog becomes a form sheet, `(org)/assessment-form?student=<id>[&id=<assessment>]`.
//
// Records where a student stands: a write-up, the level recommended, and a 1-5 score on any topic
// the assessor chose to check. Admin only, as the API (`requireAdmin`).
import {
  assessmentInputSchema,
  assessmentUpdateSchema,
  type Assessment,
  type Rating,
  type StudentProgress,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { DismissKeyboard } from '@/components/dismiss-keyboard';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { organizationToday } from '@/features/teaching/session-ranges';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { NoteField } from '@/features/teaching/session-notes';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useCreateAssessment, useCurriculum, useStudentProgress, useUpdateAssessment } from './api';
import { levelOf } from './progress-model';
import { RatingLegend } from './rating';
import { LevelPicker, TopicRatingsEditor } from './topic-pickers';

function close() {
  if (router.canGoBack()) router.back();
}

/** The sheet's frame: loads the student, refuses a non-admin, finds the row being edited. */
export function AssessmentFormSheet({
  studentId,
  assessmentId,
}: {
  studentId: string;
  assessmentId: string | undefined;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const progress = useStudentProgress(isAdmin ? studentId : undefined);

  let body;
  if (!isAdmin) {
    body = <EmptyState icon="lock-outline" title="Only an admin can assess a student." />;
  } else if (progress.isPending) {
    body = <LoadingState label="Loading the student…" />;
  } else if (progress.isError) {
    body = <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  } else {
    const data = progress.data.data;
    const existing = assessmentId ? data.assessments.find((row) => row.id === assessmentId) : null;
    body =
      existing === undefined ? (
        <ErrorState error={new ApiRequestError(404, 'not_found', 'That assessment does not exist.')} />
      ) : (
        <AssessmentForm key={existing?.id ?? 'new'} progress={data} existing={existing} />
      );
  }

  return (
    <Screen testID="screen-assessment-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

export function AssessmentForm({
  progress,
  existing,
}: {
  progress: StudentProgress;
  existing: Assessment | null;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const toast = useToast();
  const today = organizationToday(useOrgTimeZone());
  const { data } = useCurriculum();
  const levels = data?.data ?? [];
  const { student } = progress;

  const [assessedOn, setAssessedOn] = useState(existing?.assessed_on ?? today);
  const [course, setCourse] = useState(existing?.school_course ?? student.current_math_course ?? '');
  const [level, setLevel] = useState(existing?.recommended_level_id ?? '');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [ratings, setRatings] = useState(
    () => new Map<string, Rating>((existing?.ratings ?? []).map((row) => [row.topic_id, row.rating])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useCreateAssessment();
  const update = useUpdateAssessment();
  const saving = create.isPending || update.isPending;

  async function handleSave() {
    setErrors({});
    const body = {
      assessed_on: assessedOn,
      school_course: course.trim() || null,
      recommended_level_id: level || null,
      summary: summary.trim() || null,
      ratings: [...ratings].map(([topic_id, rating]) => ({ topic_id, rating })),
    };

    // The shared rules first, so an SSN in the write-up never leaves the phone.
    const parsed = existing
      ? assessmentUpdateSchema.safeParse(body)
      : assessmentInputSchema.safeParse({ student_user_id: student.user_id, ...body });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      haptics.error();
      return;
    }

    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: body });
        toast.success('Assessment updated.');
      } else {
        await create.mutateAsync({ student_user_id: student.user_id, ...body });
        toast.success('Assessment recorded.');
      }
      haptics.success();
      close();
    } catch (error) {
      haptics.error();
      if (error instanceof ApiRequestError) {
        setErrors({ ...error.fieldErrors, form: error.message });
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the assessment.');
    }
  }

  const firstError = errors.form ?? errors.summary ?? errors.ratings ?? errors.assessed_on;

  return (
    <DismissKeyboard style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {existing ? 'Edit assessment' : 'Assess'} {student.full_name}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          Where they stand today. Rate only the topics you checked — an unrated topic is not a 1.
        </Text>
      </View>

      <View style={{ gap: space.xs }}>
        <DateTimeField
          testID="assessment-date"
          mode="date"
          label="Assessed on"
          value={assessedOn}
          onChange={setAssessedOn}
          error={Boolean(errors.assessed_on)}
        />
        {errors.assessed_on ? (
          <HelperText type="error" padding="none">
            {errors.assessed_on}
          </HelperText>
        ) : null}
      </View>

      <View>
        <TextInput
          testID="assessment-course"
          mode="outlined"
          label="Currently enrolled in"
          value={course}
          onChangeText={setCourse}
          placeholder="e.g. Grade 5 math at school"
          returnKeyType="done"
          error={Boolean(errors.school_course)}
        />
        {errors.school_course ? (
          <HelperText type="error" padding="none">
            {errors.school_course}
          </HelperText>
        ) : null}
      </View>

      <LevelPicker
        testID="assessment-level"
        label="Recommended level"
        levels={levels}
        value={level}
        onChange={setLevel}
        placeholder="Where they should work"
        error={errors.recommended_level_id}
      />

      <NoteField
        testID="assessment-summary"
        label="Assessment"
        value={summary}
        onChange={setSummary}
        placeholder="What they can do, where the gaps are, how they approach problems…"
        error={errors.summary}
        long
      />

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="titleSmall">Topic ratings</Text>
          <Text testID="assessment-rated-count" variant="bodySmall" style={{ color: muted }}>
            {ratings.size} rated
          </Text>
        </View>
        <RatingLegend />
        {levels.length > 0 ? (
          <TopicRatingsEditor
            levels={levels}
            ratings={ratings}
            onChange={setRatings}
            initialLevel={level || (existing?.ratings[0] ? levelOf(existing.ratings[0].topic_id) : undefined)}
          />
        ) : (
          <LoadingState label="Loading the curriculum…" />
        )}
        {errors.ratings ? (
          <HelperText type="error" padding="none">
            {errors.ratings}
          </HelperText>
        ) : null}
      </View>

      {/* A form sheet covers the app's toasts, so a failed save is said here too. */}
      {firstError ? (
        <Text testID="assessment-error" variant="bodyMedium" style={{ color: theme.colors.error }}>
          {firstError}
        </Text>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="assessment-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
        >
          {existing ? 'Save changes' : 'Record assessment'}
        </Button>
        <Button testID="assessment-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </DismissKeyboard>
  );
}
