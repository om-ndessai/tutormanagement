// Ported from apps/web/src/features/users/user-detail-view.tsx @ 1132322.
//
// The whole record for one person, assembled from every table that hangs off `users`. Sections are
// hidden rather than shown empty, so the layout reflects which roles the person holds. What a
// reader may see is the server's: the rates, advance, mailing address, handles, SSN receipt and
// family links arrive blanked for anyone who may not see them (R4-R7), and the rows that would
// claim "Not set" to a family are left out on top of that.
import {
  DAYS_OF_WEEK,
  DEFAULT_MAX_SESSION_MINUTES,
  PAYMENT_METHOD_LABELS,
  RELATIONSHIP_LABELS,
  formatDuration,
  formatMailingAddress,
  featureAllowed,
  formatTimeRange,
  groupSlotsByDay,
  type GuardianLink,
  type PaymentHandle,
  type UserDetail,
} from '@tmi/shared';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { AdaptiveRow } from '@/components/adaptive-row';
import { useLargeText } from '@/hooks/use-large-text';
import { ActivityFeed } from '@/features/audit/activity-feed';
import { CommentsRow } from '@/features/comments/comments-button';
import { useAuditEvents } from '@/features/audit/api';
import { LocationsList } from '@/features/locations/locations-list';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { Detail, Muted, Section } from './detail-row';
import { formatInstant, telUrl } from './people-model';
import { PersonAvatar } from './person-avatar';
import { RECORD_SECTIONS, recordSections, type RecordSectionKey } from './record-sections';
import { SsnReceiptButton } from './ssn-receipt-button';
import { TaxSetupCard, needsTaxSetup } from './tax-setup-card';
import { DeletedBadge, EmailOrNone, RoleBadges, StatusBadge } from './user-badges';
import { StudentPrices, TutorPayRates, TutorTopup } from './user-rates';

export function UserDetailView({
  user,
  compact = false,
}: {
  user: UserDetail;
  /**
   * The details alone, without the comments and the activity -- for the onboarding wizard's
   * "confirm your details" (#34), which has its own way to tell the office.
   */
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const { user: viewer, organization } = useAuth();
  // Phase 50: Tutoring's sections, locations, comments and tax setup only where the space has it.
  const tutoring = featureAllowed(organization, 'tutoring');
  const tutor = user.tutor_profile;
  const student = user.student_profile;
  const isAdmin = viewer?.roles.includes('admin') ?? false;
  const availabilityByDay = groupSlotsByDay(user.availability);
  const tel = telUrl(user.phone);
  const address = tutor ? formatMailingAddress(tutor) : null;
  const large = useLargeText();
  const longest = (minutes: number | null) =>
    minutes != null ? (
      formatDuration(minutes)
    ) : (
      <Muted>{`${formatDuration(DEFAULT_MAX_SESSION_MINUTES)} (institute default)`}</Muted>
    );

  const sections = recordSections(user, viewer, { compact, tutoring });
  const editSection = (key: RecordSectionKey) =>
    router.push({ pathname: '/person-form', params: { id: user.id, section: key } });

  function renderSection(key: RecordSectionKey) {
    switch (key) {
      case 'contact':
        return (
          <>
            <Detail icon="email-outline" label="Email">
              <EmailOrNone testID="person-email" email={user.email} style={{ fontSize: 14 }} />
            </Detail>
            <Detail icon="phone-outline" label="Phone" testID="person-phone">
              {user.phone ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon="calendar-clock-outline" label="Last sign-in">
              {formatInstant(user.last_login_at, timeZone, 'Has not signed in yet')}
            </Detail>
            <Detail icon="calendar-clock-outline" label="Added to the portal">
              {formatInstant(user.created_at, timeZone, '—')}
            </Detail>
          </>
        );
      case 'background':
        return tutor ? (
          <>
            <Detail icon="school-outline" label="Education">
              {tutor.highest_education ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon="domain" label="School">
              {tutor.school ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon="map-marker-outline" label="Area">
              {tutor.area ?? <Muted>Not recorded</Muted>}
            </Detail>
          </>
        ) : null;
      case 'school':
        return student ? (
          <>
            <Detail icon="domain" label="School">
              {student.school ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon="school-outline" label="Current course">
              {student.current_math_course ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon="target" label="Goal this year">
              {student.academic_year_goal ?? <Muted>Not recorded</Muted>}
            </Detail>
          </>
        ) : null;
      case 'availability':
        return (
          <View style={{ gap: space.sm }}>
            {availabilityByDay.length === 0 ? <Muted>No hours set yet.</Muted> : null}
            {availabilityByDay.map(({ day_of_week, ranges }) => (
              <View
                key={day_of_week}
                style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
              >
                <Text variant="bodySmall" style={{ width: 84, color: theme.tokens.mutedForeground }}>
                  {DAYS_OF_WEEK[day_of_week]?.label}
                </Text>
                {/* Consecutive hours are collapsed, so 16, 17, 18 reads as one block. */}
                {ranges.map((range) => (
                  <View
                    key={range.start}
                    style={{
                      backgroundColor: theme.colors.secondaryContainer,
                      borderRadius: radius.sm,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.colors.onSecondaryContainer }}>
                      {formatTimeRange(range.start * 60, range.end * 60)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            {tutor?.availability_notes ? (
              <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
                {tutor.availability_notes}
              </Text>
            ) : null}
          </View>
        );
      case 'teaching':
        return tutor ? (
          <>
            <Detail icon="video-outline" label="Virtual tutoring">
              {tutor.virtual_available ? 'Available' : 'In person only'}
            </Detail>
            <Detail icon="timer-outline" label="Longest session">
              {longest(tutor.max_session_minutes)}
            </Detail>
          </>
        ) : null;
      case 'lessons':
        return student ? (
          <>
            <Detail icon="video-outline" label="Virtual sessions">
              {student.virtual_available ? 'Available' : 'In person only'}
            </Detail>
            <StudentPrices student={student} />
            <Detail icon="timer-outline" label="Longest session">
              {longest(student.max_session_minutes)}
            </Detail>
          </>
        ) : null;
      case 'pay':
        // Only the tutor and the office reach this section (`recordSections`); the server blanks it
        // for anyone else anyway.
        return tutor ? (
          <>
            <TutorPayRates tutor={tutor} />
            <TutorTopup tutor={tutor} />
            <Detail testID="person-mailing-address" icon="email-outline" label="Mailing address">
              {address ?? <Muted>Not recorded</Muted>}
            </Detail>
            {/* Between the tutor and the office: "Not received" would be a false alarm to a family. */}
            <Detail testID="person-ssn" icon="shield-check-outline" label="SSN on file">
              <SsnStatus
                userId={user.id}
                fullName={user.full_name}
                receivedOn={tutor.ssn_received_on}
                isAdmin={isAdmin}
              />
            </Detail>
            <PaymentHandles handles={user.payment_handles} />
          </>
        ) : null;
      case 'payment':
        return <PaymentHandles handles={user.payment_handles} empty="None recorded" />;
      case 'family':
        return (
          <>
            {user.guardians.length > 0 ? (
              <View testID="person-section-guardians" style={{ gap: space.sm }}>
                <Muted>{'Parents & guardians'}</Muted>
                <PeopleList people={user.guardians} kind="guardian" />
              </View>
            ) : null}
            {user.dependents.length > 0 ? (
              <View testID="person-section-dependents" style={{ gap: space.sm }}>
                <Muted>Responsible for</Muted>
                <PeopleList people={user.dependents} kind="dependent" />
              </View>
            ) : null}
            {user.guardians.length === 0 && user.dependents.length === 0 ? (
              <Muted>No parent or guardian linked yet.</Muted>
            ) : null}
          </>
        );
    }
  }

  return (
    <View style={{ gap: space.xl }}>
      <AdaptiveRow align="center" gap={space.lg}>
        <PersonAvatar name={user.full_name} size={64} />
        <View style={{ flex: large ? undefined : 1, minWidth: 0, gap: space.sm }}>
          <Text testID="person-name" variant="titleLarge" numberOfLines={large ? undefined : 2}>
            {user.full_name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <RoleBadges roles={user.roles} />
            <StatusBadge status={user.status} />
            {user.deleted_at ? <DeletedBadge testID="person-deleted-badge" /> : null}
          </View>
        </View>
      </AdaptiveRow>

      {/* Contact: only what exists. No address is never a mailto:, no number never a tel:. */}
      {user.email || tel ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {tel ? (
            <Button
              testID="person-call"
              mode="contained-tonal"
              icon="phone-outline"
              contentStyle={{ minHeight: MIN_TARGET }}
              accessibilityLabel={`Call ${user.full_name}`}
              onPress={() => void Linking.openURL(tel).catch(() => undefined)}
            >
              Call
            </Button>
          ) : null}
          {user.email ? (
            <Button
              testID="person-email-action"
              mode="contained-tonal"
              icon="email-outline"
              contentStyle={{ minHeight: MIN_TARGET }}
              accessibilityLabel={`Email ${user.full_name}`}
              onPress={() => void Linking.openURL(`mailto:${user.email}`).catch(() => undefined)}
            >
              Email
            </Button>
          ) : null}
        </View>
      ) : null}

      {/* Adding a tutor leaves the tax details for later (UI upgrades U3): the office is reminded
          here until the 1099's address and the SSN fact are both on file. */}
      {tutoring && tutor && isAdmin && !compact && !user.deleted_at && needsTaxSetup(tutor) ? (
        <TaxSetupCard userId={user.id} tutor={tutor} />
      ) : null}

      {/* The record in sections, each with its own Edit for the office (UI upgrades U5). */}
      {sections.map(({ key, editable }) => {
        const def = RECORD_SECTIONS[key];
        return (
          <Section
            key={key}
            title={def.title}
            icon={def.icon}
            testID={`person-section-${key}`}
            editTestID={`person-edit-${key}`}
            onEdit={editable ? () => editSection(key) : undefined}
          >
            {renderSection(key)}
          </Section>
        );
      })}

      {/* Phase 33: where they like to have lessons -- for the office, the person, and a student's
          parents (R16; the server answers anyone else with an empty list). */}
      {!compact &&
      tutoring &&
      (user.roles.includes('tutor') || user.roles.includes('student')) &&
      (isAdmin ||
        viewer?.id === user.id ||
        user.guardians.some((guardian) => guardian.user_id === viewer?.id)) ? (
        <Section title="Locations" icon="map-marker-outline" testID="person-section-locations">
          <LocationsList ownerId={user.id} />
        </Section>
      ) : null}

      {/* Above the activity on purpose: what people have SAID about someone matters more on their
          record than what the system logged. The audience is narrower than a lesson's: admins, the
          author, the person and their parents -- the server's to decide. */}
      {!compact && tutoring ? (
        <Section title="Comments" icon="message-outline" testID="person-section-comments">
          <CommentsRow
            testID="person-comments"
            target={{ target_type: 'user', target_id: user.id }}
            title={user.full_name}
          />
        </Section>
      ) : null}
      {!compact ? <RecentActivity userId={user.id} /> : null}
    </View>
  );
}

/**
 * What this person did AND what was done to them, which is why an admin editing your record appears
 * in your feed. Renders nothing when there is no activity.
 */
function RecentActivity({ userId }: { userId: string }) {
  const theme = useAppTheme();
  const { data, isPending } = useAuditEvents({ user_id: userId, limit: 8 });
  const events = data?.data ?? [];
  if (!isPending && events.length === 0) return null;

  return (
    <Section title="Recent activity" icon="history" testID="person-section-activity">
      <ActivityFeed events={events} isLoading={isPending} />
      {data && data.meta.total > events.length ? (
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {`Showing the latest ${events.length} of ${data.meta.total} events.`}
        </Text>
      ) : null}
    </Section>
  );
}

/**
 * A student's parents or a parent's children. Each row opens that person's record: the server has
 * already cut the links to people the reader may see.
 */
function PeopleList({ people, kind }: { people: GuardianLink[]; kind: 'guardian' | 'dependent' }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.sm }}>
      {people.map((person) => (
        <Pressable
          key={person.user_id}
          testID={`person-${kind}-${person.user_id}`}
          accessibilityRole="button"
          accessibilityLabel={`${person.full_name}, ${RELATIONSHIP_LABELS[person.relationship]}${person.is_primary ? ', Primary contact' : ''}, open their record`}
          onPress={() => router.push({ pathname: '/people/[id]', params: { id: person.user_id } })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            minHeight: MIN_TARGET,
            paddingVertical: space.xs,
            borderRadius: radius.md,
            backgroundColor: pressed ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
          })}
        >
          <PersonAvatar name={person.full_name} size={32} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {person.full_name}
              </Text>
              <Tag label={RELATIONSHIP_LABELS[person.relationship]} />
              {person.is_primary ? <Tag label="Primary contact" filled /> : null}
            </View>
            <EmailOrNone email={person.email} link={false} numberOfLines={1} style={{ fontSize: 12 }} />
          </View>
          <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
        </Pressable>
      ))}
    </View>
  );
}

function Tag({ label, filled }: { label: string; filled?: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: filled ? 'transparent' : theme.colors.outline,
        backgroundColor: filled ? theme.colors.secondaryContainer : 'transparent',
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: filled ? theme.colors.onSecondaryContainer : theme.tokens.mutedForeground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Whether the office holds this tutor's SSN, and an admin's control to say so. Only the fact and
 * the date are recorded: there is no field for the number, because the portal has nowhere to keep
 * one.
 */
function SsnStatus({
  userId,
  fullName,
  receivedOn,
  isAdmin,
}: {
  userId: string;
  fullName: string;
  receivedOn: string | null;
  isAdmin: boolean;
}) {
  const theme = useAppTheme();
  const t = theme.tokens;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
      {receivedOn ? (
        <Text variant="bodyMedium">{`Received ${receivedOn}`}</Text>
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: withAlpha(t.warning, 0.6),
            borderRadius: radius.sm,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 12, color: theme.scheme === 'dark' ? t.warning : t.warningForeground }}>
            Not received
          </Text>
        </View>
      )}
      {isAdmin ? (
        <SsnReceiptButton userId={userId} fullName={fullName} received={Boolean(receivedOn)} />
      ) : null}
    </View>
  );
}

/** How someone pays or is paid: one row per method, or a line saying there are none. */
function PaymentHandles({ handles, empty }: { handles: PaymentHandle[]; empty?: string }) {
  if (handles.length === 0) return empty ? <Muted>{empty}</Muted> : null;
  return (
    <>
      {handles.map((handle) => (
        <Detail key={handle.method} icon="wallet-outline" label={PAYMENT_METHOD_LABELS[handle.method]}>
          {handle.handle}
        </Detail>
      ))}
    </>
  );
}
