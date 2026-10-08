// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 (ParentView). Named for
// the money rule: a parent's dashboard carries the family's balances.
import { formatCents, type ParentDashboard, type StudentBalance } from '@tmi/shared';
import { View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { StatCard, StatGrid } from '@/components/stat-card';
import { StudentProgressCard } from '@/features/progress/progress-card';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { formatMoneyValue } from './finance-format';
import { PaymentList } from './finance-views';
import { walletMinusIcon } from './money-icon';
import { ReflectionPrompts } from './reflections';
import { SessionList } from './session-list';
import { ROLE_ICONS } from './tutoring-views';

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
          {child.session_count} sessions · {formatCents(child.charged_cents)} charged
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
 * A parent's dashboard (not tabbed, as on the web): their children, what the family has been
 * charged and still owes, reflections to answer with each child, each child's progress, recent
 * lessons and the family's payments. Every amount is the family's side: the server's balances,
 * and lessons through SessionMoney ("You pay").
 */
export function ParentView({ data }: { data: ParentDashboard }) {
  return (
    <View testID="dashboard-parent" style={{ gap: space.lg }}>
      <StatGrid>
        {[
          <StatCard key="children" label="Children" value={data.children.length} icon={ROLE_ICONS.student} />,
          <StatCard
            key="charged"
            label="Charged"
            value={data.totals.charged_cents}
            formatValue={formatMoneyValue}
            animate={false}
            icon="book-open-variant"
            to="/sessions?tab=finance"
          />,
          <StatCard
            key="outstanding"
            label="Outstanding"
            value={data.totals.balance_cents}
            formatValue={formatMoneyValue}
            animate={false}
            icon={walletMinusIcon}
            tone={data.totals.balance_cents > 0 ? 'brand' : 'success'}
            hint={`${formatCents(data.totals.paid_cents)} paid`}
            to="/billing"
          />,
        ]}
      </StatGrid>

      <Panel testID="parent-children" tourId="dash-children" title="Your children">
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

      {/* Phase 25: their children's recent lessons still waiting for a reflection -- most
          children never sign in, so it is answered together. */}
      <ReflectionPrompts prompts={data.awaiting_reflection} forChildren />

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
