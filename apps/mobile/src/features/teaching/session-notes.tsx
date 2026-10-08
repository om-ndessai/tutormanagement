// Ported from apps/web/src/features/teaching/session-notes.tsx @ 1132322: the view parts (Part,
// SessionNotesView, HomeworkStatusBadge, AssessmentChips, AssessmentsView, hasWrittenNotes) and the
// form parts (NoteField, HomeworkStatusPicker, AssessmentFields, likelyAssessorRole).
// Nothing in this file shows money: all of it is read on the Tutoring tab, beside the student.
import {
  HOMEWORK_STATUSES,
  HOMEWORK_STATUS_LABELS,
  SESSION_ASSESSMENT_PROMPTS,
  SESSION_ASSESSOR_LABELS,
  SESSION_RATING_LABELS,
  SESSION_WRITE_UP_PARTS,
  type HomeworkStatus,
  type Rating,
  type SessionAssessment,
  type SessionAssessorRole,
  type TutoringSession,
  type User,
} from '@tmi/shared';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Chip, Divider, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { RatingChip, RatingPicker } from '@/features/progress/rating';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import { radius, space } from '@/theme/tokens';

export const HOMEWORK_ICONS: Record<HomeworkStatus, string> = {
  done: 'check-circle-outline',
  partial: 'circle-half-full',
  not_done: 'close-circle-outline',
  none_set: 'minus-circle-outline',
};

/** The ink and border of a homework status: success, warning, or quiet. */
function homeworkTone(theme: AppTheme, status: HomeworkStatus) {
  const t = theme.tokens;
  if (status === 'done') return { color: t.success, border: withAlpha(t.success, 0.4) };
  if (status === 'none_set') return { color: t.mutedForeground, border: theme.colors.outline };
  return {
    color: theme.scheme === 'dark' ? t.warning : t.warningForeground,
    border: withAlpha(t.warning, 0.6),
  };
}

/** How last time's homework went, as icon + words: never colour alone. */
export function HomeworkStatusBadge({ status }: { status: HomeworkStatus }) {
  const theme = useAppTheme();
  const tone = homeworkTone(theme, status);
  return (
    <View
      testID={`homework-status-${status}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: tone.border,
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Icon source={HOMEWORK_ICONS[status]} size={12} color={tone.color} />
      <Text style={{ fontSize: 10, fontWeight: '500', color: tone.color }}>
        Homework: {HOMEWORK_STATUS_LABELS[status].toLowerCase()}
      </Text>
    </View>
  );
}

/** A small uppercase heading over a part of the write-up. */
export function PartHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: theme.tokens.mutedForeground,
        }}
      >
        {children}
      </Text>
      {aside}
    </View>
  );
}

function Part({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <PartHeading aside={aside}>{label}</PartHeading>
      {children ? <Text variant="bodyMedium">{children}</Text> : null}
    </View>
  );
}

/** True when a lesson has anything written about it to show. */
export function hasWrittenNotes(session: Pick<TutoringSession, 'notes' | 'write_up'>): boolean {
  return Boolean(session.notes || session.write_up);
}

/**
 * The write-up in the order a lesson runs: what was planned, the look back at last time and its
 * homework, what was covered, and what was set. A lesson recorded before the parts existed shows
 * its notes alone, as it always did.
 */
export function SessionNotesView({ session }: { session: TutoringSession }) {
  const writeUp = session.write_up;

  if (!writeUp) {
    return session.notes ? (
      <Text testID="session-notes" variant="bodyMedium">
        {session.notes}
      </Text>
    ) : null;
  }

  const [planned, previous, homeworkReview, homeworkSet] = SESSION_WRITE_UP_PARTS;

  return (
    <View testID="session-notes" style={{ gap: space.md }}>
      {writeUp.planned ? <Part label={planned.label}>{writeUp.planned}</Part> : null}
      {writeUp.previous_review ? <Part label={previous.label}>{writeUp.previous_review}</Part> : null}
      {writeUp.homework_review || writeUp.homework_status ? (
        <Part
          label={homeworkReview.label}
          aside={writeUp.homework_status ? <HomeworkStatusBadge status={writeUp.homework_status} /> : null}
        >
          {writeUp.homework_review}
        </Part>
      ) : null}
      {session.notes ? <Part label="What was covered">{session.notes}</Part> : null}
      {writeUp.homework_assigned ? <Part label={homeworkSet.label}>{writeUp.homework_assigned}</Part> : null}
    </View>
  );
}

/** A compact row of who has assessed the lesson, for a card. */
export function AssessmentChips({ assessments }: { assessments: SessionAssessment[] }) {
  if (assessments.length === 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${assessments.length} assessments`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      {assessments.map((row) => (
        <RatingChip key={row.author_user_id} rating={row.rating} labels={SESSION_RATING_LABELS} size={20} />
      ))}
    </View>
  );
}

/** Every assessment of the lesson, tutor first, each saying who gave it. */
export function AssessmentsView({ assessments }: { assessments: SessionAssessment[] }) {
  const theme = useAppTheme();
  if (assessments.length === 0) return null;

  return (
    <View testID="session-assessments" style={{ gap: space.xs }}>
      <PartHeading>Assessments</PartHeading>
      {assessments.map((row, index) => (
        <View key={row.author_user_id}>
          {index > 0 ? <Divider /> : null}
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: space.sm }}
          >
            <RatingChip rating={row.rating} labels={SESSION_RATING_LABELS} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodySmall">
                <Text style={{ fontWeight: '600' }}>{row.author_name}</Text>
                <Text style={{ color: theme.tokens.mutedForeground }}>
                  {' '}
                  · {SESSION_ASSESSOR_LABELS[row.author_role]}
                  {row.rating ? ` · ${SESSION_RATING_LABELS[row.rating]}` : ''}
                </Text>
              </Text>
              {row.body ? (
                <Text variant="bodyMedium" style={{ marginTop: 2 }}>
                  {row.body}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The form parts: the write-up as it is typed, and the reader's own assessment.
// ---------------------------------------------------------------------------

/** A labelled free-text part of the write-up, with its error under it. */
export function NoteField({
  testID,
  label,
  value,
  onChange,
  placeholder,
  error,
  long = false,
}: {
  testID?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  /** The main notes: taller, and Return makes a new line instead of closing the keyboard. */
  long?: boolean;
}) {
  return (
    <View>
      <TextInput
        testID={testID}
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline
        error={Boolean(error)}
        style={{ minHeight: long ? 120 : 64 }}
        {...(long ? {} : { returnKeyType: 'done' as const, submitBehavior: 'blurAndSubmit' as const })}
      />
      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

/** Four choices in a row; pressing the chosen one again clears it. */
export function HomeworkStatusPicker({
  value,
  onChange,
  testID = 'homework',
}: {
  value: HomeworkStatus | null;
  onChange: (value: HomeworkStatus | null) => void;
  /** Each choice is `<testID>-<status>`. */
  testID?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="How the homework went"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
    >
      {HOMEWORK_STATUSES.map((status) => {
        const selected = value === status;
        return (
          <Chip
            key={status}
            testID={`${testID}-${status}`}
            icon={HOMEWORK_ICONS[status]}
            selected={selected}
            showSelectedCheck={false}
            mode={selected ? 'flat' : 'outlined'}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              haptics.selection();
              onChange(selected ? null : status);
            }}
          >
            {HOMEWORK_STATUS_LABELS[status]}
          </Chip>
        );
      })}
    </View>
  );
}

/**
 * The capacity the reader would assess in, for wording the question. The API decides the real
 * one; this mirrors it from what the row already says -- `money_view` is 'family' exactly when it
 * is the reader's own or their child's lesson.
 */
export function likelyAssessorRole(
  session: Pick<TutoringSession, 'tutor_user_id' | 'student_user_id' | 'money_view'>,
  user: Pick<User, 'id' | 'roles'>,
): SessionAssessorRole {
  if (session.tutor_user_id === user.id) return 'tutor';
  if (session.student_user_id === user.id) return 'student';
  if (session.money_view === 'family') return 'parent';
  return user.roles.includes('admin') ? 'admin' : 'parent';
}

/** The rating and a few words: the reader's own assessment fields. */
export function AssessmentFields({
  testID = 'assessment',
  role,
  rating,
  onRating,
  body,
  onBody,
  errors,
}: {
  testID?: string;
  role: SessionAssessorRole;
  rating: Rating | null;
  onRating: (value: Rating | null) => void;
  body: string;
  onBody: (value: string) => void;
  errors: { rating?: string; body?: string };
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="bodyMedium">{SESSION_ASSESSMENT_PROMPTS[role]}</Text>
      <RatingPicker
        testID={testID}
        name={SESSION_ASSESSMENT_PROMPTS[role]}
        value={rating}
        onChange={onRating}
        labels={SESSION_RATING_LABELS}
      />
      {rating ? (
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {SESSION_RATING_LABELS[rating]}
        </Text>
      ) : null}
      {errors.rating ? (
        <HelperText type="error" padding="none">
          {errors.rating}
        </HelperText>
      ) : null}
      <NoteField
        testID={`${testID}-body`}
        label="In a few words"
        value={body}
        onChange={onBody}
        placeholder="Optional"
        error={errors.body}
      />
    </View>
  );
}
