// Ported from apps/web/src/features/progress/plan-dialog.tsx @ 1132322.
// The dialog becomes a form sheet, `(org)/plan-form?student=<id>[&id=<plan>]`.
//
// The recommended course of tutoring: a goal and its date, the topics that lead there, and how
// often to meet. A new plan starts from the latest assessment: every topic it scored 3 or below is
// pre-selected, weakest first, because those are what the plan is for. Admin only, as the API.
import {
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  formatDuration,
  planInputSchema,
  planUpdateSchema,
  type LearningPlan,
  type PlanStatus,
  type Rating,
  type StudentProgress,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { DismissKeyboard } from '@/components/dismiss-keyboard';
import { Choice, Field } from '@/components/form-choice';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { organizationToday } from '@/features/teaching/session-ranges';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { NoteField } from '@/features/teaching/session-notes';
import { ApiRequestError } from '@/lib/api-client';
import { announceFormSaved } from '@/lib/form-bridge';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useCreatePlan, useCurriculum, useStudentProgress, useUpdatePlan } from './api';
import { aYearOn, weakestTopics } from './progress-model';
import { LevelPicker, PlanTopicsEditor } from './topic-pickers';

const SESSION_LENGTHS = [30, 45, 60, 75, 90, 120];
const PER_WEEK = [1, 2, 3, 4, 5, 6, 7];

function close() {
  if (router.canGoBack()) router.back();
}

export function PlanFormSheet({ studentId, planId }: { studentId: string; planId: string | undefined }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const progress = useStudentProgress(isAdmin ? studentId : undefined);
  const curriculum = useCurriculum();

  let body;
  if (!isAdmin) {
    body = <EmptyState icon="lock-outline" title="Only an admin can set a learning plan." />;
  } else if (progress.isPending || curriculum.isPending) {
    body = <LoadingState label="Loading the student…" />;
  } else if (progress.isError) {
    body = <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  } else {
    const data = progress.data.data;
    const plans = [...(data.plan ? [data.plan] : []), ...data.past_plans];
    const existing = planId ? plans.find((row) => row.id === planId) : null;
    body =
      existing === undefined ? (
        <ErrorState error={new ApiRequestError(404, 'not_found', 'That plan does not exist.')} />
      ) : (
        <PlanForm key={existing?.id ?? 'new'} progress={data} existing={existing} />
      );
  }

  return (
    <Screen testID="screen-plan-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

export function PlanForm({
  progress,
  existing,
}: {
  progress: StudentProgress;
  existing: LearningPlan | null;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const toast = useToast();
  const today = organizationToday(useOrgTimeZone());
  const { data } = useCurriculum();
  const levels = useMemo(() => data?.data ?? [], [data]);
  const { student } = progress;
  // The assessment a new plan answers: the student's latest.
  const assessment = progress.assessments[0] ?? null;

  const [goal, setGoal] = useState(existing?.goal ?? student.academic_year_goal ?? '');
  const [targetLevel, setTargetLevel] = useState(existing?.target_level_id ?? '');
  const [startsOn, setStartsOn] = useState(existing?.starts_on ?? today);
  const [targetOn, setTargetOn] = useState(existing?.target_on ?? aYearOn(today));
  const [perWeek, setPerWeek] = useState(existing?.sessions_per_week ?? 1);
  const [minutes, setMinutes] = useState(existing?.session_minutes ?? 60);
  const [recommendation, setRecommendation] = useState(existing?.recommendation ?? '');
  const [topics, setTopics] = useState<string[]>(
    () => existing?.topic_ids ?? weakestTopics(assessment, levels),
  );
  const [status, setStatus] = useState<PlanStatus>(existing?.status ?? 'active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useCreatePlan();
  const update = useUpdatePlan();
  const saving = create.isPending || update.isPending;
  const lengths = SESSION_LENGTHS.includes(minutes)
    ? SESSION_LENGTHS
    : [...SESSION_LENGTHS, minutes].sort((a, b) => a - b);

  const baseline = useMemo(
    () => new Map<string, Rating>((assessment?.ratings ?? []).map((row) => [row.topic_id, row.rating])),
    [assessment],
  );

  async function handleSave() {
    setErrors({});
    const body = {
      goal: goal.trim(),
      target_level_id: targetLevel || null,
      starts_on: startsOn,
      target_on: targetOn,
      sessions_per_week: perWeek,
      session_minutes: minutes,
      recommendation: recommendation.trim() || null,
      topic_ids: topics,
    };

    const parsed = existing
      ? planUpdateSchema.safeParse({ ...body, status })
      : planInputSchema.safeParse({
          student_user_id: student.user_id,
          assessment_id: assessment?.id ?? null,
          ...body,
        });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      haptics.error();
      return;
    }

    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: { ...body, status } });
        toast.success('Plan updated.');
      } else {
        const created = await create.mutateAsync({
          student_user_id: student.user_id,
          assessment_id: assessment?.id ?? null,
          ...body,
        });
        toast.success('Plan created.');
        announceFormSaved({ form: 'plan', id: created.data.id });
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
      toast.error('Could not save the plan.');
    }
  }

  const firstError = errors.form ?? errors.goal ?? errors.target_on ?? errors.topic_ids;

  return (
    <DismissKeyboard style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {existing ? 'Edit learning plan' : 'Learning plan'} for {student.full_name}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {assessment && !existing
            ? `Answers the ${assessment.assessed_on} assessment. Topics it rated 3 or below are chosen for you.`
            : 'The goal, when it is due, what to cover, and how often to meet.'}
        </Text>
      </View>

      <View>
        <TextInput
          testID="plan-goal"
          mode="outlined"
          label="Goal"
          value={goal}
          onChangeText={setGoal}
          placeholder="e.g. Ready for AoPS Prealgebra by next school year"
          returnKeyType="done"
          error={Boolean(errors.goal)}
        />
        <HelperText type={errors.goal ? 'error' : 'info'} padding="none">
          {errors.goal ??
            (existing && existing.status !== 'active'
              ? 'This plan is finished, so its goal is kept as history.'
              : `Also the goal on ${student.full_name}’s record — the two are always the same.`)}
        </HelperText>
      </View>

      <LevelPicker
        testID="plan-target-level"
        label="Getting ready for"
        levels={levels}
        value={targetLevel}
        onChange={setTargetLevel}
        placeholder="Optional"
        error={errors.target_level_id}
      />

      <View style={{ gap: space.xs }}>
        <DateTimeField
          testID="plan-starts"
          mode="date"
          label="Tutoring starts"
          value={startsOn}
          onChange={(value) => {
            setStartsOn(value);
            if (targetOn <= value) setTargetOn(aYearOn(value));
          }}
          error={Boolean(errors.starts_on)}
        />
        <DateTimeField
          testID="plan-target"
          mode="date"
          label="Goal date"
          value={targetOn}
          minimumDate={startsOn}
          onChange={setTargetOn}
          error={Boolean(errors.target_on)}
        />
        {errors.starts_on || errors.target_on ? (
          <HelperText type="error" padding="none">
            {errors.starts_on ?? errors.target_on}
          </HelperText>
        ) : null}
      </View>

      <Field label="Sessions a week" error={errors.sessions_per_week}>
        <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityRole="radiogroup">
          {PER_WEEK.map((n) => (
            <Choice
              key={n}
              testID={`plan-per-week-${n}`}
              label={String(n)}
              accessibilityLabel={n === 1 ? 'Once a week' : n === 2 ? 'Twice a week' : `${n} times a week`}
              selected={perWeek === n}
              onPress={() => setPerWeek(n)}
            />
          ))}
        </View>
      </Field>

      <Field label="Each session" error={errors.session_minutes}>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
          accessibilityRole="radiogroup"
        >
          {lengths.map((n) => (
            <Choice
              key={n}
              testID={`plan-minutes-${n}`}
              label={formatDuration(n)}
              selected={minutes === n}
              onPress={() => setMinutes(n)}
              wide
            />
          ))}
        </View>
      </Field>

      {existing ? (
        <Field label="Status">
          <SegmentedButtons
            value={status}
            onValueChange={(value) => {
              haptics.selection();
              setStatus(value as PlanStatus);
            }}
            buttons={PLAN_STATUSES.map((value) => ({
              value,
              label: PLAN_STATUS_LABELS[value],
              testID: `plan-status-${value}`,
            }))}
          />
        </Field>
      ) : null}

      <NoteField
        testID="plan-recommendation"
        label="Recommendation"
        value={recommendation}
        onChange={setRecommendation}
        placeholder="The course of tutoring, in your words: what first, what can wait, what to watch for."
        error={errors.recommendation}
        long
      />

      <Field label="Topics to cover" error={errors.topic_ids}>
        {levels.length > 0 ? (
          <PlanTopicsEditor levels={levels} value={topics} onChange={setTopics} baseline={baseline} />
        ) : null}
      </Field>

      {firstError ? (
        <Text testID="plan-error" variant="bodyMedium" style={{ color: theme.colors.error }}>
          {firstError}
        </Text>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="plan-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
        >
          {existing ? 'Save changes' : 'Create plan'}
        </Button>
        <Button testID="plan-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </DismissKeyboard>
  );
}
