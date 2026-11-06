// Phase 75 (docs/journey-fixes-plan.md JF19, JF30; owner 2026-11-05): the lessons still owed -- the scheduled
// lessons of the last week that ended and were never recorded, cancelled or left running (`GET /sessions/to-record`,
// a tutor's own, an admin's every tutor's) -- as rows with Record (or, with the reader's draft of it, "Draft saved
// 12:43 PM" and Continue). The web's lessons-owed dialog and the Sessions page's To record are the same rows.
//
// Two places: the `/lessons-owed` sheet, which every "Record a lesson" door opens (the home's quick action, the (+),
// the Sessions page's button, the phone's home-screen action), with "Another lesson" for one the schedule does not
// know -- a blank record with NO date filled in; and the To record card at the top of the Sessions page's Tutoring
// tab. No money anywhere: these are Tutoring surfaces.
//
// Phase 78 (the note carried from Phase 75): the office's list can outgrow the screen, and the sheet then scrolls with
// "Another lesson" at its end. The action cannot be pinned below a scrolling list: QuickSheet's root must stay a
// ScrollView, the only root react-native-screens resizes in an iOS form sheet (a View with a flex body and a separate
// footer collapses its body to nothing, U2). So the sheet shows the newest `LESSONS_OWED_SHOWN` rows (the server
// sends them newest first) and "Show all" for the rest, which keeps "Another lesson" in the thumb zone until the
// reader asks for the whole list.
import type { LessonOwed } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { QuickSheet } from '@/components/quick-sheet';
import { FormSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useLessonsOwed } from './api';
import { draftSavedLine, knownLessonHref, owedAsKnown, owedLine, owedShowsTutor } from './lessons-owed-model';
import { organizationToday } from './session-ranges';

/** How many the Sessions page's card lists before "+N more" opens the whole list. */
export const SESSIONS_TO_RECORD_SHOWN = 3;

/** How many the `/lessons-owed` sheet lists before "Show all": the newest, so "Another lesson" stays in reach. */
export const LESSONS_OWED_SHOWN = 5;

/** The row's key and testID suffix: one lesson of a series, on one date. */
export const owedKey = (row: Pick<LessonOwed, 'schedule_id' | 'occurs_on'>) => `${row.schedule_id}-${row.occurs_on}`;

/** The rows, each with Record (or Continue its draft). `replace`: the sheet gives way to what a row opens. */
export function OwedLessonRows({
  rows,
  testPrefix,
  replace = false,
}: {
  rows: readonly LessonOwed[];
  testPrefix: string;
  replace?: boolean;
}) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const timeZone = useOrgTimeZone();
  const today = organizationToday(timeZone);
  const withTutor = owedShowsTutor(rows, user?.id);
  const muted = theme.tokens.mutedForeground;
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row) => {
        const id = `${testPrefix}-${owedKey(row)}`;
        return (
          <View key={id} testID={id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                {row.student_name}
              </Text>
              <Text variant="bodyMedium" style={{ color: muted }}>
                {owedLine(row, today, withTutor)}
              </Text>
              {row.draft ? (
                <Text testID={`${id}-draft`} variant="labelLarge" style={{ color: theme.colors.primary }}>
                  {draftSavedLine(row.draft, timeZone, today)}
                </Text>
              ) : null}
            </View>
            <Button
              testID={`${id}-record`}
              mode="contained-tonal"
              compact
              accessibilityLabel={`${row.draft ? 'Continue' : 'Record'} the lesson with ${row.student_name}`}
              contentStyle={{ minHeight: 44 }}
              onPress={() => {
                haptics.selection();
                const href = knownLessonHref(owedAsKnown(row));
                if (replace) router.replace(href);
                else router.navigate(href);
              }}
            >
              {row.draft ? 'Continue' : 'Record'}
            </Button>
          </View>
        );
      })}
    </View>
  );
}

/** "Another lesson": a blank record, dated by the person (nothing is dated today by default). */
function openAnotherLesson(replace: boolean) {
  haptics.selection();
  if (replace) router.replace('/record-lesson');
  else router.navigate('/record-lesson');
}

/** The `/lessons-owed` sheet: every lesson still owed, then "Another lesson". */
export function LessonsOwedSheet() {
  const owed = useLessonsOwed();
  const rows = owed.data?.data ?? [];
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, LESSONS_OWED_SHOWN);
  const hidden = rows.length - shown.length;
  return (
    <QuickSheet
      testID="lessons-owed"
      title="Record a lesson"
      description={
        rows.length > 0
          ? 'Lessons from the schedule that are not recorded yet. Record one as it was planned, or write it up.'
          : undefined
      }
      primaryLabel="Another lesson"
      primaryIcon="plus"
      primaryTestID="lessons-owed-another"
      cancelLabel="Close"
      onPrimary={() => openAnotherLesson(true)}
    >
      {owed.isPending ? (
        <FormSkeleton label="Loading…" fields={2} />
      ) : owed.isError ? (
        <ErrorState error={owed.error} onRetry={() => void owed.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          testID="lessons-owed-empty"
          icon="check-circle-outline"
          title="Nothing to record."
          body="Every lesson on the schedule this past week is recorded. For one that is not on it, choose Another lesson."
        />
      ) : (
        <View style={{ gap: space.sm }}>
          <OwedLessonRows rows={shown} testPrefix="lessons-owed" replace />
          {hidden > 0 ? (
            <Button
              testID="lessons-owed-show-all"
              mode="text"
              icon="chevron-down"
              style={{ alignSelf: 'flex-start' }}
              contentStyle={{ minHeight: 44 }}
              accessibilityLabel={`Show all ${rows.length} lessons`}
              onPress={() => {
                haptics.selection();
                setAll(true);
              }}
            >
              Show all
            </Button>
          ) : null}
        </View>
      )}
    </QuickSheet>
  );
}

/**
 * The Sessions page's To record (Tutoring tab, tutors and the office): the first lessons still owed, each with
 * Record, and "+N more" for the whole list. Nothing at all when nothing is owed.
 */
export function SessionsToRecord() {
  const theme = useAppTheme();
  const owed = useLessonsOwed();
  const rows = owed.data?.data ?? [];
  if (rows.length === 0) return null;
  const shown = rows.slice(0, SESSIONS_TO_RECORD_SHOWN);
  const more = rows.length - shown.length;
  return (
    <OutlinedCard testID="sessions-to-record" style={{ borderRadius: radius.lg, borderColor: theme.tokens.highlight }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '700' }}>
          To record
        </Text>
        <OwedLessonRows rows={shown} testPrefix="sessions-to-record" />
        {more > 0 ? (
          <Button
            testID="sessions-to-record-more"
            mode="text"
            icon="dots-horizontal"
            style={{ alignSelf: 'flex-start' }}
            contentStyle={{ minHeight: 44 }}
            onPress={() => {
              haptics.selection();
              router.navigate('/lessons-owed');
            }}
          >
            {`+${more} more`}
          </Button>
        ) : null}
      </View>
    </OutlinedCard>
  );
}
