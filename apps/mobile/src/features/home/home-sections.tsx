// The member home's sections (Phase 66, H3): one per hat, in `orderHats` order, titled
// `HOME_HAT_LABELS[hat]` (`home-section-<hat>`). Tutor: the next lesson and its brief (Phase 43), what is
// left to record, reviews waiting and the week. Office: what needs it and the way to the dashboards.
// Parent: a card per child. Learner: their next lesson, the Play home and the Assessment home. No money
// on any of them: a parent's balances are on the Dashboard (More), never here.
//
// Phase 74 (docs/journey-fixes-plan.md, owner 2026-11-05): the office lists only what is above zero -- lessons to
// record, invitations not yet accepted, people asking to join, assessments not yet reviewed (a link to Assessments) --
// and with none, one line, "Nothing needs you right now." (JF6); a child's card where Tutoring is off opens the child
// (`/people/[id]`); lesson lines say where (JF17), and a tap on the learner's lesson line starts practice for it where
// Quest is on; the board is told what Next up shows, so its own Daily or Continue is the quiet twin (JF23).
//
// Phase 77 (JF15, owner 2026-11-05): a child's "Play with" plays at the child's grade; a child who signs in is invited
// online as before, one who does not plays on this device ("Play with Ben on this device", a seated game begun at
// once; under "Practise together …", "Ben plays beside you, on this device."), and "Continue with Ben"
// (`home-child-continue-<id>`) reopens the one still running. The web's words.
import {
  featureOn,
  HOME_HAT_LABELS,
  lessonDayWords,
  playTogetherRequest,
  practiseRequest,
  type HomeChild,
  type MemberTile,
  type HomeHat,
  type MemberHome,
  type NextUp,
} from '@tmi/shared';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { TourTarget } from '@/features/onboarding/tour-targets';
import { AssessmentHome } from '@/features/dashboard/assessment-home';
import { useMemberTiles } from '@/features/play/play-api';
import { PlayHome, openGameFromHome, useStartQuest } from '@/features/play/play-home';
import { haptics } from '@/lib/haptics';
import { draftSavedLine } from '@/features/teaching/lessons-owed-model';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import {
  capitalise,
  CHILD_OFF_LINE,
  childCardFallback,
  childPlayHint,
  childPlayLabel,
  childPlayLevel,
  childPlayedLine,
  firstOf,
  learnerEmptyLine,
  learnerSectionParts,
  lessonWithStudent,
  lessonWithTutor,
  nextUpShowsLesson,
  OFFICE_NOTHING_LINE,
  officeNeeds,
  openAssessmentsLine,
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
  const timeZone = useOrgTimeZone();
  const tutor = home.tutor!;
  const more = tutor.to_record_count - tutor.to_record.length;
  return (
    <Section hat="tutor">
      <TutorNow now={tutor.now} hideCard={nextUpShowsLesson(item, tutor.now.next)} />
      {tutor.to_record.length > 0 ? (
        <TourTarget id="home-to-record">
          <Card testID="home-to-record">
            <Text variant="titleSmall" accessibilityRole="header">
              To record
            </Text>
            {tutor.to_record.map((lesson) => {
              const row = `home-to-record-${lesson.schedule_id}-${lesson.occurs_on}`;
              // Phase 75 (JF19): the reader's draft of it is continued from here, never started again.
              const draft = lesson.draft ?? null;
              return (
                <View key={row} testID={row} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyMedium">{capitalise(lessonWithStudent(lesson, home.day))}</Text>
                    {draft ? (
                      <Muted testID={`${row}-draft`}>{draftSavedLine(draft, timeZone, home.day)}</Muted>
                    ) : null}
                  </View>
                  <Button
                    testID={`${row}-record`}
                    mode="contained-tonal"
                    compact
                    contentStyle={{ minHeight: 40 }}
                    onPress={() => {
                      haptics.selection();
                      router.navigate(recordUnrecordedHref(lesson, user?.id));
                    }}
                  >
                    {draft ? 'Continue' : 'Record'}
                  </Button>
                </View>
              );
            })}
            {/* Phase 75 (JF30): the whole list of lessons still owed, each with Record. */}
            {more > 0 ? (
              <LinkRow testID="home-to-record-more" label={`+${more} more`} to="/lessons-owed" icon="dots-horizontal" />
            ) : null}
          </Card>
        </TourTarget>
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
  const needs = officeNeeds(office, tutoring);
  return (
    <Section hat="office">
      <Card testID="home-office">
        {/* Phase 74 (JF6): each count above zero once; with none, one line rather than a column of zeros. */}
        {needs.nothing ? <Muted testID="home-office-nothing">{OFFICE_NOTHING_LINE}</Muted> : null}
        {needs.toRecord ? (
          <LinkRow
            testID="home-office-to-record"
            label={`${plural(office.to_record_count, 'lesson')} to record`}
            to="/lessons-owed"
            icon="pencil-outline"
          />
        ) : null}
        {needs.toRecord
          ? office.to_record.slice(0, 3).map((row, index) => (
              <Muted key={`${row.occurs_on}-${row.start_time}-${index}`} testID={`home-office-to-record-line-${index}`}>
                {`${capitalise(whenWords(row, home.day))} · ${firstOf(row.student_name)} with ${firstOf(row.tutor_name)}`}
              </Muted>
            ))
          : null}
        {needs.invitations ? (
          <LinkRow
            testID="home-office-invitations"
            label={`${plural(office.invitations, 'invitation')} not yet accepted`}
            to="/people"
            icon="email-outline"
          />
        ) : null}
        {needs.requests ? (
          <LinkRow
            testID="home-office-requests"
            label={`${office.join_requests} asking to join`}
            to="/people"
            icon="account-plus-outline"
          />
        ) : null}
        {needs.assessments ? (
          <LinkRow
            testID="home-office-assessments"
            label={openAssessmentsLine(office.assessments_open!)}
            to="/assessments"
            icon="clipboard-check-outline"
          />
        ) : null}
        {tutoring ? (
          <LinkRow
            testID="home-dashboard-link"
            label="Open the dashboard"
            to="/analytics"
            icon="view-dashboard-outline"
          />
        ) : null}
      </Card>
      {assessment ? <AssessmentHome /> : null}
    </Section>
  );
}

function ChildCard({
  child,
  today,
  tutoring,
  quest,
  assessment,
  tiles,
  start,
  pending,
}: {
  child: HomeChild;
  today: string;
  tutoring: boolean;
  quest: boolean;
  assessment: boolean;
  tiles: readonly MemberTile[];
  start: ReturnType<typeof useStartQuest>['start'];
  pending: boolean;
}) {
  const theme = useAppTheme();
  const id = child.student_user_id;
  // Phase 68 (H10): what the child played this week (counts only, R29), and "Play with <child>" -- one tap.
  // Phase 77 (JF15): at the child's grade (the board's rules), else their last level, else this space's first tile;
  // a child who signs in is invited online (a game of two), one who does not plays beside the parent on this device
  // (`playTogetherRequest`: a seated game, begun at once), and "Continue with Ben" reopens the one still running.
  const played = quest ? childPlayedLine(child) : null;
  const playLevel = quest ? childPlayLevel(child, tiles) : null;
  const continueGame = quest ? (child.open_game_id ?? null) : null;
  const playHint = quest ? childPlayHint(child, today) : null;
  // With Tutoring and Quest off there are no lessons or quests to show: Assessments, else a word (as the web).
  const fallback = childCardFallback({ tutoring, quest, assessment });
  return (
    <OutlinedCard testID={`home-child-${id}`} style={{ borderRadius: radius.lg }}>
      {/* Progress and lessons are Tutoring's (that route answers 403 without it): there the card opens the child's
          own page instead (Phase 74, JF6) -- the parent's way to their child, as Users is not in their menu. */}
      <Pressable
        testID={`home-child-link-${id}`}
        accessibilityRole="button"
        accessibilityLabel={tutoring ? `${child.first_name}'s progress` : child.first_name}
        onPress={() => {
          haptics.selection();
          if (tutoring) {
            router.navigate({ pathname: '/progress/[studentId]', params: { studentId: id } }, { withAnchor: true });
          } else {
            router.navigate({ pathname: '/people/[id]', params: { id } });
          }
        }}
        style={({ pressed }) => ({ padding: space.lg, gap: space.xs, opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>
            {child.first_name}
          </Text>
          <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
        </View>
        {tutoring ? (
          <Text testID={`home-child-next-${id}`} variant="bodyMedium">
            {child.next_lesson ? `Next: ${lessonWithTutor(child.next_lesson, today)}` : 'No lessons scheduled'}
          </Text>
        ) : null}
        {child.cancelled ? (
          <Text testID={`home-child-cancelled-${id}`} variant="bodyMedium" style={{ color: theme.colors.error }}>
            {`Cancelled: ${whenWords(child.cancelled, today)} with ${firstOf(child.cancelled.tutor_name)}`}
          </Text>
        ) : null}
        {child.homework ? <Muted testID={`home-child-homework-${id}`}>{`Homework: ${child.homework}`}</Muted> : null}
        {tutoring ? (
          <Muted testID={`home-child-month-${id}`}>{`${plural(child.lessons_this_month, 'lesson')} this month`}</Muted>
        ) : null}
        {played ? <Muted testID={`home-child-played-${id}`}>{played}</Muted> : null}
        {fallback === 'off' ? <Muted testID={`home-child-off-${id}`}>{CHILD_OFF_LINE}</Muted> : null}
      </Pressable>
      {fallback === 'assessments' ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, flexDirection: 'row' }}>
          <Button
            testID={`home-child-assessments-${id}`}
            mode="outlined"
            icon="draw-pen"
            contentStyle={{ minHeight: MIN_TARGET }}
            onPress={() => {
              haptics.selection();
              router.navigate('/assessments');
            }}
          >
            Assessments
          </Button>
        </View>
      ) : null}
      {continueGame ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, flexDirection: 'row' }}>
          <Button
            testID={`home-child-continue-${id}`}
            mode="contained-tonal"
            icon="play-circle-outline"
            contentStyle={{ minHeight: MIN_TARGET }}
            onPress={() => {
              haptics.selection();
              openGameFromHome(continueGame);
            }}
          >
            {childPlayLabel(child, today)}
          </Button>
        </View>
      ) : playLevel ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs }}>
          <View style={{ flexDirection: 'row' }}>
            <Button
              testID={`home-child-play-${id}`}
              mode="contained-tonal"
              icon="account-multiple-outline"
              disabled={pending}
              contentStyle={{ minHeight: MIN_TARGET }}
              onPress={() => void start(playTogetherRequest(child, playLevel))}
            >
              {childPlayLabel(child, today)}
            </Button>
          </View>
          {playHint ? <Muted testID={`home-child-on-device-${id}`}>{playHint}</Muted> : null}
        </View>
      ) : null}
    </OutlinedCard>
  );
}

const NO_TILES: readonly MemberTile[] = [];

function ParentSection({
  home,
  assessment,
  quest,
  tutoring,
  assessmentOn,
}: {
  home: MemberHome;
  assessment: boolean;
  quest: boolean;
  tutoring: boolean;
  assessmentOn: boolean;
}) {
  const children = home.parent?.children ?? [];
  const tilesRead = useMemberTiles(quest && children.length > 0);
  const tiles = tilesRead.data?.data.tiles ?? NO_TILES;
  const { start, pending } = useStartQuest();
  return (
    <TourTarget id="home-section-parent">
      <Section hat="parent">
        {/* A parent whose child the space has not added yet: the hat their role implies, empty. */}
        {children.length === 0 ? (
          <Card testID="home-children-empty">
            <Muted>No children here yet. Once the space adds your child, their lessons and homework show here.</Muted>
          </Card>
        ) : null}
        {children.map((child) => (
          <ChildCard
            key={child.student_user_id}
            child={child}
            today={home.day}
            tutoring={tutoring}
            quest={quest}
            assessment={assessmentOn}
            tiles={tiles}
            start={start}
            pending={pending}
          />
        ))}
        {assessment ? <AssessmentHome /> : null}
      </Section>
    </TourTarget>
  );
}

function LearnerSection({
  home,
  item,
  quest,
  assessment,
  assessmentOn,
  practiceLevelId,
}: {
  home: MemberHome;
  item: NextUp | null;
  quest: boolean;
  assessment: boolean;
  /** Assessment is on in this space (whether or not this reader has anyone to assess): says which set is off. */
  assessmentOn: boolean;
  practiceLevelId: string | null;
}) {
  const theme = useAppTheme();
  const { start, pending } = useStartQuest();
  // Next up already names the lesson when it is the learner's next lesson: not twice. With nothing at all
  // (no lesson shown, Quest and Assessment off), one muted line rather than an empty heading.
  const { next, empty } = learnerSectionParts(home.learner?.next_lesson, item, { quest, assessment });
  // Phase 74 (JF17): a tap on the lesson line starts five questions for it, where Quest is on.
  const practise = quest && practiceLevelId ? practiceLevelId : null;
  return (
    <Section hat="learner">
      {empty ? <Muted testID="home-learner-empty">{learnerEmptyLine(assessmentOn)}</Muted> : null}
      {next ? (
        <Card testID="home-learner-next-card">
          <Muted>Your next lesson</Muted>
          <Pressable
            testID="home-learner-next-line"
            accessibilityRole={practise ? 'button' : undefined}
            accessibilityHint={practise ? `Practise five questions before ${lessonDayWords(next.occurs_on, home.day)}` : undefined}
            disabled={!practise || pending}
            onPress={() => practise && void start(practiseRequest(practise))}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              minHeight: MIN_TARGET,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text testID="home-learner-next" variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>
              {capitalise(lessonWithTutor(next, home.day))}
            </Text>
            {practise ? <Icon source="target" size={20} color={theme.colors.primary} /> : null}
          </Pressable>
          {practise ? <Muted testID="home-learner-practise">Tap to practise five questions for it.</Muted> : null}
        </Card>
      ) : null}
      {/* Phase 68 (H4): an assessment-led home puts Assessments before the Quest board. */}
      {assessment && home.focus === 'assessment' ? <AssessmentHome /> : null}
      {/* Phase 74: the band's Play door scrolls here; the board is told what Next up shows (JF23). */}
      {quest ? (
        <TourTarget id="home-board">
          <PlayHome nextUp={item?.kind ?? null} />
        </TourTarget>
      ) : null}
      {assessment && home.focus !== 'assessment' ? <AssessmentHome /> : null}
    </Section>
  );
}

/**
 * The sections, in the hats' order. The Assessment home appears once: with the learner, else (where
 * Tutoring is off, as the Phase 50 space home had it) with the first of the office's and the parent's.
 * Phase 79 (M6): with the learner only while the reader has someone to assess here (`may_assess`, absent from older
 * Workers: true) -- a member of a shared space plays Quest, and their home is the board alone.
 */
export function HomeSections({
  home,
  hats,
  item,
  practiceLevelId = null,
}: {
  home: MemberHome;
  hats: HomeHat[];
  item: NextUp | null;
  /** Phase 74: where the learner's practice for a lesson starts (Next up's lead level). */
  practiceLevelId?: string | null;
}) {
  const { organization } = useAuth();
  const quest = featureOn(organization, 'quest');
  const assessmentOn = featureOn(organization, 'assessment');
  const tutoring = featureOn(organization, 'tutoring');
  const assessmentHat: HomeHat | undefined = !assessmentOn
    ? undefined
    : hats.includes('learner') && home.may_assess !== false
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
            return home.parent ? (
              <ParentSection
                key={hat}
                home={home}
                assessment={assessmentHat === 'parent'}
                quest={quest}
                tutoring={tutoring}
                assessmentOn={assessmentOn}
              />
            ) : null;
          case 'learner':
            return (
              <LearnerSection
                key={hat}
                home={home}
                item={item}
                quest={quest}
                assessment={assessmentHat === 'learner'}
                assessmentOn={assessmentOn}
                practiceLevelId={practiceLevelId}
              />
            );
        }
      })}
    </>
  );
}
