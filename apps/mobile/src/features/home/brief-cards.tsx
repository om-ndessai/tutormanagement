// The brief for the next lesson (Phase 43; mockup docs/tutor-home/1): the homework set last time,
// where it is, the next topic on the plan, and the last lesson's assessment notes -- those hidden
// until tapped, since the Tutoring tab is used with the student beside the tutor. No money; no map
// image and no drive time (they would need a Maps key and the phone's location).
import {
  HOMEWORK_STATUS_LABELS,
  SESSION_ASSESSOR_LABELS,
  SESSION_RATING_LABELS,
  TOPIC_RATING_LABELS,
  sortAssessments,
  type TutorHomeBrief,
  type TutorHomeLesson,
} from '@tmi/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { BadgePill } from '@/components/badge-pill';
import { OutlinedCard } from '@/components/outlined-card';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { placeAction, shortDate } from './now-model';
import { openDirections, openMeetingLink } from './place-links';

function BriefCard({
  testID,
  icon,
  title,
  children,
}: {
  testID: string;
  icon: string;
  title: string;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <OutlinedCard testID={testID} style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon source={icon} size={16} color={muted} />
          <Text variant="labelLarge" accessibilityRole="header" style={{ color: muted, letterSpacing: 0.5 }}>
            {title}
          </Text>
        </View>
        {children}
      </View>
    </OutlinedCard>
  );
}

function LinkText({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon source="arrow-top-right" size={16} color={theme.colors.primary} />
      <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function HomeworkCard({ brief, today }: { brief: TutorHomeBrief; today: string }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const assigned = brief.homework?.assigned?.trim();
  const status = brief.homework?.status_before ?? null;
  const date = brief.last_lesson ? ` · ${shortDate(brief.last_lesson.occurred_on, today)}` : '';
  return (
    <BriefCard testID="home-brief-homework" icon="notebook-outline" title={`Homework from last time${date}`}>
      <Text testID="home-brief-homework-text" variant="bodyLarge" style={assigned ? undefined : { color: muted }}>
        {brief.last_lesson
          ? assigned || 'No homework was set last time.'
          : 'No lesson recorded yet, so no homework either.'}
      </Text>
      {status ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Text variant="bodyMedium" style={{ color: muted }}>
            How the one before went
          </Text>
          <BadgePill testID="home-brief-homework-status" label={HOMEWORK_STATUS_LABELS[status]} />
        </View>
      ) : null}
    </BriefCard>
  );
}

function WhereCard({ lesson }: { lesson: TutorHomeLesson }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const place = lesson.place;
  const action = placeAction(place);
  const address = place?.address?.trim();
  return (
    <BriefCard
      testID="home-brief-where"
      icon={place?.kind === 'virtual' ? 'video-outline' : 'map-marker-outline'}
      title="Where"
    >
      {place ? (
        <>
          <Text variant="titleMedium">{place.kind === 'virtual' ? `Online · ${place.name}` : place.name}</Text>
          {address && address !== place.name && action.kind !== 'link' ? (
            <Text variant="bodyMedium" style={{ color: muted }} selectable>
              {address}
            </Text>
          ) : null}
          {action.kind === 'directions' ? (
            <LinkText
              testID="home-brief-maps"
              label="Open in Google Maps"
              onPress={() => openDirections(action.address)}
            />
          ) : action.kind === 'link' ? (
            <LinkText
              testID="home-brief-link"
              label="Open the meeting link"
              onPress={() => openMeetingLink(action.url)}
            />
          ) : null}
        </>
      ) : (
        <Text variant="bodyMedium" style={{ color: muted }}>
          No place is set on the schedule for this lesson.
        </Text>
      )}
    </BriefCard>
  );
}

function openProgress(studentId: string) {
  router.navigate({ pathname: '/progress/[studentId]', params: { studentId } }, { withAnchor: true });
}

function TopicCard({ brief, lesson, today }: { brief: TutorHomeBrief; lesson: TutorHomeLesson; today: string }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const topic = brief.next_topic;
  return (
    <BriefCard testID="home-brief-topic" icon="target" title="Next on the plan">
      {topic ? (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <View
            style={{
              backgroundColor: theme.tokens.muted,
              borderRadius: radius.sm,
              paddingHorizontal: space.sm,
              paddingVertical: 2,
            }}
          >
            <Text testID="home-brief-topic-code" variant="labelLarge" style={{ fontVariant: ['tabular-nums'] }}>
              {topic.code}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text testID="home-brief-topic-name" variant="titleMedium">
              {topic.name}
            </Text>
            {topic.description ? (
              <Text variant="bodyMedium" style={{ color: muted }}>
                {topic.description}
              </Text>
            ) : null}
            <Text testID="home-brief-topic-rating" variant="bodyMedium" style={{ color: muted }}>
              {`${
                topic.current
                  ? `Rated ${topic.current} of 5 (${TOPIC_RATING_LABELS[topic.current]}).`
                  : 'Not rated yet.'
              } The plan's target date is ${shortDate(topic.plan_target_on, today)}.`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: space.xs }}>
          <Text testID="home-brief-topic-none" variant="bodyLarge">
            No plan yet
          </Text>
          <LinkText
            testID="home-brief-topic-progress"
            label="Open Progress"
            onPress={() => openProgress(lesson.student_user_id)}
          />
        </View>
      )}
    </BriefCard>
  );
}

/** The last lesson's assessments the tutor can read: hidden until tapped, hidden again on leaving. */
function NotesCard({ brief }: { brief: TutorHomeBrief }) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const muted = theme.tokens.mutedForeground;
  const [shown, setShown] = useState(false);
  // Home losing focus hides them again: the next time it is opened, a student may be beside it.
  useFocusEffect(useCallback(() => () => setShown(false), []));
  const notes = sortAssessments(brief.assessments);

  let body: ReactNode;
  if (!brief.last_lesson) {
    body = (
      <Text variant="bodyMedium" style={{ color: muted }}>
        No lesson recorded yet.
      </Text>
    );
  } else if (notes.length === 0) {
    body = (
      <Text testID="home-brief-notes-none" variant="bodyMedium" style={{ color: muted }}>
        No assessment notes on the last lesson.
      </Text>
    );
  } else if (!shown) {
    body = (
      <View style={{ gap: space.sm }}>
        {/* Bars where the words are: the words themselves are not on screen, nor read aloud. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 6 }}>
          {['92%', '74%'].map((width) => (
            <View
              key={width}
              style={{ width: width as `${number}%`, height: 12, borderRadius: 6, backgroundColor: theme.tokens.muted }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="bodyMedium" style={{ color: muted, flex: 1 }}>
            Hidden while the screen may be shared.
          </Text>
          <Button
            testID="home-brief-notes-show"
            mode="contained-tonal"
            icon="eye-outline"
            contentStyle={{ minHeight: 44 }}
            onPress={() => {
              haptics.selection();
              setShown(true);
            }}
          >
            Tap to show
          </Button>
        </View>
      </View>
    );
  } else {
    body = (
      <View testID="home-brief-notes-list" style={{ gap: space.md }}>
        {notes.map((note) => (
          <View key={`${note.author_user_id}-${note.author_role}`} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <Text variant="labelLarge">
                {note.author_user_id === user?.id
                  ? 'You'
                  : `${note.author_name} (${SESSION_ASSESSOR_LABELS[note.author_role]})`}
              </Text>
              {note.rating ? <BadgePill label={SESSION_RATING_LABELS[note.rating]} /> : null}
            </View>
            {note.body ? <Text variant="bodyMedium">{note.body}</Text> : null}
          </View>
        ))}
        <Button
          testID="home-brief-notes-hide"
          mode="text"
          icon="eye-off-outline"
          compact
          style={{ alignSelf: 'flex-start' }}
          onPress={() => setShown(false)}
        >
          Hide
        </Button>
      </View>
    );
  }

  return (
    <BriefCard testID="home-brief-notes" icon="comment-text-outline" title="Assessment notes · last lesson">
      {body}
    </BriefCard>
  );
}

export function BriefCards({
  lesson,
  brief,
  today,
}: {
  lesson: TutorHomeLesson;
  brief: TutorHomeBrief;
  today: string;
}) {
  return (
    <View testID="home-brief" style={{ gap: space.md }}>
      <HomeworkCard brief={brief} today={today} />
      <WhereCard lesson={lesson} />
      <TopicCard brief={brief} lesson={lesson} today={today} />
      <NotesCard brief={brief} />
    </View>
  );
}
