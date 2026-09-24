import { Link } from 'react-router-dom';
import {
  ActivityIcon,
  BookOpenIcon,
  PiggyBankIcon,
  RadioIcon,
  TargetIcon,
  WalletIcon,
} from 'lucide-react';
import {
  PAYMENT_FORM_LABELS,
  SESSION_MODE_LABELS,
  formatCents,
  needsTopup,
  formatDuration,
  topupDueCents,
  tutorAdvanceCents,
  type AdminDashboard,
  type ParentDashboard,
  type Payment,
  type StudentDashboard,
  type TutoringSession,
  type TutorBalance,
  type TutorDashboard,
} from '@tmi/shared';

import { ActivityFeed } from '@/features/audit/activity-feed';
import { SessionMoney } from '@/features/teaching/session-money';
import { StudentProgressCard } from '@/features/progress/progress-card';
import { ProgressSpotlight } from '@/features/progress/progress-spotlight';
import { ROLE_ICONS } from '@/features/users/role-icon';
import { WalletMinusIcon, WalletPlusIcon } from './money-icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TutoringFinanceTabs } from '@/components/layout/tutoring-finance-tabs';
import { ReflectionPrompts, RecentReflections } from './reflections';
import { DashboardSection, EmptyNote, ENTER, Panel, StatCard, stagger } from './stat-card';
import { SessionsCarousel } from './sessions-carousel';
import { SsnReceiptButton } from '@/features/users/ssn-receipt-button';
import { MonthlyFinance } from './monthly-finance';
import { YearEndPanel } from './year-end-panel';
import { useMonthlyFinance } from './api';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/**
 * Sessions newest-first, which is how every role wants to read them. On a
 * Tutoring tab it is passed `hideMoney`: that half carries no money at all.
 */
function SessionList({
  sessions,
  showTutor,
  hideMoney,
}: {
  sessions: TutoringSession[];
  showTutor?: boolean;
  hideMoney?: boolean;
}) {
  if (sessions.length === 0) return <EmptyNote>No sessions recorded yet.</EmptyNote>;

  return (
    <ul className="divide-border divide-y">
      {sessions.map((session) => (
        <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{session.student_name}</span>
            {showTutor && (
              <span className="text-muted-foreground"> with {session.tutor_name}</span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            {session.occurred_on} · {formatDuration(session.duration_minutes)}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {SESSION_MODE_LABELS[session.mode]}
          </Badge>
          {session.auto_stopped && (
            <Badge
              variant="outline"
              className="border-warning/60 text-warning-foreground dark:text-warning text-[10px]"
            >
              Auto-stopped
            </Badge>
          )}
          {!hideMoney && <SessionMoney session={session} compact className="w-24" />}
        </li>
      ))}
    </ul>
  );
}

function PaymentList({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return <EmptyNote>No payments recorded yet.</EmptyNote>;

  return (
    <ul className="divide-border divide-y">
      {payments.map((payment) => (
        <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{payment.party_name}</span>
            {payment.student_name && (
              <span className="text-muted-foreground"> for {payment.student_name}</span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            {new Date(payment.paid_at).toLocaleDateString(undefined, { dateStyle: 'medium' })} ·{' '}
            {PAYMENT_FORM_LABELS[payment.method]}
          </span>
          <span className="w-16 text-right text-sm font-medium tabular-nums">
            {formatCents(payment.amount_cents)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A balance, coloured only when there is something outstanding. */
function BalanceRow({
  name,
  detail,
  balance,
  to,
}: {
  name: string;
  detail: string;
  balance: number;
  to?: string;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground block truncate text-xs">{detail}</span>
      </span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          balance > 0 ? '' : 'text-muted-foreground',
        )}
      >
        {formatCents(balance)}
      </span>
    </>
  );

  if (!to) return <li className="flex items-center gap-3 py-2.5">{inner}</li>;

  return (
    <li>
      <Link to={to} className="hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors">
        {inner}
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function AdminView({ data }: { data: AdminDashboard }) {
  const year = new Date().getFullYear();
  const monthly = useMonthlyFinance(year);

  return (
    <TutoringFinanceTabs
      tutoring={
        <div className="space-y-6">
          <DashboardSection index={0} title="Analytics">
            <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
              <StatCard compact index={0} label="Students" value={data.counts.students} icon={ROLE_ICONS.student} to="/users?role=student" />
              <StatCard compact index={1} label="Tutors" value={data.counts.tutors} icon={ROLE_ICONS.tutor} to="/users?role=tutor" />
              <StatCard compact index={2} label="Parents" value={data.counts.parents} icon={ROLE_ICONS.parent} to="/users?role=parent" />
              <StatCard
                compact
                index={3}
                label="Sessions running"
                value={data.counts.live_sessions}
                icon={RadioIcon}
                tone={data.counts.live_sessions > 0 ? 'success' : 'default'}
              />
            </div>
          </DashboardSection>

          <DashboardSection index={4} title="Tutoring Sessions" action={{ label: 'All sessions', to: '/sessions' }}>
            <SessionsCarousel past={data.recent_sessions} showTutor />
          </DashboardSection>

          <DashboardSection index={5} title="Progress" action={{ label: 'All Progress', to: '/progress' }}>
            <ProgressSpotlight index={6} students={data.progress_spotlight} empty="No students yet." />
          </DashboardSection>

          <DashboardSection index={7} title="Recent Activity" action={{ label: 'Full log', to: '/activity' }}>
            <Card className="py-0">
              <CardContent className="px-4 py-2">
                <ActivityFeed events={data.recent_activity} />
              </CardContent>
            </Card>
          </DashboardSection>
        </div>
      }
      finance={
        <>
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              index={0}
              label="Owed to tutors"
              value={data.totals.owed_to_tutors_cents}
              money
              icon={WalletMinusIcon}
              tone="warning"
              to="/billing"
            />
            <StatCard
              index={1}
              label="Owed by families"
              value={data.totals.owed_by_families_cents}
              money
              icon={WalletPlusIcon}
              tone="brand"
              to="/billing"
            />
            <StatCard
              index={2}
              label="Billed all time"
              value={data.totals.billed_all_time_cents}
              money
              icon={BookOpenIcon}
              hint={`${data.totals.session_count} sessions`}
              to="/sessions?tab=finance"
            />
            <StatCard
              index={3}
              label="Kept by the institute"
              value={data.totals.margin_all_time_cents}
              money
              icon={PiggyBankIcon}
              tone="success"
              hint={`Paid out ${formatCents(data.totals.tutor_cost_all_time_cents)}`}
              to="/sessions?tab=finance"
            />
          </div>

          <MonthlyFinance data={monthly.data?.data} isLoading={monthly.isPending} index={4} />

          <div className="grid gap-4 lg:grid-cols-2">
            <YearEndPanel index={5} />
            <SsnPanel tutors={data.tutors_missing_ssn} />
          </div>

          <TopupPanel tutors={data.tutor_balances} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel index={8} title="Tutors awaiting payment" action={{ label: 'Billing', to: '/billing' }}>
              {data.tutor_balances.length === 0 ? (
                <EmptyNote>No tutors yet.</EmptyNote>
              ) : (
                <ul className="divide-border divide-y">
                  {data.tutor_balances.slice(0, 5).map((tutor) => (
                    <BalanceRow
                      key={tutor.user_id}
                      name={tutor.full_name}
                      detail={`${tutor.session_count} sessions · ${formatCents(tutor.earned_cents)} earned`}
                      balance={tutor.balance_cents}
                      to={`/dashboard?as=${tutor.user_id}&role=tutor`}
                    />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel index={9} title="Families with a balance" action={{ label: 'Billing', to: '/billing' }}>
              {data.student_balances.length === 0 ? (
                <EmptyNote>No students yet.</EmptyNote>
              ) : (
                <ul className="divide-border divide-y">
                  {data.student_balances.slice(0, 5).map((student) => (
                    <BalanceRow
                      key={student.student_user_id}
                      name={student.student_name}
                      detail={student.guardians.map((g) => g.full_name).join(', ') || 'No guardian'}
                      balance={student.balance_cents}
                      to={`/dashboard?as=${student.student_user_id}&role=student`}
                    />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      }
    />
  );
}

/**
 * Tutors the institute cannot issue a tax document for, because it does not
 * have their SSN.
 *
 * Shown as work to chase rather than a statistic, and never anywhere to enter
 * a number: the office collects it outside the portal and records only that
 * it arrived.
 */
function SsnPanel({ tutors }: { tutors: { user_id: string; full_name: string }[] }) {
  if (tutors.length === 0) return null;

  return (
    <Panel
      index={6}
      title={`SSN not on file · ${tutors.length}`}
      action={{ label: 'Users', to: '/users' }}
    >
      <p className="text-muted-foreground mb-3 text-sm">
        A tax document cannot be issued without it. Collect it from each tutor directly — never
        through the portal — then confirm it on their record.
      </p>
      <ul className="divide-border divide-y">
        {tutors.map((tutor) => (
          <li
            key={tutor.user_id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <Link
              to={`/users?view=${tutor.user_id}`}
              className="hover:text-primary text-sm font-medium transition-colors"
            >
              {tutor.full_name}
            </Link>
            {/* The action sits where the admin notices the problem. Having to
                go and find the tutor's record to tick it off is what made this
                impossible to use. */}
            <SsnReceiptButton
              userId={tutor.user_id}
              fullName={tutor.full_name}
              received={false}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Which tutors on an advance have worked it down past their agreed level, and
 * what it would take to restore each one.
 *
 * The one piece of this feature that is a to-do list rather than a figure, so
 * it leads the panels. It says nothing at all when no tutor is on an advance
 * -- an institute that does not pay up front should not be told about a
 * mechanism it does not use -- but it does speak up when everyone is topped
 * up, because "nothing to do" is the answer the office is looking for.
 */
function TopupPanel({ tutors }: { tutors: TutorBalance[] }) {
  const onAdvance = tutors.filter((tutor) => tutor.topup_amount_cents != null);
  if (onAdvance.length === 0) return null;

  const due = onAdvance.filter((tutor) => needsTopup(tutor));
  const total = due.reduce((sum, tutor) => sum + (topupDueCents(tutor) ?? 0), 0);

  return (
    <Panel
      index={7}
      title={due.length === 0 ? 'Advances' : `Top-ups due · ${formatCents(total)}`}
      action={{ label: 'Billing', to: '/billing' }}
    >
      {due.length === 0 ? (
        <EmptyNote>
          All {onAdvance.length} {onAdvance.length === 1 ? 'tutor' : 'tutors'} on an advance are
          above their top-up level.
        </EmptyNote>
      ) : (
        <ul className="divide-border divide-y">
          {due.map((tutor) => (
            <BalanceRow
              key={tutor.user_id}
              name={tutor.full_name}
              detail={
                `holds ${formatCents(tutorAdvanceCents(tutor))} of ` +
                `${formatCents(tutor.topup_amount_cents ?? 0)}`
              }
              balance={topupDueCents(tutor) ?? 0}
              to={`/dashboard?as=${tutor.user_id}&role=tutor`}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

export function TutorView({ data, subjectId }: { data: TutorDashboard; subjectId?: string }) {
  // Only shown to a tutor the institute actually pays in advance.
  const advance = data.earnings.topup_amount_cents == null ? null : data.earnings;
  const year = new Date().getFullYear();
  // For an admin's "view as", the rundown is the tutor's, not the institute's.
  const monthly = useMonthlyFinance(year, subjectId);

  return (
    <TutoringFinanceTabs
      tutoring={
        // No money on this half: a tutor may have it open beside a student.
        // What they earned is the Finance tab's first figure.
        <div className="space-y-6">
          <DashboardSection index={0} title="Analytics">
            <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
              <StatCard compact index={0} label="Students" value={data.students.length} icon={ROLE_ICONS.student} to="/assignments" />
              <StatCard compact index={1} label="Sessions" value={data.earnings.session_count} icon={BookOpenIcon} to="/sessions" />
              <StatCard
                compact
                index={2}
                label="Sessions running"
                value={data.live_sessions}
                icon={RadioIcon}
                tone={data.live_sessions > 0 ? 'success' : 'default'}
              />
            </div>
          </DashboardSection>

          <DashboardSection index={3} title="Tutoring Sessions" action={{ label: 'All sessions', to: '/sessions' }}>
            {/* Only lessons they teach, even for an admin viewing as them. */}
            <SessionsCarousel
              past={data.recent_sessions}
              tutorUserId={data.earnings.user_id}
              showTutor={false}
            />
          </DashboardSection>

          {/* Phase 25: what their students made of recent lessons, beside the
              lessons themselves. Teaching, so here; and never money. */}
          <DashboardSection index={4} title="Student Reflections" action={{ label: 'All sessions', to: '/sessions' }}>
            <Card className="py-0">
              <CardContent className="px-4 py-2">
                <RecentReflections digests={data.recent_reflections} />
              </CardContent>
            </Card>
          </DashboardSection>

          <DashboardSection index={5} title="Progress" action={{ label: 'All Progress', to: '/progress' }}>
            <ProgressSpotlight
              index={6}
              students={data.progress_spotlight}
              empty="No students assigned to you yet."
            />
          </DashboardSection>

          <DashboardSection index={7} title="Recent Activity" action={{ label: 'Full log', to: '/activity' }}>
            <Card className="py-0">
              <CardContent className="px-4 py-2">
                <ActivityFeed events={data.recent_activity} showActor={false} />
              </CardContent>
            </Card>
          </DashboardSection>
        </div>
      }
      finance={
        <>
          {/* The tax notice leads the finance tab, because it is the one thing
              here the tutor has to act on rather than read. */}
          {!data.ssn_received_on && (
            <Panel index={0} title="Action needed: your SSN">
              <p className="text-sm">
                The institute does not have your Social Security number, and needs it to issue
                your tax document at the end of the year.
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Give it to the office directly — in person, or however you normally reach them.{' '}
                <span className="font-medium">Never send it through this portal</span>, which
                does not store it and has nowhere to put it. They will mark it received once
                they have it.
              </p>
            </Panel>
          )}

          <div
            className={cn(
              'grid items-start gap-3 sm:grid-cols-2',
              advance ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            )}
          >
            <StatCard index={1} label="Earned" value={data.earnings.earned_cents} money icon={WalletIcon} to="/sessions?tab=finance" />
            <StatCard
              index={2}
              label="Paid to you"
              value={data.earnings.paid_cents}
              money
              icon={WalletMinusIcon}
              to="/billing"
            />
            <StatCard
              index={3}
              label="Owed to you"
              // A tutor on an advance is usually in credit, and "owed to you
              // -$167.50" is not a thing anybody is owed: what it means is
              // that they hold money they have not worked off, which the next
              // card says properly.
              value={advance ? Math.max(0, data.earnings.balance_cents) : data.earnings.balance_cents}
              money
              icon={WalletPlusIcon}
              tone={data.earnings.balance_cents > 0 ? 'warning' : 'default'}
              hint={advance && data.earnings.balance_cents <= 0 ? 'Paid up front' : undefined}
              to="/billing"
            />
            {advance && (
              <StatCard
                index={4}
                label="Advance held"
                value={tutorAdvanceCents(advance)}
                money
                icon={PiggyBankIcon}
                tone={needsTopup(advance) ? 'warning' : 'success'}
                hint={
                  needsTopup(advance)
                    ? `Below your ${formatCents(advance.topup_amount_cents ?? 0)} level — a top-up is due`
                    : `Topped up below ${formatCents(advance.topup_amount_cents ?? 0)}`
                }
                to="/billing"
              />
            )}
          </div>

          <MonthlyFinance data={monthly.data?.data} isLoading={monthly.isPending} index={5} />

          <Panel index={6} title="Payments to you" action={{ label: 'Billing', to: '/billing' }}>
            <PaymentList payments={data.recent_payments} />
          </Panel>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

export function ParentView({ data }: { data: ParentDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Children" value={data.children.length} icon={ROLE_ICONS.student} />
        <StatCard index={1} label="Charged" value={data.totals.charged_cents} money icon={BookOpenIcon} to="/sessions?tab=finance" />
        <StatCard
          index={2}
          label="Outstanding"
          value={data.totals.balance_cents}
          money
          icon={WalletMinusIcon}
          tone={data.totals.balance_cents > 0 ? 'brand' : 'success'}
          hint={`${formatCents(data.totals.paid_cents)} paid`}
          to="/billing"
        />
      </div>

      <Panel index={3} title="Your children">
        {data.children.length === 0 ? (
          <EmptyNote>No students are linked to you yet.</EmptyNote>
        ) : (
          <ul className="divide-border divide-y">
            {data.children.map((child) => (
              <BalanceRow
                key={child.student_user_id}
                name={child.student_name}
                detail={`${child.session_count} sessions · ${formatCents(child.charged_cents)} charged`}
                balance={child.balance_cents}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Phase 25: their children's recent lessons still waiting for a
          reflection -- most children never sign in, so it is answered together. */}
      <ReflectionPrompts index={4} prompts={data.awaiting_reflection} forChildren />

      {data.progress.map((child, position) => (
        <StudentProgressCard
          key={child.student.user_id}
          index={4 + position}
          progress={child}
          title={`${child.student.full_name}'s progress`}
        />
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel index={4} title="Recent sessions" action={{ label: 'All sessions', to: '/sessions' }}>
          <SessionList sessions={data.recent_sessions} showTutor />
        </Panel>

        <Panel index={5} title="Your payments" action={{ label: 'Billing', to: '/billing' }}>
          <PaymentList payments={data.recent_payments} />
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export function StudentView({ data }: { data: StudentDashboard }) {
  return (
    <div className="space-y-6">
      {/* The learning plan's goal replaces the one-line ambition once there is one. */}
      {data.goal && !data.progress?.plan && (
        <div className={cn('brand-gradient rounded-lg p-5 text-white', ENTER)} style={stagger(0)}>
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-white/80 uppercase">
            <TargetIcon className="size-4" />
            Your goal this year
          </p>
          <p className="font-display mt-2 text-xl font-semibold">{data.goal}</p>
          {data.current_math_course && (
            <p className="mt-1 text-sm text-white/85">Currently: {data.current_math_course}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={1} label="Sessions" value={data.totals.session_count} icon={BookOpenIcon} to="/sessions" />
        <StatCard
          index={2}
          label="Time tutored"
          value={data.totals.total_minutes}
          formatValue={formatDuration}
          icon={ActivityIcon}
        />
        <StatCard index={3} label="Tutors" value={data.tutors.length} icon={ROLE_ICONS.tutor} />
      </div>

      {/* Phase 25: the lessons still waiting for their reflection, near the
          top, because it is the one thing here they are asked to do. */}
      <ReflectionPrompts index={4} prompts={data.awaiting_reflection} />

      {data.progress && (
        <StudentProgressCard index={4} progress={data.progress} title="Your progress" />
      )}

      <Panel index={4} title="Your tutors">
        {data.tutors.length === 0 ? (
          <EmptyNote>No tutors assigned yet.</EmptyNote>
        ) : (
          <ul className="divide-border divide-y">
            {data.tutors.map((tutor) => (
              <li key={tutor.user_id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{tutor.full_name}</span>
                <Badge variant="secondary" className="text-xs">
                  {tutor.session_count} sessions
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel index={5} title="Your sessions" action={{ label: 'All sessions', to: '/sessions' }}>
        <SessionList sessions={data.recent_sessions} showTutor />
      </Panel>
    </div>
  );
}
