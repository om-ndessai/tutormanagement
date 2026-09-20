import { Link } from 'react-router-dom';
import {
  ActivityIcon,
  BookOpenIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  RadioIcon,
  ShieldCheckIcon,
  TargetIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import {
  PAYMENT_FORM_LABELS,
  SESSION_MODE_LABELS,
  formatCents,
  formatDuration,
  type AdminDashboard,
  type ParentDashboard,
  type Payment,
  type StudentDashboard,
  type TutoringSession,
  type TutorDashboard,
} from '@tmi/shared';

import { ActivityFeed } from '@/features/audit/activity-feed';
import { Badge } from '@/components/ui/badge';
import { EmptyNote, ENTER, Panel, StatCard, stagger } from './stat-card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Sessions newest-first, which is how every role wants to read them. */
function SessionList({ sessions, showTutor }: { sessions: TutoringSession[]; showTutor?: boolean }) {
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
          <span className="w-16 text-right text-sm font-medium tabular-nums">
            {formatCents(session.amount_cents)}
          </span>
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
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Students" value={data.counts.students} icon={UsersIcon} to="/users?role=student" />
        <StatCard index={1} label="Tutors" value={data.counts.tutors} icon={GraduationCapIcon} to="/users?role=tutor" />
        <StatCard index={2} label="Parents" value={data.counts.parents} icon={HeartHandshakeIcon} to="/users?role=parent" />
        <StatCard index={3} label="Admins" value={data.counts.admins} icon={ShieldCheckIcon} to="/users?role=admin" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={4}
          label="Owed to tutors"
          value={data.totals.owed_to_tutors_cents}
          money
          icon={WalletIcon}
          tone="warning"
          to="/billing"
        />
        <StatCard
          index={5}
          label="Owed by families"
          value={data.totals.owed_by_families_cents}
          money
          icon={WalletIcon}
          tone="brand"
          to="/billing"
        />
        <StatCard
          index={6}
          label="Billed all time"
          value={data.totals.billed_all_time_cents}
          money
          icon={BookOpenIcon}
          hint={`${data.totals.session_count} sessions`}
          to="/sessions"
        />
        <StatCard
          index={7}
          label="Sessions running"
          value={data.counts.live_sessions}
          icon={RadioIcon}
          tone={data.counts.live_sessions > 0 ? 'success' : 'default'}
          hint={data.counts.live_sessions > 0 ? 'Being taught right now' : 'None in progress'}
        />
      </div>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel index={10} title="Latest sessions" action={{ label: 'All sessions', to: '/sessions' }}>
          <SessionList sessions={data.recent_sessions} showTutor />
        </Panel>

        <Panel index={11} title="Recent activity" action={{ label: 'Full log', to: '/activity' }}>
          <ActivityFeed events={data.recent_activity} />
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

export function TutorView({ data }: { data: TutorDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Students" value={data.students.length} icon={UsersIcon} to="/assignments" />
        <StatCard index={1} label="Sessions" value={data.earnings.session_count} icon={BookOpenIcon} to="/sessions" />
        <StatCard index={2} label="Earned" value={data.earnings.earned_cents} money icon={WalletIcon} to="/sessions" />
        <StatCard
          index={3}
          label="Owed to you"
          value={data.earnings.balance_cents}
          money
          icon={WalletIcon}
          tone={data.earnings.balance_cents > 0 ? 'warning' : 'default'}
          hint={`${formatCents(data.earnings.paid_cents)} paid so far`}
          to="/billing"
        />
      </div>

      <Panel index={4} title="Your students" action={{ label: 'Assignments', to: '/assignments' }}>
        {data.students.length === 0 ? (
          <EmptyNote>No students assigned to you yet.</EmptyNote>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.students.map((student, position) => (
              <div
                key={student.user_id}
                className={cn('rounded-lg border p-3 transition-colors hover:border-primary/40', ENTER)}
                style={stagger(position + 5)}
              >
                <p className="font-medium">{student.full_name}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {student.current_math_course ?? 'No course recorded'}
                  {student.school ? ` · ${student.school}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{student.session_count} sessions</Badge>
                  <span className="text-muted-foreground">
                    {formatCents(student.earned_cents)} earned
                  </span>
                  {student.last_session_on && (
                    <span className="text-muted-foreground">last {student.last_session_on}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel index={12} title="Your recent sessions" action={{ label: 'All sessions', to: '/sessions' }}>
          <SessionList sessions={data.recent_sessions} />
        </Panel>

        <Panel index={13} title="Payments to you" action={{ label: 'Billing', to: '/billing' }}>
          <PaymentList payments={data.recent_payments} />
        </Panel>
      </div>

      <Panel index={14} title="Your activity" action={{ label: 'Full log', to: '/activity' }}>
        <ActivityFeed events={data.recent_activity} showActor={false} />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

export function ParentView({ data }: { data: ParentDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Children" value={data.children.length} icon={UsersIcon} />
        <StatCard index={1} label="Charged" value={data.totals.charged_cents} money icon={BookOpenIcon} to="/sessions" />
        <StatCard
          index={2}
          label="Outstanding"
          value={data.totals.balance_cents}
          money
          icon={WalletIcon}
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
      {data.goal && (
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
          value={Math.round(data.totals.total_minutes / 60)}
          icon={ActivityIcon}
          hint={formatDuration(data.totals.total_minutes)}
        />
        <StatCard index={3} label="Tutors" value={data.tutors.length} icon={GraduationCapIcon} />
      </div>

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
