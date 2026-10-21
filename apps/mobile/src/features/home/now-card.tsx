// The "Now" card at the top of a tutor's Home (Phase 43; mockups docs/tutor-home/1-3): a finished
// lesson to celebrate and record, or the personal message about the next lesson. No money: it leads
// the Tutoring tab, which a tutor may have open beside a student.
import type { PartOfDay, TutorHomeBrief, TutorHomeLesson } from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { haptics } from '@/lib/haptics';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { markLessonCelebrated } from './celebrated-lessons';
import { Confetti } from './confetti';
import { putOff } from './later';
import {
  briefSentence,
  canStartNow,
  celebrateHeadline,
  endedLine,
  homeworkReviewPrefill,
  lessonKey,
  nextHeadline,
  nowGreeting,
  placeAction,
  togetherLine,
  type UnrecordedLesson,
} from './now-model';
import { openDirections, openMeetingLink } from './place-links';

/** The record-as-planned sheet for this lesson, filled in from its schedule (mockup 4). */
export function recordUnrecordedHref(lesson: UnrecordedLesson, tutorUserId: string | undefined) {
  const homework = homeworkReviewPrefill(lesson.homework_last);
  return {
    pathname: '/record-as-planned' as const,
    params: {
      student: lesson.student_user_id,
      ...(tutorUserId ? { tutor: tutorUserId } : {}),
      date: lesson.occurs_on,
      start: lesson.start_time,
      end: lesson.end_time,
      mode: lesson.mode,
      ...(lesson.place ? { place: lesson.place.name } : {}),
      ...(homework ? { homework } : {}),
    },
  };
}

function CardFrame({
  testID,
  background,
  children,
  overlay,
}: {
  testID: string;
  background: string;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <View
      testID={testID}
      style={{
        borderRadius: radius.xl,
        backgroundColor: background,
        padding: space.lg,
        gap: space.md,
        overflow: 'hidden',
      }}
    >
      {children}
      {overlay}
    </View>
  );
}

/** Mockup 3: "Yay! You completed one more lesson with Sofia", once with confetti. */
export function CelebrateCard({ lesson, today }: { lesson: UnrecordedLesson; today: string }) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const ink = theme.tokens.successForeground;
  const key = lessonKey(lesson);
  const [confetti, setConfetti] = useState(false);

  // Once per lesson per device: the confetti and a success haptic, the first time it is shown here.
  useEffect(() => {
    let live = true;
    void markLessonCelebrated(key).then((fresh) => {
      if (!live || !fresh) return;
      setConfetti(true);
      haptics.success();
    });
    return () => {
      live = false;
    };
  }, [key]);

  return (
    <CardFrame
      testID="home-now-celebrate"
      background={theme.tokens.success}
      overlay={confetti ? <Confetti testID="home-now-confetti" seed={key.length} /> : null}
    >
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Icon source="party-popper" size={36} color={ink} />
        <Text
          testID="home-now-celebrate-title"
          variant="titleLarge"
          accessibilityRole="header"
          style={{ color: ink, textAlign: 'center' }}
        >
          {celebrateHeadline(lesson)}
        </Text>
        <Text
          testID="home-now-celebrate-detail"
          variant="bodyMedium"
          style={{ color: ink, textAlign: 'center', opacity: 0.92 }}
        >
          {`${togetherLine(lesson, today)} ${endedLine(lesson, today)} Record it while it's fresh.`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          testID="home-now-record"
          mode="contained"
          buttonColor={ink}
          textColor={theme.tokens.success}
          style={{ flex: 1 }}
          contentStyle={{ minHeight: 48 }}
          onPress={() => {
            haptics.selection();
            router.navigate(recordUnrecordedHref(lesson, user?.id));
          }}
        >
          Record it now
        </Button>
        <Button
          testID="home-now-later"
          mode="contained"
          buttonColor={withAlpha(ink, 0.18)}
          textColor={ink}
          style={{ flex: 1 }}
          contentStyle={{ minHeight: 48 }}
          onPress={() => {
            haptics.selection();
            putOff(key);
          }}
        >
          Later
        </Button>
      </View>
    </CardFrame>
  );
}

function Chip({ icon, label, testID, ink }: { icon: string; label: string; testID: string; ink: string }) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        maxWidth: '100%',
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        backgroundColor: withAlpha(ink, 0.16),
      }}
    >
      <Icon source={icon} size={16} color={ink} />
      <Text variant="labelLarge" numberOfLines={1} style={{ color: ink, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

/** Mockups 1 and 2: the personal message about the next lesson, with what to do about it. */
export function NextCard({
  lesson,
  brief,
  part,
  today,
  nowMinutes,
}: {
  lesson: TutorHomeLesson;
  brief: TutorHomeBrief | null;
  part: PartOfDay;
  today: string;
  nowMinutes: number;
}) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const ink = theme.tokens.primaryForeground;
  const sentence = briefSentence(lesson, brief);
  const place = placeAction(lesson.place);
  const startable = canStartNow(lesson, today, nowMinutes);
  const homework = brief?.homework?.assigned?.trim();
  const topic = brief?.next_topic;

  return (
    <CardFrame testID="home-now-next" background={theme.colors.primary}>
      <View style={{ gap: space.xs }}>
        <Text testID="home-now-greeting" variant="labelLarge" style={{ color: ink, letterSpacing: 0.6, opacity: 0.9 }}>
          {nowGreeting(part, user?.full_name)}
        </Text>
        <Text testID="home-now-headline" variant="titleLarge" accessibilityRole="header" style={{ color: ink }}>
          {nextHeadline(lesson, today, nowMinutes)}
        </Text>
        {sentence ? (
          <Text testID="home-now-sentence" variant="bodyMedium" style={{ color: ink, opacity: 0.92 }}>
            {sentence}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {lesson.place ? (
          <Chip
            testID="home-now-chip-place"
            ink={ink}
            icon={lesson.place.kind === 'virtual' ? 'video-outline' : 'map-marker-outline'}
            label={lesson.place.name}
          />
        ) : null}
        <Chip
          testID="home-now-chip-homework"
          ink={ink}
          icon="notebook-outline"
          label={homework ? `Homework: ${homework}` : 'No homework set'}
        />
        {topic ? (
          <Chip testID="home-now-chip-topic" ink={ink} icon="target" label={`${topic.name} next`} />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {place.kind === 'directions' ? (
          <Button
            testID="home-now-directions"
            mode="contained"
            icon="arrow-top-right"
            buttonColor={ink}
            textColor={theme.colors.primary}
            style={{ flex: 1 }}
            contentStyle={{ minHeight: 48 }}
            onPress={() => openDirections(place.address)}
          >
            Directions
          </Button>
        ) : place.kind === 'link' ? (
          <Button
            testID="home-now-link"
            mode="contained"
            icon="arrow-top-right"
            buttonColor={ink}
            textColor={theme.colors.primary}
            style={{ flex: 1 }}
            contentStyle={{ minHeight: 48 }}
            onPress={() => openMeetingLink(place.url)}
          >
            Open the link
          </Button>
        ) : null}
        {startable ? (
          <Button
            testID="home-now-start"
            mode="contained"
            icon="play"
            buttonColor={withAlpha(ink, 0.2)}
            textColor={ink}
            style={{ flex: 1 }}
            contentStyle={{ minHeight: 48 }}
            onPress={() => {
              haptics.selection();
              router.navigate({
                pathname: '/start-lesson',
                params: { student: lesson.student_user_id, mode: lesson.mode },
              });
            }}
          >
            Start lesson
          </Button>
        ) : (
          <Button
            testID="home-now-plan"
            mode="contained"
            buttonColor={withAlpha(ink, 0.2)}
            textColor={ink}
            style={{ flex: 1 }}
            contentStyle={{ minHeight: 48 }}
            onPress={() =>
              router.navigate(
                { pathname: '/progress/[studentId]', params: { studentId: lesson.student_user_id } },
                { withAnchor: true },
              )
            }
          >
            See the plan
          </Button>
        )}
      </View>
    </CardFrame>
  );
}
