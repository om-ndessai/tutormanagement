// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 (ParentView). Named for
// the money rule: a parent's dashboard carries the family's balances.
import { formatCents, type ParentDashboard, type StudentBalance } from '@tmi/shared';
import { View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { countOf } from '@/lib/plural';
import { SecureMoney } from '@/components/secure-money';
import { EmptyNote, Panel } from '@/components/section';
import { FigureRow } from '@/components/figure-row';
import { TourTarget } from '@/features/onboarding/tour-targets';
import { StudentProgressCard } from '@/features/progress/progress-card';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { formatMoneyValue } from './finance-format';
import { PaymentList } from './finance-views';
import { ChildCard } from './child-card';
import { CHILD_HORIZON_DAYS, nextLessonFor } from './home-model';
import { TodayCard, useToday } from './home-top';
import { ReflectionPrompts } from './reflections';
import { SessionList } from './session-list';

/** One child's balance: emphasised only when there is something outstanding. */
function ChildBalanceRow({ child }: { child: StudentBalance }) {
  const theme = useAppTheme();
  return (
    <View
      testID={`child-balance-${child.student_user_id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
          {child.student_name}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.tokens.mutedForeground }}>
          {countOf(child.session_count, 'session')} · {formatCents(child.charged_cents)} charged
        </Text>
      </View>
      <Text
        variant="bodyMedium"
        style={{
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          color: child.balance_cents > 0 ? theme.colors.onSurface : theme.tokens.mutedForeground,
        }}
      >
        {formatCents(child.balance_cents)}
      </Text>
    </View>
  );
}

/**
 * A parent's dashboard (not tabbed, as on the web): Today, the figures, a card per child (the next
 * lesson, this month, a celebration: UI upgrades U6), what the family has been charged and still owes, reflections to answer with each child, each child's progress, recent
 * lessons and the family's payments. Every amount is the family's side: the server's balances,
 * and lessons through SessionMoney ("You pay").
 */
export function ParentView({ data }: { data: ParentDashboard }) {
  const today = useToday({
    who: 'both',
    studentIds: data.children.map((child) => child.student_user_id),
    horizonDays: CHILD_HORIZON_DAYS,
  });
  return (
    <View testID="dashboard-parent" style={{ gap: space.lg }}>
      {/* The family's balances, with no Tutoring/Finance split to keep them off screen (ux-audit F-1). */}
      <SecureMoney tag="parent-dashboard" />
      <TodayCard summary={today.summary} pending={today.pending} failed={today.failed} />
      <FigureRow
        figures={[
          { label: 'Children', value: data.children.length },
          {
            label: 'Charged',
            value: data.totals.charged_cents,
            formatValue: formatMoneyValue,
            animate: false,
            to: '/sessions?tab=finance',
          },
          {
            label: 'Outstanding',
            value: data.totals.balance_cents,
            formatValue: formatMoneyValue,
            animate: false,
            tone: data.totals.balance_cents > 0 ? 'brand' : 'success',
            hint: `${formatCents(data.totals.paid_cents)} paid`,
            to: '/billing',
          },
        ]}
      />

      {/* UI upgrades U6: a card per child -- the next lesson and this month -- before the money. */}
      <TourTarget id="dash-children">
        <View testID="home-children" style={{ gap: space.md }}>
          {data.children.map((child) => (
            <ChildCard
              key={child.student_user_id}
              studentId={child.student_user_id}
              name={child.student_name}
              progress={data.progress.find((entry) => entry.student.user_id === child.student_user_id)}
              next={nextLessonFor(today.lessons, child.student_user_id)}
              today={today.today}
            />
          ))}
        </View>
      </TourTarget>

      {/* Phase 25: their children's recent lessons still waiting for a reflection -- most
          children never sign in, so it is answered together. */}
      <ReflectionPrompts prompts={data.awaiting_reflection} forChildren />

      <Panel testID="parent-children" title="Balances">
        {data.children.length === 0 ? (
          <EmptyNote>No students are linked to you yet.</EmptyNote>
        ) : (
          data.children.map((child, index) => (
            <View key={child.student_user_id}>
              {index > 0 ? <Divider /> : null}
              <ChildBalanceRow child={child} />
            </View>
          ))
        )}
      </Panel>

      {data.progress.map((child, position) => (
        <StudentProgressCard
          key={child.student.user_id}
          tourId={position === 0 ? 'dash-child-progress' : undefined}
          progress={child}
          title={`${child.student.full_name}'s progress`}
        />
      ))}

      <Panel
        testID="recent-sessions"
        tourId="dash-recent-sessions"
        title="Recent sessions"
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        <SessionList sessions={data.recent_sessions} showTutor />
      </Panel>

      <Panel testID="parent-payments" title="Your payments" action={{ label: 'Billing', to: '/billing' }}>
        <PaymentList payments={data.recent_payments} />
      </Panel>
    </View>
  );
}
