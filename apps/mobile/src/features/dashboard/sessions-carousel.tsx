// Ported from apps/web/src/features/dashboard/sessions-carousel.tsx @ 1132322
import {
  SESSION_MODE_LABELS,
  formatClockTime,
  formatDuration,
  formatMinutesOfDay,
  parseClockTime,
  zonedClockParts,
  type TutoringSession,
  type UpcomingSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { EmptyNote } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { useUpcomingSessions } from '@/features/schedules/api';
import { formatLessonDay } from '@/features/schedules/lesson-cancellation';
import { useActiveSession } from '@/features/teaching/api';
import { useLines } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import {
  GAP,
  buildCarousel,
  carouselOffsets,
  carouselWidths,
  countdown,
  nearestIndex,
  occurrenceKey,
  relativeDay,
  type CarouselItem,
} from './carousel-model';
import { cancelHref, nextUpActions, recordHref, startHref, type NextUpActions } from './next-up-actions';

/** The organization's clock, re-read every half minute so the countdown stays true. */
function useOrgClock() {
  const timeZone = useOrgTimeZone();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return zonedClockParts(now.toISOString(), timeZone);
}

const CARD_HEIGHT = 150;

/**
 * The dashboard's lessons, as one strip (Phase 21): the last few taught on the left, "Now", then
 * what the schedules say is coming. It opens with the next lesson centred, or "Now" when nothing
 * is scheduled, and each card snaps to the middle. The last card pulls in five more.
 *
 * Nothing here carries money: it sits on the Tutoring tab, which a tutor may have open beside a
 * student.
 */
export function SessionsCarousel({
  past,
  tutorUserId,
  showTutor,
}: {
  /** Newest first, as the API returns them. */
  past: TutoringSession[];
  /** Narrows the upcoming lessons to one tutor's teaching. */
  tutorUserId?: string;
  showTutor: boolean;
}) {
  const theme = useAppTheme();
  const clock = useOrgClock();
  const { user } = useAuth();
  // Who may schedule goes straight to Schedule a lesson (UI upgrades U5); anyone else to the page.
  const mayScheduleHere = user?.roles.some((role) => role === 'admin' || role === 'tutor') ?? false;
  const upcoming = useUpcomingSessions(tutorUserId);
  const list = useRef<FlatList<CarouselItem>>(null);
  const placed = useRef(false);
  const settled = useRef(-1);
  const [viewport, setViewport] = useState(0);
  const { fontScale } = useWindowDimensions();
  const widths = useMemo(
    () => carouselWidths(fontScale, viewport > 0 ? viewport : Infinity),
    [fontScale, viewport],
  );
  // Cards keep their height floor, and grow from it with the text.
  const cardHeight = Math.round(CARD_HEIGHT * Math.min(Math.max(fontScale, 1), 2));

  const next = useMemo(() => upcoming.data?.pages.flatMap((page) => page.data) ?? [], [upcoming.data]);
  const { items, anchorIndex, empty } = buildCarousel({
    past,
    upcoming: next,
    pending: upcoming.isPending,
    hasMore: Boolean(upcoming.hasNextPage),
    fetchingMore: upcoming.isFetchingNextPage,
    widths,
  });
  // The strip bleeds to the screen's edges, past the page's padding.
  const listWidth = viewport + space.lg * 2;
  const { padding, offsets } = carouselOffsets(items, listWidth, widths.next);

  // Centre the next lesson (or "Now") once the first page is in, and never yank the strip after.
  const anchorOffset = offsets[anchorIndex] ?? 0;
  useEffect(() => {
    if (placed.current || upcoming.isPending || viewport === 0) return;
    placed.current = true;
    settled.current = anchorIndex;
    // After the cards have laid out.
    requestAnimationFrame(() => list.current?.scrollToOffset({ offset: anchorOffset, animated: false }));
  }, [upcoming.isPending, viewport, anchorOffset, anchorIndex]);

  if (empty) {
    return <EmptyNote testID="sessions-carousel-empty">No lessons recorded or scheduled yet.</EmptyNote>;
  }

  function renderItem({ item }: { item: CarouselItem }) {
    switch (item.kind) {
      case 'past':
        return (
          <PastCard
            session={item.session}
            today={clock.day}
            showTutor={showTutor}
            width={item.width}
            height={cardHeight}
          />
        );
      case 'past-empty':
        return <NoteCard width={item.width} height={cardHeight} text="No sessions recorded yet" />;
      case 'now':
        return <NowMarker width={item.width} />;
      case 'skeleton':
        return <Skeleton width={item.width} height={cardHeight} style={{ borderRadius: radius.lg }} />;
      case 'next':
        return (
          <NextCard
            occurrence={item.occurrence}
            today={clock.day}
            nowMinutes={clock.minutesOfDay}
            showTutor={showTutor}
            width={item.width}
            height={cardHeight}
          />
        );
      case 'upcoming':
        return (
          <UpcomingCard
            occurrence={item.occurrence}
            today={clock.day}
            showTutor={showTutor}
            width={item.width}
            height={cardHeight}
          />
        );
      case 'cancelled':
        return (
          <CancelledCard
            occurrence={item.occurrence}
            today={clock.day}
            showTutor={showTutor}
            width={item.width}
            height={cardHeight}
          />
        );
      case 'none-scheduled':
        return (
          <NoteCard
            width={item.width}
            height={cardHeight}
            text="Nothing scheduled. Set up a schedule →"
            onPress={() => (mayScheduleHere ? router.push('/schedule-lesson') : router.navigate('/schedule'))}
            testID="carousel-none-scheduled"
          />
        );
      case 'load-more':
        return (
          <Pressable
            testID="carousel-load-more"
            accessibilityRole="button"
            accessibilityLabel="Later sessions"
            onPress={() => void upcoming.fetchNextPage()}
            style={({ pressed }) => ({
              width: item.width,
              minHeight: cardHeight,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.outlineVariant,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {upcoming.isFetchingNextPage ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon source="chevron-right" size={24} color={theme.colors.primary} />
            )}
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
              Load more
            </Text>
          </Pressable>
        );
    }
  }

  return (
    <View
      testID="sessions-carousel"
      onLayout={(event) => setViewport(Math.round(event.nativeEvent.layout.width))}
    >
      {viewport > 0 ? (
        <FlatList
          ref={list}
          testID="sessions-track"
          horizontal
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          initialNumToRender={items.length}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -space.lg }}
          contentContainerStyle={{ paddingHorizontal: padding, gap: GAP, alignItems: 'stretch' }}
          snapToOffsets={offsets}
          decelerationRate="fast"
          disableIntervalMomentum
          onMomentumScrollEnd={(event) => {
            const index = nearestIndex(offsets, event.nativeEvent.contentOffset.x);
            if (index !== settled.current) {
              settled.current = index;
              haptics.selection();
            }
          }}
        />
      ) : (
        <View style={{ height: cardHeight }} />
      )}
    </View>
  );
}

/** The marker between what was taught and what is coming. */
function NowMarker({ width }: { width: number }) {
  const theme = useAppTheme();
  return (
    <View
      testID="carousel-now"
      accessible
      accessibilityLabel="Now"
      style={{ width, alignItems: 'center', gap: space.xs, alignSelf: 'stretch' }}
    >
      {/* One word in a narrow column: it shrinks to fit rather than break ("NO / W"). */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}
      >
        Now
      </Text>
      <View style={{ flex: 1, width: 1, backgroundColor: withAlpha(theme.colors.primary, 0.5) }} />
    </View>
  );
}

function NoteCard({
  width,
  height,
  text,
  onPress,
  testID,
}: {
  width: number;
  height: number;
  text: string;
  onPress?: () => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : 'text'}
      onPress={onPress}
      style={{
        width,
        minHeight: height,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.colors.outlineVariant,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.lg,
      }}
    >
      <Text variant="bodySmall" style={{ textAlign: 'center', color: theme.tokens.mutedForeground }}>
        {text}
      </Text>
    </Pressable>
  );
}

/** The frame every lesson card shares. */
function CardFrame({
  width,
  height,
  testID,
  label,
  onPress,
  variant,
  footer,
  children,
}: {
  width: number;
  height: number;
  testID: string;
  label: string;
  onPress: () => void;
  variant: 'past' | 'upcoming' | 'cancelled' | 'next';
  /**
   * Buttons under the card's content (the Next up card's Start, Record and Cancel). They sit beside
   * the link, not inside it: an accessible Pressable hides its children from VoiceOver.
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const background =
    variant === 'next'
      ? theme.colors.primary
      : variant === 'upcoming'
        ? theme.colors.surface
        : withAlpha(theme.tokens.muted, 0.6);
  const frame = {
    width,
    minHeight: height,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: variant === 'cancelled' ? ('dashed' as const) : ('solid' as const),
    borderColor: variant === 'next' ? theme.colors.primary : theme.colors.outlineVariant,
    backgroundColor: background,
    ...(variant === 'next'
      ? {
          shadowColor: theme.colors.shadow,
          shadowOpacity: 0.18,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        }
      : null),
  };

  if (footer) {
    return (
      <View style={frame}>
        <Pressable
          testID={testID}
          accessibilityRole="link"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => ({
            flexGrow: 1,
            padding: 14,
            paddingBottom: space.sm,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {children}
        </Pressable>
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>{footer}</View>
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ ...frame, padding: 14, opacity: pressed ? 0.85 : 1 })}
    >
      {children}
    </Pressable>
  );
}

function Overline({ children, color }: { children: string; color?: string }) {
  const theme = useAppTheme();
  const lines = useLines(1);
  return (
    <Text
      numberOfLines={lines}
      style={{
        fontSize: 12,
        fontWeight: '500',
        color: color ?? theme.tokens.mutedForeground,
      }}
    >
      {children}
    </Text>
  );
}

function Who({
  student,
  tutor,
  showTutor,
  inverse,
}: {
  student: string;
  tutor: string;
  showTutor: boolean;
  inverse?: boolean;
}) {
  const theme = useAppTheme();
  const main = inverse ? theme.colors.onPrimary : theme.colors.onSurface;
  const muted = inverse ? withAlpha(theme.colors.onPrimary, 0.8) : theme.tokens.mutedForeground;
  const lines = useLines(1);
  return (
    <Text numberOfLines={lines} style={{ marginTop: 4, fontSize: 14, fontWeight: '500', color: main }}>
      {student}
      {showTutor ? <Text style={{ fontWeight: '400', color: muted }}> with {tutor}</Text> : null}
    </Text>
  );
}

function Badge({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'warning' | 'outline' }) {
  const theme = useAppTheme();
  const warningInk = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;
  return (
    <View
      style={{
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderWidth: tone === 'muted' ? 0 : 1,
        borderColor: tone === 'warning' ? withAlpha(theme.tokens.warning, 0.6) : theme.colors.outline,
        backgroundColor: tone === 'muted' ? theme.colors.secondaryContainer : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color:
            tone === 'warning'
              ? warningInk
              : tone === 'muted'
                ? theme.colors.onSecondaryContainer
                : theme.colors.onSurface,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function PastCard({
  session,
  today,
  showTutor,
  width,
  height,
}: {
  session: TutoringSession;
  today: string;
  showTutor: boolean;
  width: number;
  height: number;
}) {
  const theme = useAppTheme();
  const day = relativeDay(session.occurred_on, today);
  return (
    <CardFrame
      width={width}
      height={height}
      variant="past"
      testID={`carousel-past-${session.id}`}
      label={`Past session: ${session.student_name}, ${day}`}
      onPress={() => router.navigate(`/sessions?focus=${session.id}`)}
    >
      <Overline>{day}</Overline>
      <Text style={{ fontSize: 12, color: theme.tokens.mutedForeground, fontVariant: ['tabular-nums'] }}>
        {formatClockTime(session.started_at)}–{formatClockTime(session.ended_at)} ·{' '}
        {formatDuration(session.duration_minutes)}
      </Text>
      <Who student={session.student_name} tutor={session.tutor_name} showTutor={showTutor} />
      {session.notes ? (
        <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12, color: theme.tokens.mutedForeground }}>
          {session.notes}
        </Text>
      ) : null}
      <View
        style={{ marginTop: 'auto', paddingTop: space.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
      >
        <Badge>{SESSION_MODE_LABELS[session.mode]}</Badge>
        {session.auto_stopped ? <Badge tone="warning">Auto-stopped</Badge> : null}
      </View>
    </CardFrame>
  );
}

function Place({ occurrence, inverse }: { occurrence: UpcomingSession; inverse?: boolean }) {
  const theme = useAppTheme();
  const color = inverse ? withAlpha(theme.colors.onPrimary, 0.8) : theme.tokens.mutedForeground;
  return (
    <View
      style={{ marginTop: 'auto', paddingTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <Icon source="map-marker-outline" size={12} color={color} />
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color }}>
        {SESSION_MODE_LABELS[occurrence.mode]}
        {occurrence.locations.length > 0
          ? ` · ${occurrence.locations.map((place) => place.name).join(' / ')}`
          : occurrence.location
            ? ` · ${occurrence.location}`
            : ''}
      </Text>
    </View>
  );
}

function UpcomingCard({
  occurrence,
  today,
  showTutor,
  width,
  height,
}: {
  occurrence: UpcomingSession;
  today: string;
  showTutor: boolean;
  width: number;
  height: number;
}) {
  const theme = useAppTheme();
  const start = parseClockTime(occurrence.start_time) ?? 0;
  const day = relativeDay(occurrence.occurs_on, today);
  return (
    <CardFrame
      width={width}
      height={height}
      variant="upcoming"
      testID={`carousel-upcoming-${occurrenceKey(occurrence)}`}
      label={`Upcoming session: ${occurrence.student_name}, ${day}`}
      onPress={() => router.navigate(`/schedule?focus=${occurrence.schedule_id}`)}
    >
      <Overline color={theme.colors.onSurface}>{day}</Overline>
      <Text style={{ fontSize: 12, color: theme.tokens.mutedForeground, fontVariant: ['tabular-nums'] }}>
        {formatMinutesOfDay(start)}–{formatClockTime(occurrence.end_time)}
      </Text>
      <Who student={occurrence.student_name} tutor={occurrence.tutor_name} showTutor={showTutor} />
      <Place occurrence={occurrence} />
    </CardFrame>
  );
}

/**
 * A date the schedule would have had a lesson on, called off (Phase 24). Muted and dashed, so the
 * gap in the week is explained rather than silent.
 */
function CancelledCard({
  occurrence,
  today,
  showTutor,
  width,
  height,
}: {
  occurrence: UpcomingSession;
  today: string;
  showTutor: boolean;
  width: number;
  height: number;
}) {
  const theme = useAppTheme();
  const start = parseClockTime(occurrence.start_time) ?? 0;
  const day = relativeDay(occurrence.occurs_on, today);
  return (
    <CardFrame
      width={width}
      height={height}
      variant="cancelled"
      testID={`carousel-cancelled-${occurrenceKey(occurrence)}`}
      label={`Cancelled session: ${occurrence.student_name}, ${day}`}
      onPress={() => router.navigate(`/schedule?focus=${occurrence.schedule_id}&on=${occurrence.occurs_on}`)}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}
      >
        <Overline>{day}</Overline>
        <Badge tone="outline">Cancelled</Badge>
      </View>
      <Text
        style={{
          fontSize: 12,
          color: theme.tokens.mutedForeground,
          fontVariant: ['tabular-nums'],
          textDecorationLine: 'line-through',
        }}
      >
        {formatMinutesOfDay(start)}–{formatClockTime(occurrence.end_time)}
      </Text>
      <Who student={occurrence.student_name} tutor={occurrence.tutor_name} showTutor={showTutor} />
      {occurrence.cancellation?.note ? (
        <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12, color: theme.tokens.mutedForeground }}>
          {occurrence.cancellation.note}
        </Text>
      ) : null}
    </CardFrame>
  );
}

/** The lesson that matters most: bigger, in the brand colour, with a countdown. */
function NextCard({
  occurrence,
  today,
  nowMinutes,
  showTutor,
  width,
  height,
}: {
  occurrence: UpcomingSession;
  today: string;
  nowMinutes: number;
  showTutor: boolean;
  width: number;
  height: number;
}) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const active = useActiveSession();
  const start = parseClockTime(occurrence.start_time) ?? 0;
  const left = countdown(occurrence, today, nowMinutes);
  const soft = withAlpha(theme.colors.onPrimary, 0.85);
  const actions = nextUpActions({
    occurrence,
    userId: user?.id,
    isAdmin: user?.roles.includes('admin') ?? false,
    running: Boolean(active.data?.data.mine),
    today,
    nowMinutes,
  });
  const any = actions.start || actions.record || actions.cancel;
  return (
    <CardFrame
      width={width}
      height={height}
      variant="next"
      testID="carousel-next"
      label={`Next session: ${occurrence.student_name}, ${left}`}
      onPress={() => router.navigate(`/schedule?focus=${occurrence.schedule_id}`)}
      footer={any ? <NextUpButtons occurrence={occurrence} actions={actions} /> : undefined}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}
      >
        <View
          style={{
            borderRadius: radius.pill,
            paddingHorizontal: space.sm,
            paddingVertical: 2,
            backgroundColor: withAlpha(theme.colors.onPrimary, 0.15),
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.onPrimary }}>Next up</Text>
        </View>
        <Text
          testID="carousel-countdown"
          style={{ fontSize: 12, color: soft, fontVariant: ['tabular-nums'] }}
        >
          {left}
        </Text>
      </View>
      <Text
        style={{
          marginTop: space.sm,
          fontSize: 18,
          lineHeight: 22,
          fontWeight: '600',
          color: theme.colors.onPrimary,
        }}
      >
        {relativeDay(occurrence.occurs_on, today)} · {formatMinutesOfDay(start)}
      </Text>
      <Text style={{ fontSize: 12, color: soft, fontVariant: ['tabular-nums'] }}>
        until {formatClockTime(occurrence.end_time)} · {formatDuration(occurrence.duration_minutes)}
      </Text>
      <Who student={occurrence.student_name} tutor={occurrence.tutor_name} showTutor={showTutor} inverse />
      <Place occurrence={occurrence} inverse />
    </CardFrame>
  );
}

/**
 * Start, Record and Cancel on the Next up card (#43): two taps to start the lesson at hand, two (and
 * a scroll) to write it up, two to call the date off. No money: each opens a Tutoring sheet.
 */
function NextUpButtons({ occurrence, actions }: { occurrence: UpcomingSession; actions: NextUpActions }) {
  const theme = useAppTheme();
  const day = formatLessonDay(occurrence.occurs_on);
  return (
    <View
      testID="carousel-next-actions"
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
    >
      {actions.start ? (
        <Button
          testID="carousel-next-start"
          mode="contained"
          compact
          icon="play"
          buttonColor={theme.colors.onPrimary}
          textColor={theme.colors.primary}
          contentStyle={{ minHeight: MIN_TARGET }}
          accessibilityLabel={`Start the lesson with ${occurrence.student_name} now`}
          onPress={() => {
            haptics.selection();
            router.navigate(startHref(occurrence));
          }}
        >
          Start
        </Button>
      ) : null}
      {actions.record ? (
        <Button
          testID="carousel-next-record"
          mode="outlined"
          compact
          icon="pencil-outline"
          textColor={theme.colors.onPrimary}
          style={{ borderColor: withAlpha(theme.colors.onPrimary, 0.6) }}
          contentStyle={{ minHeight: MIN_TARGET }}
          accessibilityLabel={`Record the lesson with ${occurrence.student_name}`}
          onPress={() => {
            haptics.selection();
            router.navigate(recordHref(occurrence));
          }}
        >
          Record
        </Button>
      ) : null}
      {actions.cancel ? (
        <>
          <View style={{ flexGrow: 1 }} />
          <IconButton
            testID="carousel-next-cancel"
            icon="calendar-remove"
            iconColor={theme.colors.onPrimary}
            accessibilityLabel={`Cancel the lesson on ${day}`}
            onPress={() => {
              haptics.selection();
              router.navigate(cancelHref(occurrence));
            }}
          />
        </>
      ) : null}
    </View>
  );
}
