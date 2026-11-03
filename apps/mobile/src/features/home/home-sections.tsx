// The member home's sections (Phase 66, H3): one per hat, in `orderHats` order, titled
// `HOME_HAT_LABELS[hat]` (`home-section-<hat>`). Tutor: the next lesson and its brief (Phase 43), what is
// left to record, reviews waiting and the week. Office: what needs it and the way to the dashboards.
// Parent: a card per child. Learner: their next lesson, the Play home and the Assessment home. No money
// on any of them: a parent's balances are on the Dashboard (More), never here.
import {
  featureOn,
  HOME_HAT_LABELS,
  type HomeChild,
  type HomeHat,
  type MemberHome,
  type NextUp,
} from '@tmi/shared';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { AssessmentHome } from '@/features/dashboard/assessment-home';
import { PlayHome } from '@/features/play/play-home';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import {
  capitalise,
  firstOf,
  lessonWithStudent,
  lessonWithTutor,
  nextUpShowsLesson,
  reviewsLine,
  whenWords,
} from './member-home-model';
import { recordUnrecordedHref } from './now-card';
import { TutorNow } from './tutor-now';

function Section({ hat, children }: { hat: HomeHat; children: ReactNode }) {
  return (
    <View testID={`home-section-${hat}`} collapsable={false} style={{ gap: space.md }}>
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '700' }}>
        {HOME_HAT_LABELS[hat]}
      </Text>
      {children}
    </View>
  );
}

/** A tappable line: "24 lessons to record →". */
function LinkRow({ testID, label, to, icon }: { testID: string; label: string; to: Href; icon: string }) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        router.navigate(to);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: MIN_TARGET,
        paddingVertical: space.xs,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon source={icon} size={20} color={theme.colors.primary} />
      <Text variant="bodyLarge" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
    </Pressable>
  );
}

function Card({ testID, children }: { testID?: string; children: ReactNode }) {
  return (
    <OutlinedCard testID={testID} style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.sm }}>{children}</View>
    </OutlinedCard>
  );
}

function Muted({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useAppTheme();
  return (
    <Text testID={testID} variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
      {children}
    </Text>
  );
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function TutorSection({ home, item }: { home: MemberHome; item: NextUp | null }) {
  const { user } = useAuth();
  const tutor = home.tutor!;
  const more = tutor.to_record_count - tutor.to_record.length;
  return (
    <Section hat="tutor">
      <TutorNow now={tutor.now} hideCard={nextUpShowsLesson(item, tutor.now.next)} />
      {tutor.to_record.length > 0 ? (
        <Card testID="home-to-record">
          <Text variant="titleSmall" accessibilityRole="header">
            To record
          </Text>
          {tutor.to_record.map((lesson) => (
            <View
              key={`${lesson.schedule_id}-${lesson.occurs_on}`}
              testID={`home-to-record-${lesson.schedule_id}-${lesson.occurs_on}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Text variant="bodyMedium" style={{ flex: 1 }}>
                {capitalise(lessonWithStudent(lesson, home.day))}
              </Text>
              <Button
                testID={`home-to-record-${lesson.schedule_id}-${lesson.occurs_on}-record`}
                mode="contained-tonal"
                compact
                contentStyle={{ minHeight: 40 }}
                onPress={() => {
                  haptics.selection();
                  router.navigate(recordUnrecordedHref(lesson, user?.id));
                }}
              >
                Record
              </Button>
            </View>
          ))}
          {more > 0 ? (
            <LinkRow testID="home-to-record-more" label={`+${more} more`} to="/sessions" icon="dots-horizontal" />
          ) : null}
        </Card>
      ) : null}
      {tutor.reviews.assessments > 0 ? (
        <LinkRow
          testID="home-tutor-reviews-assessments"
          label={reviewsLine(tutor.reviews.assessments, 0)}
          to="/assessments"
          icon="clipboard-check-outline"
        />
      ) : null}
      {tutor.reviews.quest > 0 ? (
        <LinkRow
          testID="home-tutor-reviews-quest"
          label={reviewsLine(0, tutor.reviews.quest)}
          to="/quest/review"
          icon="trophy-outline"
        />
      ) : null}
      <Muted testID="home-tutor-week">{`This week: ${plural(tutor.lessons_this_week, 'lesson')}`}</Muted>
    </Section>
  );
}

function OfficeSection({ home, assessment }: { home: MemberHome; assessment: boolean }) {
  const { organization } = useAuth();
  const office = home.office!;
  const tutoring = featureOn(organization, 'tutoring');
  return (
    <Section hat="office">
      <Card>
        {tutoring ? (
          <LinkRow
            testID="home-office-to-record"
            label={office.to_record_count > 0 ? `${plural(office.to_record_count, 'lesson')} to record` : 'Every lesson is recorded'}
            to="/sessions"
            icon="pencil-outline"
          />
        ) : null}
        {tutoring
          ? office.to_record.slice(0, 3).map((row, index) => (
              <Muted key={`${row.occurs_on}-${row.start_time}-${index}`} testID={`home-office-to-record-line-${index}`}>
                {`${capitalise(whenWords(row, home.day))} · ${firstOf(row.student_name)} with ${firstOf(row.tutor_name)}`}
              </Muted>
            ))
          : null}
        <LinkRow
          testID="home-office-invitations"
          label={`${plural(office.invitations, 'invitation')} not yet accepted`}
          to="/people"
          icon="email-outline"
        />
        <LinkRow
          testID="home-office-requests"
          label={`${office.join_requests} asking to join`}
          to="/people"
          icon="account-plus-outline"
        />
        {tutoring ? (
          <LinkRow testID="home-dashboard-link" label="Open the dashboard" to="/analytics" icon="view-dashboard-outline" />
        ) : null}
      </Card>
      {assessment ? <AssessmentHome /> : null}
    </Section>
  );
}

function ChildCard({ child, today }: { child: HomeChild; today: string }) {
  const theme = useAppTheme();
  const id = child.student_user_id;
  return (
    <OutlinedCard testID={`home-child-${id}`} style={{ borderRadius: radius.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${child.first_name}'s progress`}
        onPress={() => {
          haptics.selection();
          router.navigate({ pathname: '/progress/[studentId]', params: { studentId: id } }, { withAnchor: true });
        }}
        style={({ pressed }) => ({ padding: space.lg, gap: space.xs, opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>
            {child.first_name}
          </Text>
          <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
        </View>
        <Text testID={`home-child-next-${id}`} variant="bodyMedium">
          {child.next_lesson ? `Next: ${lessonWithTutor(child.next_lesson, today)}` : 'No lessons scheduled'}
        </Text>
        {child.cancelled ? (
          <Text testID={`home-child-cancelled-${id}`} variant="bodyMedium" style={{ color: theme.colors.error }}>
            {`Cancelled: ${whenWords(child.cancelled, today)} with ${firstOf(child.cancelled.tutor_name)}`}
          </Text>
        ) : null}
        {child.homework ? <Muted testID={`home-child-homework-${id}`}>{`Homework: ${child.homework}`}</Muted> : null}
        <Muted testID={`home-child-month-${id}`}>{`${plural(child.lessons_this_month, 'lesson')} this month`}</Muted>
      </Pressable>
    </OutlinedCard>
  );
}

function ParentSection({ home, assessment }: { home: MemberHome; assessment: boolean }) {
  const children = home.parent?.children ?? [];
  return (
    <Section hat="parent">
      {/* A parent whose child the space has not added yet: the hat their role implies, empty. */}
      {children.length === 0 ? (
        <Card testID="home-children-empty">
          <Muted>No children here yet. Once the space adds your child, their lessons and homework show here.</Muted>
        </Card>
      ) : null}
      {children.map((child) => (
        <ChildCard key={child.student_user_id} child={child} today={home.day} />
      ))}
      {assessment ? <AssessmentHome /> : null}
    </Section>
  );
}

function LearnerSection({ home, quest, assessment }: { home: MemberHome; quest: boolean; assessment: boolean }) {
  const next = home.learner?.next_lesson;
  return (
    <Section hat="learner">
      {next ? (
        <Card testID="home-learner-next-card">
          <Muted>Your next lesson</Muted>
          <Text testID="home-learner-next" variant="titleMedium" style={{ fontWeight: '700' }}>
            {capitalise(lessonWithTutor(next, home.day))}
          </Text>
        </Card>
      ) : null}
      {quest ? <PlayHome /> : null}
      {assessment ? <AssessmentHome /> : null}
    </Section>
  );
}

/**
 * The sections, in the hats' order. The Assessment home appears once: with the learner, else (where
 * Tutoring is off, as the Phase 50 space home had it) with the first of the office's and the parent's.
 */
export function HomeSections({ home, hats, item }: { home: MemberHome; hats: HomeHat[]; item: NextUp | null }) {
  const { organization } = useAuth();
  const quest = featureOn(organization, 'quest');
  const assessmentOn = featureOn(organization, 'assessment');
  const tutoring = featureOn(organization, 'tutoring');
  const assessmentHat: HomeHat | undefined = !assessmentOn
    ? undefined
    : hats.includes('learner')
      ? 'learner'
      : tutoring
        ? undefined
        : hats.find((hat) => hat === 'office' || hat === 'parent');
  return (
    <>
      {hats.map((hat) => {
        switch (hat) {
          case 'tutor':
            return home.tutor ? <TutorSection key={hat} home={home} item={item} /> : null;
          case 'office':
            return home.office ? <OfficeSection key={hat} home={home} assessment={assessmentHat === 'office'} /> : null;
          case 'parent':
            return home.parent ? <ParentSection key={hat} home={home} assessment={assessmentHat === 'parent'} /> : null;
          case 'learner':
            return <LearnerSection key={hat} home={home} quest={quest} assessment={assessmentHat === 'learner'} />;
        }
      })}
    </>
  );
}
