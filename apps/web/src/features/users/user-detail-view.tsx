import {
  CalendarClockIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  HistoryIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  ShieldCheckIcon,
  PiggyBankIcon,
  SchoolIcon,
  TargetIcon,
  TimerIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  DAYS_OF_WEEK,
  DEFAULT_MAX_SESSION_MINUTES,
  PAYMENT_METHOD_LABELS,
  RELATIONSHIP_LABELS,
  formatCents,
  formatDuration,
  formatMailingAddress,
  formatTimeRange,
  groupSlotsByDay,
  type UserDetail,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAuditEvents } from '@/features/audit/api';
import { SsnReceiptButton } from './ssn-receipt-button';
import { ActivityFeed } from '@/features/audit/activity-feed';
import { CommentThread } from '@/features/comments/comment-thread';
import { DeletedBadge, EmailOrNone, RoleBadges, StatusBadge } from './user-badges';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Renders an ISO-8601 UTC timestamp in the viewer's own locale and zone. */
function formatTimestamp(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The whole record for one person, assembled from every table that hangs off
 * `users`. Sections are hidden rather than shown empty, so the layout reflects
 * which roles the person actually holds.
 */
export function UserDetailView({ user }: { user: UserDetail }) {
  const admin = user.admin_profile;
  const tutor = user.tutor_profile;
  const student = user.student_profile;
  const { user: viewer } = useAuth();
  // A tutor's rates are their pay, and their SSN receipt is between them and
  // the office: the API sends both to an admin and to the tutor, and to nobody
  // else. "Not set" or "Not received" would be a false claim to a family, so
  // for them the rows are left out rather than shown empty.
  const seesTutorPay = (viewer?.roles.includes('admin') ?? false) || viewer?.id === user.id;
  const availabilityByDay = groupSlotsByDay(user.availability);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200 font-display flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
        >
          {initials(user.full_name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{user.full_name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RoleBadges roles={user.roles} />
            <StatusBadge status={user.status} />
            {user.deleted_at && <DeletedBadge />}
          </div>
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-4 border-t pt-5 sm:grid-cols-2">
        <Detail icon={<MailIcon className="size-4" />} label="Email">
          <EmailOrNone email={user.email} className="hover:text-primary break-all" />
        </Detail>
        <Detail icon={<PhoneIcon className="size-4" />} label="Phone">
          {user.phone ?? <Muted>Not recorded</Muted>}
        </Detail>
        <Detail icon={<CalendarClockIcon className="size-4" />} label="Last sign-in">
          {formatTimestamp(user.last_login_at, 'Has not signed in yet')}
        </Detail>
        <Detail icon={<CalendarClockIcon className="size-4" />} label="Added to the portal">
          {formatTimestamp(user.created_at, '—')}
        </Detail>
      </dl>

      {admin?.tin && (
        <Section title="Admin" icon={<ShieldCheckIcon className="size-4" />}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail icon={<WalletIcon className="size-4" />} label="Institute TIN">
              {admin.tin}
            </Detail>
          </dl>
        </Section>
      )}

      {tutor && (
        <Section title="Tutor" icon={<GraduationCapIcon className="size-4" />}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail icon={<GraduationCapIcon className="size-4" />} label="Education">
              {tutor.highest_education ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon={<SchoolIcon className="size-4" />} label="School">
              {tutor.school ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon={<MapPinIcon className="size-4" />} label="Area">
              {tutor.area ?? <Muted>Not recorded</Muted>}
            </Detail>
            {/* For their 1099; the API blanks it for anyone else anyway. */}
            {seesTutorPay && (
              <Detail icon={<MailIcon className="size-4" />} label="Mailing address">
                {formatMailingAddress(tutor) ? (
                  <span className="whitespace-pre-line">{formatMailingAddress(tutor)}</span>
                ) : (
                  <Muted>Not recorded</Muted>
                )}
              </Detail>
            )}
            <Detail icon={<VideoIcon className="size-4" />} label="Virtual tutoring">
              {tutor.virtual_available ? 'Available' : 'In person only'}
            </Detail>
            {seesTutorPay && (
              <>
                <Detail icon={<WalletIcon className="size-4" />} label="In-person pay rate">
                  {tutor.default_rate_in_person_cents != null ? (
                    `${formatCents(tutor.default_rate_in_person_cents)} / hr`
                  ) : (
                    <Muted>Not set</Muted>
                  )}
                </Detail>
                <Detail icon={<WalletIcon className="size-4" />} label="Virtual pay rate">
                  {tutor.default_rate_virtual_cents != null ? (
                    `${formatCents(tutor.default_rate_virtual_cents)} / hr`
                  ) : (
                    <Muted>Not set</Muted>
                  )}
                </Detail>
              </>
            )}
            <Detail icon={<TimerIcon className="size-4" />} label="Longest session">
              {tutor.max_session_minutes != null ? (
                formatDuration(tutor.max_session_minutes)
              ) : (
                <Muted>{formatDuration(DEFAULT_MAX_SESSION_MINUTES)} (institute default)</Muted>
              )}
            </Detail>
            {/* Between the tutor and the office: the API blanks it for anyone
                else, and "Not received" would be a false alarm to a family. */}
            {seesTutorPay && (
              <Detail icon={<ShieldCheckIcon className="size-4" />} label="SSN on file">
                <SsnStatus
                  userId={user.id}
                  fullName={user.full_name}
                  receivedOn={tutor.ssn_received_on}
                />
              </Detail>
            )}
            {/* The API blanks this for anyone but an admin and the tutor
                themselves: what the office advances a tutor is not the
                business of the families they teach. */}
            {tutor.topup_amount_cents != null && (
              <Detail icon={<PiggyBankIcon className="size-4" />} label="Top up below">
                {`${formatCents(tutor.topup_amount_cents)} advance`}
              </Detail>
            )}
          </dl>
          {tutor.availability_notes && (
            <p className="text-muted-foreground mt-4 text-sm">{tutor.availability_notes}</p>
          )}
        </Section>
      )}

      {student && (
        <Section title="Student" icon={<SchoolIcon className="size-4" />}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail icon={<SchoolIcon className="size-4" />} label="School">
              {student.school ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon={<GraduationCapIcon className="size-4" />} label="Current course">
              {student.current_math_course ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon={<TargetIcon className="size-4" />} label="Goal this year">
              {student.academic_year_goal ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon={<VideoIcon className="size-4" />} label="Virtual sessions">
              {student.virtual_available ? 'Available' : 'In person only'}
            </Detail>
            {/* The API sends these to an admin and to the student's own
                family -- it is what they pay -- and blanks them for a tutor,
                who knows their own rate and would learn the margin. */}
            {student.charge_rate_in_person_cents != null && (
              <Detail icon={<WalletIcon className="size-4" />} label="In-person price">
                {`${formatCents(student.charge_rate_in_person_cents)} / hr`}
              </Detail>
            )}
            {student.charge_rate_virtual_cents != null && (
              <Detail icon={<WalletIcon className="size-4" />} label="Virtual price">
                {`${formatCents(student.charge_rate_virtual_cents)} / hr`}
              </Detail>
            )}
            <Detail icon={<TimerIcon className="size-4" />} label="Longest session">
              {student.max_session_minutes != null ? (
                formatDuration(student.max_session_minutes)
              ) : (
                <Muted>{formatDuration(DEFAULT_MAX_SESSION_MINUTES)} (institute default)</Muted>
              )}
            </Detail>
          </dl>
        </Section>
      )}

      {user.availability.length > 0 && (
        <Section title="Availability" icon={<CalendarClockIcon className="size-4" />}>
          <ul className="grid gap-1.5 text-sm">
            {availabilityByDay.map(({ day_of_week, ranges }) => (
              <li key={day_of_week} className="flex flex-wrap items-baseline gap-2">
                <span className="text-muted-foreground w-20 shrink-0 text-xs">
                  {DAYS_OF_WEEK[day_of_week]?.label}
                </span>
                {/* Consecutive hours are collapsed, so 16,17,18 reads as one block. */}
                {ranges.map((range) => (
                  <Badge key={range.start} variant="secondary" className="text-xs">
                    {formatTimeRange(range.start * 60, range.end * 60)}
                  </Badge>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {user.payment_handles.length > 0 && (
        <Section title="Payment" icon={<WalletIcon className="size-4" />}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {user.payment_handles.map((handle) => (
              <Detail
                key={handle.method}
                icon={<WalletIcon className="size-4" />}
                label={PAYMENT_METHOD_LABELS[handle.method]}
              >
                {handle.handle}
              </Detail>
            ))}
          </dl>
        </Section>
      )}

      {user.guardians.length > 0 && (
        <Section title="Parents & guardians" icon={<HeartHandshakeIcon className="size-4" />}>
          <PeopleList people={user.guardians} />
        </Section>
      )}

      {user.dependents.length > 0 && (
        <Section title="Responsible for" icon={<UsersIcon className="size-4" />}>
          <PeopleList people={user.dependents} />
        </Section>
      )}

      {/* Above the activity feed on purpose: what people have SAID about
          someone matters more on their record than what the system logged. */}
      <Section title="Comments" icon={<MessageSquareIcon className="size-4" />}>
        <CommentThread target={{ target_type: 'user', target_id: user.id }} />
      </Section>

      <RecentActivity userId={user.id} />
    </div>
  );
}

/**
 * The per-profile activity rundown. Shows what this person did AND what was
 * done to them, which is why an admin editing your record appears in your
 * feed.
 *
 * Renders nothing at all when there is no activity, so profiles created before
 * auditing existed do not show an empty panel.
 */
function RecentActivity({ userId }: { userId: string }) {
  const { data, isPending } = useAuditEvents({ user_id: userId, limit: 8 });

  const events = data?.data ?? [];
  if (!isPending && events.length === 0) return null;

  return (
    <Section title="Recent activity" icon={<HistoryIcon className="size-4" />}>
      <ActivityFeed events={events} isLoading={isPending} />
      {data && data.meta.total > events.length && (
        <p className="text-muted-foreground mt-2 px-2 text-xs">
          Showing the latest {events.length} of {data.meta.total} events.
        </p>
      )}
    </Section>
  );
}

function PeopleList({
  people,
}: {
  people: {
    user_id: string;
    full_name: string;
    email: string | null;
    relationship: string;
    is_primary: boolean;
  }[];
}) {
  return (
    <ul className="grid gap-2">
      {people.map((person) => (
        <li key={person.user_id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{person.full_name}</span>
          <Badge variant="outline" className="text-xs">
            {RELATIONSHIP_LABELS[person.relationship as keyof typeof RELATIONSHIP_LABELS]}
          </Badge>
          {person.is_primary && (
            <Badge variant="secondary" className="text-xs">
              Primary contact
            </Badge>
          )}
          <a
            href={person.email ? `mailto:${person.email}` : undefined}
            className="text-muted-foreground hover:text-primary text-xs"
          >
            {person.email ?? 'No email'}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether the office holds this tutor's SSN, and an admin's control to say so.
 *
 * The only thing recorded is the fact and the date. There is no field here for
 * the number, because the portal has nowhere to keep one -- an admin collects
 * it outside and ticks this afterwards.
 */
function SsnStatus({
  userId,
  fullName,
  receivedOn,
}: {
  userId: string;
  fullName: string;
  receivedOn: string | null;
}) {
  const { user: viewer } = useAuth();
  const isAdmin = viewer?.roles.includes('admin') ?? false;

  return (
    <span className="flex flex-wrap items-center gap-2">
      {receivedOn ? (
        <span>Received {receivedOn}</span>
      ) : (
        <Badge variant="outline" className="border-warning/60 text-warning-foreground dark:text-warning">
          Not received
        </Badge>
      )}
      {isAdmin && (
        <SsnReceiptButton userId={userId} fullName={fullName} received={Boolean(receivedOn)} />
      )}
    </span>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <Separator className="mb-5" />
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
