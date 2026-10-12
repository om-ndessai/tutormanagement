// Ported from apps/web/src/features/dashboard/tutor-payments.tsx @ 1132322 (the phone layout: a
// card per tutor; the wide table is not ported). Rows do not link to the tutor's own Finance tab
// yet: that is view-as, feature 16.
import {
  PAYMENT_SOON_DAYS,
  TOPUP_PROJECTION_WEEKS,
  TUTOR_PAYMENT_URGENCIES,
  formatCents,
  topupDueCents,
  tutorAdvanceCents,
  type TutorPaymentOutlook,
  type TutorPaymentUrgency,
} from '@tmi/shared';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import { radius, space } from '@/theme/tokens';
import { viewAs } from './view-as';
import { daysAway, formatLessonDay, formatPaidOn, orgToday } from './finance-format';

export const URGENCY_LABELS: Record<TutorPaymentUrgency, string> = {
  past_due: 'Below top-up',
  due_soon: `Due within ${PAYMENT_SOON_DAYS} days`,
  on_track: 'On track',
};

/** The card's tint and the legend's dot. The words in Next payment say the same thing. */
function urgencyColor(theme: AppTheme, urgency: TutorPaymentUrgency): string {
  switch (urgency) {
    case 'past_due':
      return theme.tokens.destructive;
    case 'due_soon':
      return theme.tokens.warning;
    default:
      return theme.tokens.success;
  }
}

const ROW_ALPHA: Record<TutorPaymentUrgency, number> = { past_due: 0.1, due_soon: 0.2, on_track: 0.15 };

function Muted({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return <Text style={{ color: theme.tokens.mutedForeground, fontSize: 12 }}>{children}</Text>;
}

function Figure({ children, color, bold }: { children: ReactNode; color?: string; bold?: boolean }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        fontSize: 12,
        fontVariant: ['tabular-nums'],
        fontWeight: bold ? '600' : '400',
        color: color ?? theme.colors.onSurface,
      }}
    >
      {children}
    </Text>
  );
}

/** What the organization owes the tutor, or what they still hold of an advance. */
export function balanceText(tutor: Pick<TutorPaymentOutlook, 'balance_cents'>): string {
  if (tutor.balance_cents === 0) return 'Settled';
  return `${formatCents(Math.abs(tutor.balance_cents))} ${tutor.balance_cents > 0 ? 'owed' : 'held'}`;
}

/** How much more they can teach before a top-up is due, or how far past it they are. */
export function fromTopupText(
  tutor: Pick<TutorPaymentOutlook, 'topup_amount_cents' | 'earned_cents' | 'paid_cents'>,
): { text: string; below: boolean } {
  if (tutor.topup_amount_cents == null) return { text: '—', below: false };
  const short = topupDueCents(tutor) ?? 0;
  if (short > 0) return { text: `${formatCents(short)} below`, below: true };
  const above = tutorAdvanceCents(tutor) - tutor.topup_amount_cents;
  if (above === 0) return { text: 'At top-up', below: false };
  return { text: `${formatCents(above)} above`, below: false };
}

function NextPayment({ tutor, today }: { tutor: TutorPaymentOutlook; today: string }) {
  const theme = useAppTheme();
  const warn = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;

  // Paid after the work: no level to fall below, just what they are owed.
  if (tutor.topup_amount_cents == null) {
    return tutor.balance_cents > 0 ? (
      <Text style={{ fontSize: 13, fontWeight: '500', color: warn }}>Owed now</Text>
    ) : (
      <Muted>After lessons</Muted>
    );
  }
  if (tutor.urgency === 'past_due') {
    return <Text style={{ fontSize: 13, fontWeight: '600', color: theme.tokens.destructive }}>Past due</Text>;
  }
  if (tutor.next_topup_on) {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: tutor.urgency === 'due_soon' ? '500' : '400',
            color: tutor.urgency === 'due_soon' ? warn : theme.colors.onSurface,
          }}
        >
          {formatLessonDay(tutor.next_topup_on)}
        </Text>
        <Muted>{daysAway(tutor.next_topup_on, today)}</Muted>
      </View>
    );
  }
  return (
    <Muted>
      {tutor.scheduled_lessons === 0 ? 'No lessons scheduled' : `Not within ${TOPUP_PROJECTION_WEEKS} weeks`}
    </Muted>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Muted>{label}</Muted>
      {children}
    </View>
  );
}

function TutorCard({
  tutor,
  today,
  timeZone,
}: {
  tutor: TutorPaymentOutlook;
  today: string;
  timeZone: string;
}) {
  const theme = useAppTheme();
  const tint = urgencyColor(theme, tutor.urgency);
  const fromTopup = fromTopupText(tutor);
  return (
    // The tutor's own Finance tab, as they see it (the web's tutorLink).
    <Pressable
      testID={`tutor-payment-${tutor.user_id}`}
      accessibilityRole="link"
      accessibilityLabel={`${tutor.full_name}. ${URGENCY_LABELS[tutor.urgency]}. View their Finance tab`}
      onPress={() => viewAs(tutor.user_id, 'tutor', 'finance')}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        backgroundColor: withAlpha(tint, ROW_ALPHA[tutor.urgency]),
        gap: space.sm,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: space.md,
        }}
      >
        <Text variant="bodyMedium" style={{ fontWeight: '500', flexShrink: 1 }}>
          {tutor.full_name}
        </Text>
        <NextPayment tutor={tutor} today={today} />
      </View>
      <View style={{ gap: 2 }}>
        <Row label="Balance">
          {tutor.balance_cents === 0 ? <Muted>Settled</Muted> : <Figure bold>{balanceText(tutor)}</Figure>}
        </Row>
        <Row label="From top-up">
          {tutor.topup_amount_cents == null ? (
            <Muted>—</Muted>
          ) : (
            <Figure bold={fromTopup.below} color={fromTopup.below ? theme.tokens.destructive : undefined}>
              {fromTopup.text}
            </Figure>
          )}
        </Row>
        <Row label="Top-up">
          {tutor.topup_amount_cents == null ? (
            <Muted>None</Muted>
          ) : (
            <Figure>{formatCents(tutor.topup_amount_cents)}</Figure>
          )}
        </Row>
        <Row label="Last paid">
          {tutor.last_paid_cents == null ? (
            <Muted>Never</Muted>
          ) : (
            <Figure>{formatCents(tutor.last_paid_cents)}</Figure>
          )}
        </Row>
        {tutor.last_paid_at ? (
          <Row label="Last paid on">
            <Figure>{formatPaidOn(tutor.last_paid_at, timeZone, today)}</Figure>
          </Row>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Every tutor, and what the office has to pay them next: what each is owed or still holds, how
 * far that is from their top-up level, when they were last paid, and the day their scheduled
 * lessons are projected to take them below the level (`next_topup_on`, worked out by the API).
 * Each card is tinted by how pressing it is and Next payment says the same in words, so colour
 * is never the only way to read it. The API sends the most pressing first.
 */
export function TutorPayments({ tutors }: { tutors: TutorPaymentOutlook[] }) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const today = orgToday(timeZone);

  const counts = Object.fromEntries(
    TUTOR_PAYMENT_URGENCIES.map((urgency) => [urgency, tutors.filter((t) => t.urgency === urgency).length]),
  ) as Record<TutorPaymentUrgency, number>;
  const toRestore = tutors.reduce((sum, tutor) => sum + (topupDueCents(tutor) ?? 0), 0);

  return (
    <Panel
      testID="tutor-payments"
      tourId="dash-tutor-payments"
      title="Tutor payments"
      action={{ label: 'Billing', to: '/billing' }}
    >
      {tutors.length === 0 ? (
        <EmptyNote>No tutors yet.</EmptyNote>
      ) : (
        <View style={{ gap: space.sm }}>
          <View
            testID="tutor-payments-legend"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              columnGap: space.lg,
              rowGap: 4,
              marginBottom: 4,
            }}
          >
            {TUTOR_PAYMENT_URGENCIES.map((urgency) => (
              <View key={urgency} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: urgencyColor(theme, urgency),
                  }}
                />
                <Muted>{URGENCY_LABELS[urgency]}</Muted>
                <Figure bold>{counts[urgency]}</Figure>
                {urgency === 'past_due' && toRestore > 0 ? (
                  <Muted>· {formatCents(toRestore)} to top up</Muted>
                ) : null}
              </View>
            ))}
          </View>

          {tutors.map((tutor) => (
            <TutorCard key={tutor.user_id} tutor={tutor} today={today} timeZone={timeZone} />
          ))}

          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, marginTop: 4 }}>
            Held is an advance the tutor has not yet worked off. The next payment is the day their scheduled
            lessons, at their rates and less any cancelled, are projected to take them below their top-up,
            looking {TOPUP_PROJECTION_WEEKS} weeks ahead. A tutor with no top-up is paid after lessons.
          </Text>
        </View>
      )}
    </Panel>
  );
}
