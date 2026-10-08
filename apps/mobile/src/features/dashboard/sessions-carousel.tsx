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
import { FlatList, Pressable, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

import { EmptyNote } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { useUpcomingSessions } from '@/features/schedules/api';
import { haptics } from '@/lib/haptics';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import {
  GAP,
  buildCarousel,
  carouselOffsets,
  countdown,
  nearestIndex,
  occurrenceKey,
  relativeDay,
  type CarouselItem,
} from './carousel-model';

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
  const upcoming = useUpcomingSessions(tutorUserId);
  const list = useRef<FlatList<CarouselItem>>(null);
  const placed = useRef(false);
  const settled = useRef(-1);
  const [viewport, setViewport] = useState(0);

  const next = useMemo(() => upcoming.data?.pages.flatMap((page) => page.data) ?? [], [upcoming.data]);
  const { items, anchorIndex, empty } = buildCarousel({
    past,
    upcoming: next,
    pending: upcoming.isPending,
    hasMore: Boolean(upcoming.hasNextPage),
    fetchingMore: upcoming.isFetchingNextPage,
  });
  // The strip bleeds to the screen's edges, past the page's padding.
  const listWidth = viewport + space.lg * 2;
  const { padding, offsets } = carouselOffsets(items, listWidth);

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
        return <PastCard session={item.session} today={clock.day} showTutor={showTutor} />;
      case 'past-empty':
        return <NoteCard width={item.width} text="No sessions recorded yet" />;
      case 'now':
        return <NowMarker />;
      case 'skeleton':
        return <Skeleton width={item.width} height={CARD_HEIGHT} style={{ borderRadius: radius.lg }} />;
      case 'next':
        return (
          <NextCard
            occurrence={item.occurrence}
            today={clock.day}
            nowMinutes={clock.minutesOfDay}
            showTutor={showTutor}
          />
        );
      case 'upcoming':
        return <UpcomingCard occurrence={item.occurrence} today={clock.day} showTutor={showTutor} />;
      case 'cancelled':
        return <CancelledCard occurrence={item.occurrence} today={clock.day} showTutor={showTutor} />;
      case 'none-scheduled':
        return (
          <NoteCard
            width={item.width}
            text="Nothing scheduled. Set up a schedule →"
            onPress={() => router.navigate('/schedule')}
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
              height: CARD_HEIGHT,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.outline,
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
    <View onLayout={(event) => setViewport(Math.round(event.nativeEvent.layout.width))}>
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
        <View style={{ height: CARD_HEIGHT }} />
      )}
    </View>
  );
}

/** The marker between what was taught and what is coming. */
function NowMarker() {
  const theme = useAppTheme();
  return (
    <View
      testID="carousel-now"
      accessible
      accessibilityLabel="Now"
      style={{ width: 36, alignItems: 'center', gap: space.xs, alignSelf: 'stretch' }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.primary }}>
        NOW
      </Text>
      <View style={{ flex: 1, width: 1, backgroundColor: withAlpha(theme.colors.primary, 0.5) }} />
    </View>
  );
}

function NoteCard({
  width,
  text,
  onPress,
  testID,
}: {
  width: number;
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
        height: CARD_HEIGHT,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.colors.outline,
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
  testID,
  label,
  onPress,
  variant,
  children,
}: {
  width: number;
  testID: string;
  label: string;
  onPress: () => void;
  variant: 'past' | 'upcoming' | 'cancelled' | 'next';
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const background =
    variant === 'next'
      ? theme.colors.primary
      : variant === 'upcoming'
        ? theme.colors.surface
        : withAlpha(theme.tokens.muted, 0.6);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        minHeight: CARD_HEIGHT,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: variant === 'cancelled' ? 'dashed' : 'solid',
        borderColor: variant === 'next' ? theme.colors.primary : theme.colors.outlineVariant,
        backgroundColor: background,
        padding: 14,
        opacity: pressed ? 0.85 : 1,
        ...(variant === 'next'
          ? {
              shadowColor: theme.colors.shadow,
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }
          : null),
      })}
    >
      {children}
    </Pressable>
  );
}

function Overline({ children, color }: { children: string; color?: string }) {
  const theme = useAppTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
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
  return (
    <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 14, fontWeight: '500', color: main }}>
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
          fontSize: 10,
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
}: {
  session: TutoringSession;
  today: string;
  showTutor: boolean;
}) {
  const theme = useAppTheme();
  const day = relativeDay(session.occurred_on, today);
  return (
    <CardFrame
      width={224}
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
        {occurrence.location ? ` · ${occurrence.location}` : ''}
      </Text>
    </View>
  );
}

function UpcomingCard({
  occurrence,
  today,
  showTutor,
}: {
  occurrence: UpcomingSession;
  today: string;
  showTutor: boolean;
}) {
  const theme = useAppTheme();
  const start = parseClockTime(occurrence.start_time) ?? 0;
  const day = relativeDay(occurrence.occurs_on, today);
  return (
    <CardFrame
      width={224}
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
}: {
  occurrence: UpcomingSession;
  today: string;
  showTutor: boolean;
}) {
  const theme = useAppTheme();
  const start = parseClockTime(occurrence.start_time) ?? 0;
  const day = relativeDay(occurrence.occurs_on, today);
  return (
    <CardFrame
      width={224}
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
}: {
  occurrence: UpcomingSession;
  today: string;
  nowMinutes: number;
  showTutor: boolean;
}) {
  const theme = useAppTheme();
  const start = parseClockTime(occurrence.start_time) ?? 0;
  const left = countdown(occurrence, today, nowMinutes);
  const soft = withAlpha(theme.colors.onPrimary, 0.85);
  return (
    <CardFrame
      width={272}
      variant="next"
      testID="carousel-next"
      label={`Next session: ${occurrence.student_name}, ${left}`}
      onPress={() => router.navigate(`/schedule?focus=${occurrence.schedule_id}`)}
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
          <Text
            style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.onPrimary }}
          >
            NEXT UP
          </Text>
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
