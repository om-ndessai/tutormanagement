import {
  CalendarClockIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  HistoryIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SchoolIcon,
  TargetIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  DAYS_OF_WEEK,
  PAYMENT_METHOD_LABELS,
  RELATIONSHIP_LABELS,
  groupSlotsByDay,
  type UserDetail,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuditEvents } from '@/features/audit/api';
import { ActivityFeed } from '@/features/audit/activity-feed';
import { DeletedBadge, RoleBadges, StatusBadge } from './user-badges';

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

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The whole record for one person, assembled from every table that hangs off
 * `users`. Sections are hidden rather than shown empty, so the layout reflects
 * which roles the person actually holds.
 */
export function UserDetailView({ user }: { user: UserDetail }) {
  const tutor = user.tutor_profile;
  const student = user.student_profile;
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
          <a href={`mailto:${user.email}`} className="hover:text-primary break-all">
            {user.email}
          </a>
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
            <Detail icon={<VideoIcon className="size-4" />} label="Virtual tutoring">
              {tutor.virtual_available ? 'Available' : 'In person only'}
            </Detail>
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
                  <Badge key={range.start} variant="secondary" className="font-mono text-xs">
                    {pad(range.start)}:00–{pad(range.end)}:00
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
  people: { user_id: string; full_name: string; email: string; relationship: string; is_primary: boolean }[];
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
            href={`mailto:${person.email}`}
            className="text-muted-foreground hover:text-primary text-xs"
          >
            {person.email}
          </a>
        </li>
      ))}
    </ul>
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
