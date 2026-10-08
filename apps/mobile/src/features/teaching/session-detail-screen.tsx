// Ported from apps/web/src/features/teaching/sessions-page.tsx @ 1132322 (a card's expanded notes,
// reflection and assessments). The web opens a card in place; on the phone the card opens this.
// Money only when it was opened from Finance (`showMoney`, false unless the route says finance).
import { SESSION_MODE_LABELS, formatDuration, type TutoringSession } from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useSession } from './api';
import { ReflectionView } from './reflection-chips';
import { firstName, likelyReflectorRole, mayChangeReflection } from './reflection-logic';
import { AUTO_STOPPED_NOTE, Tag } from './session-card';
import { formatSessionDay, formatSessionTimes } from './session-format';
import { SessionMoney } from './session-money';
import { AssessmentsView, PartHeading, SessionNotesView, hasWrittenNotes } from './session-notes';
import { organizationToday } from './session-ranges';

export function SessionDetailScreen({ id, showMoney = false }: { id: string; showMoney?: boolean }) {
  const query = useSession(id);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  let body;
  if (query.isPending) body = <LoadingState label="Loading the lesson…" />;
  else if (query.isError || !query.data) {
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else {
    body = <SessionDetail session={query.data.data} showMoney={showMoney} />;
  }

  return (
    <Screen testID="screen-session" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Session' }} />
      {body}
    </Screen>
  );
}

function SessionDetail({ session, showMoney }: { session: TutoringSession; showMoney: boolean }) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const today = organizationToday(useOrgTimeZone());
  const muted = theme.tokens.mutedForeground;
  const canReflect = mayChangeReflection(session, user);
  const forStudent = user ? likelyReflectorRole(session, user) === 'student' : false;

  return (
    <>
      <View testID="session-detail-header" style={{ gap: 6 }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {session.student_name}
          <Text style={{ color: muted }}> with {session.tutor_name}</Text>
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {formatSessionDay(session.occurred_on, today)} ·{' '}
          {formatSessionTimes(session.started_at, session.ended_at)} ·{' '}
          {formatDuration(session.duration_minutes)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Tag label={SESSION_MODE_LABELS[session.mode]} />
          {session.auto_stopped ? <Tag label="Auto-stopped" tone="warning" /> : null}
        </View>
        {session.auto_stopped ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            {AUTO_STOPPED_NOTE}
          </Text>
        ) : null}
      </View>

      {/* Finance only: the lesson's money from the reader's side. */}
      {showMoney && session.money_view !== 'none' ? (
        <Card mode="outlined" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
            <PartHeading>Money</PartHeading>
            <SessionMoney session={session} />
          </View>
        </Card>
      ) : null}

      {/* The write-up, the student's reflection and the assessments (Phases 23 and 25). No money
          here on either tab: this is what a tutor reads with the student beside them. */}
      <Card mode="outlined" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.lg }}>
          {hasWrittenNotes(session) ? (
            <SessionNotesView session={session} />
          ) : (
            <Text variant="bodyMedium" style={{ color: muted }}>
              No notes were written for this lesson.
            </Text>
          )}
          {session.reflection ? (
            <ReflectionView reflection={session.reflection} studentName={session.student_name} />
          ) : null}
          <AssessmentsView assessments={session.assessments} />
        </View>
      </Card>

      {canReflect ? (
        <Button
          testID="session-reflect"
          mode="outlined"
          icon="emoticon-happy-outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => router.push({ pathname: '/reflection', params: { session: session.id } })}
        >
          {session.reflection
            ? forStudent
              ? 'Your reflection'
              : 'Edit reflection'
            : forStudent
              ? 'Reflect'
              : `Add ${firstName(session.student_name)}’s reflection`}
        </Button>
      ) : null}

      {/* Comments on the lesson (#29) go here. */}
    </>
  );
}
