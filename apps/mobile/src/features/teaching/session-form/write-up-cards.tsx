// A lesson's write-up as four optional cards (UI upgrades U4): Planned, Covered, Homework and
// Progress, one per step of the record flow. Each text card leads with its main part and a large
// Dictate button; the parts are the ones the record sheet has always written (Phase 23), mapped:
//
//   Planned  -> write_up.planned (main), write_up.previous_review ("how much of last time stuck")
//   Covered  -> sessions.notes ("what was covered")
//   Homework -> write_up.homework_status and homework_review (last time's), write_up.homework_assigned (main)
//   Progress -> session_progress (goal and topic scores), and the writer's own assessment
//
// The assessment is not a write-up part (it is `session_assessments`), but it is how the writer
// says the lesson went, so it rides on the Progress card rather than being dropped from the flow.
// Nothing here carries money: the record flow is reached from Tutoring only.
import type { TutoringSession } from '@tmi/shared';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { OutlinedCard } from '@/components/outlined-card';
import { DictationField } from '@/features/dictation/dictation-field';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { AssessmentFields, HomeworkStatusPicker } from '../session-notes';
import { PreviousLesson } from './previous-lesson';
import { ProgressSection } from './progress-section';
import { NOTES_MAX, PART_MAX, type SessionWriteUp } from './use-session-write-up';

/** The server's field names each card owns: a refusal naming one opens that card. */
export const WRITE_UP_STEP_FIELDS = {
  planned: ['write_up.planned', 'write_up.previous_review'],
  covered: ['notes'],
  homework: ['write_up.homework_status', 'write_up.homework_review', 'write_up.homework_assigned'],
  progress: [
    'progress',
    'progress.goal_rating',
    'progress.topic_ratings',
    'assessment',
    'assessment.rating',
    'assessment.body',
  ],
} as const;

function Card({ children, testID }: { children: ReactNode; testID: string }) {
  return (
    <OutlinedCard>
      <View testID={testID} style={{ padding: space.lg, gap: space.lg }}>
        {children}
      </View>
    </OutlinedCard>
  );
}

function Hint({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
      {children}
    </Text>
  );
}

export function PlannedCard({
  w,
  previous,
}: {
  w: SessionWriteUp;
  /** The lesson before this one, whose homework and notes this card looks back on. */
  previous: TutoringSession | null | undefined;
}) {
  const { values, set, errors, normalise } = w;
  return (
    <Card testID="write-up-planned">
      <DictationField
        testID="record-planned"
        label="What was planned"
        value={values.planned}
        onChange={(text) => set('planned', text)}
        placeholder="What this lesson set out to cover"
        error={errors['write_up.planned']}
        maxLength={PART_MAX}
        normalise={normalise}
        prominent
      />
      {previous ? <PreviousLesson session={previous} showTutor={w.isAdmin} /> : null}
      <DictationField
        testID="record-previous-review"
        label="Previous session review"
        value={values.previousReview}
        onChange={(text) => set('previousReview', text)}
        placeholder="How much of last time had stuck"
        error={errors['write_up.previous_review']}
        maxLength={PART_MAX}
        normalise={normalise}
      />
    </Card>
  );
}

export function CoveredCard({ w }: { w: SessionWriteUp }) {
  const { values, set, errors, normalise } = w;
  return (
    <Card testID="write-up-covered">
      <DictationField
        testID="record-notes"
        label="Session notes"
        value={values.notes}
        onChange={(text) => set('notes', text)}
        placeholder="What was covered, and how it went"
        error={errors.notes}
        long
        maxLength={NOTES_MAX}
        normalise={normalise}
        prominent
      />
    </Card>
  );
}

export function HomeworkCard({ w }: { w: SessionWriteUp }) {
  const { values, set, errors, normalise } = w;
  return (
    <Card testID="write-up-homework">
      <View style={{ gap: space.sm }}>
        <Text variant="titleSmall">Last time’s homework</Text>
        <HomeworkStatusPicker
          testID="record-homework"
          value={values.homeworkStatus}
          onChange={(status) => set('homeworkStatus', status)}
        />
        <DictationField
          testID="record-homework-review"
          label="Homework review"
          value={values.homeworkReview}
          onChange={(text) => set('homeworkReview', text)}
          placeholder="How the homework from last time went"
          error={errors['write_up.homework_review']}
          maxLength={PART_MAX}
          normalise={normalise}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="titleSmall">For next time</Text>
        <DictationField
          testID="record-homework-set"
          label="Homework set"
          value={values.homeworkAssigned}
          onChange={(text) => set('homeworkAssigned', text)}
          placeholder="What they are to do before next time"
          error={errors['write_up.homework_assigned']}
          maxLength={PART_MAX}
          normalise={normalise}
          prominent
        />
      </View>
    </Card>
  );
}

export function ProgressCard({ w }: { w: SessionWriteUp }) {
  const { values, set, errors, normalise, studentId } = w;
  return (
    <View style={{ gap: space.lg }}>
      {studentId ? (
        <ProgressSection
          studentId={studentId}
          goalRating={values.goalRating}
          onGoalRating={(rating) => set('goalRating', rating)}
          topicRatings={values.topicRatings}
          onTopicRatings={(ratings) => set('topicRatings', ratings)}
          error={errors['progress.topic_ratings'] ?? errors['progress.goal_rating'] ?? errors.progress}
        />
      ) : null}
      <Card testID="write-up-assessment">
        <View style={{ gap: space.xs }}>
          <Text variant="titleSmall">Your view of the lesson</Text>
          <Hint>
            {w.isEdit
              ? 'Everyone this lesson concerns can read it.'
              : 'Private with the rest of a draft; everyone this lesson concerns can read it once it is recorded.'}
          </Hint>
        </View>
        <AssessmentFields
          testID="record-assessment"
          role={w.myRole}
          rating={values.myRating}
          onRating={(rating) => set('myRating', rating)}
          body={values.myAssessment}
          onBody={(text) => set('myAssessment', text)}
          errors={{
            rating: errors['assessment.rating'] ?? errors.assessment,
            body: errors['assessment.body'],
          }}
          dictate
          normalise={normalise}
        />
        {errors.form ? <FieldError>{errors.form}</FieldError> : null}
      </Card>
    </View>
  );
}
