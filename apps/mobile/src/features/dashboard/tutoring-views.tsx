// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 -- the Tutoring halves
// of AdminView and TutorView. The Finance halves are in finance-views.tsx.
import type { AdminDashboard, TutorDashboard } from '@tmi/shared';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DashboardSection, Panel } from '@/components/section';
import { FigureRow } from '@/components/figure-row';
import { ActivityFeed } from '@/features/audit/activity-feed';
import { ProgressSpotlight } from '@/features/progress/progress-spotlight';
import { space } from '@/theme/tokens';
import { FinishWriteUp } from './finish-write-up';
import { RecentReflections } from './reflections';
import { SessionsCarousel } from './sessions-carousel';

/**
 * The admin's figures (UI upgrades U6: the Analytics section, as one compact row). Since Phase 43
 * (the owner, 2026-10-20) they are on the Dashboard screen (More → Dashboard), not on Home. Counts
 * only: money stays inside Finance.
 */
export function AdminFigures({ data }: { data: AdminDashboard }) {
  return (
    <FigureRow
      tourId="dash-analytics"
      figures={[
        { label: 'Students', value: data.counts.students, to: '/people' },
        { label: 'Tutors', value: data.counts.tutors, to: '/people' },
        { label: 'Parents', value: data.counts.parents, to: '/people' },
        {
          label: 'Sessions running',
          value: data.counts.live_sessions,
          tone: data.counts.live_sessions > 0 ? 'success' : 'default',
        },
      ]}
    />
  );
}

/** The tutor's figures, on the Dashboard screen since Phase 43. No money: what they earned is the Finance tab's. */
export function TutorFigures({ data }: { data: TutorDashboard }) {
  return (
    <FigureRow
      tourId="dash-analytics"
      figures={[
        { label: 'Students', value: data.students.length, to: '/pairings' },
        { label: 'Sessions', value: data.earnings.session_count, to: '/sessions' },
        {
          label: 'Sessions running',
          value: data.live_sessions,
          tone: data.live_sessions > 0 ? 'success' : 'default',
        },
      ]}
    />
  );
}

/**
 * The admin's Tutoring tab: its sections, most important first. Phase 43 (the owner, 2026-10-20):
 * `lead` is the Now card and brief when the admin also tutors; Analytics moved to the Dashboard
 * screen and Recent Activity left Home (the Activity page stays under More). No money at all.
 */
export function AdminTutoring({
  data,
  lead,
  full = false,
}: {
  data: AdminDashboard;
  lead?: ReactNode;
  /** The Dashboard page (More → Dashboard): Analytics first and Recent Activity last, as on the web. */
  full?: boolean;
}) {
  return (
    <View style={{ gap: space.xl }}>
      {lead}
      {full ? (
        <DashboardSection title="Analytics">
          <AdminFigures data={data} />
        </DashboardSection>
      ) : null}
      <DashboardSection
        tourId="dash-sessions"
        title="Tutoring Sessions"
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        <SessionsCarousel past={data.recent_sessions} showTutor />
      </DashboardSection>

      <DashboardSection
        tourId="dash-progress"
        title="Progress"
        action={{ label: 'All Progress', to: '/progress' }}
      >
        <ProgressSpotlight students={data.progress_spotlight} empty="No students yet." />
      </DashboardSection>

      {full ? (
        <DashboardSection tourId="dash-activity" title="Recent Activity" action={{ label: 'Full log', to: '/activity' }}>
          <Panel>
            <ActivityFeed events={data.recent_activity} />
          </Panel>
        </DashboardSection>
      ) : null}
    </View>
  );
}

/**
 * The tutor's Tutoring tab (Phase 43): the Now card and brief, then Tutoring Sessions (Next up is
 * the carousel's highlighted card), the draft they left today, Student Reflections and Progress.
 * Recent Activity left Home (the owner, 2026-10-20). No money on this half: a tutor may have it open beside a student.
 * `mine` is false while an admin views it: a draft is its author's alone, so none is offered then.
 */
export function TutorTutoring({
  data,
  mine = true,
  lead,
  full = false,
}: {
  data: TutorDashboard;
  mine?: boolean;
  /** Phase 43: the Now card and the next lesson's brief, first (the reader's own Home only). */
  lead?: ReactNode;
  /** The Dashboard page (More → Dashboard): Analytics first and Recent Activity last, as on the web. */
  full?: boolean;
}) {
  return (
    <View style={{ gap: space.xl }}>
      {lead}
      {full ? (
        <DashboardSection title="Analytics">
          <TutorFigures data={data} />
        </DashboardSection>
      ) : null}
      <DashboardSection
        tourId="dash-sessions"
        title="Tutoring Sessions"
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        {/* Only lessons they teach, even for an admin viewing as them. */}
        <SessionsCarousel past={data.recent_sessions} tutorUserId={data.earnings.user_id} showTutor={false} />
      </DashboardSection>

      {mine ? <FinishWriteUp tutorUserId={data.earnings.user_id} /> : null}

      {/* Phase 25: what their students made of recent lessons, beside the lessons themselves. */}
      <DashboardSection
        tourId="dash-reflections"
        title="Student Reflections"
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        <Panel>
          <RecentReflections digests={data.recent_reflections} />
        </Panel>
      </DashboardSection>

      <DashboardSection
        tourId="dash-progress"
        title="Progress"
        action={{ label: 'All Progress', to: '/progress' }}
      >
        <ProgressSpotlight students={data.progress_spotlight} empty="No students assigned to you yet." />
      </DashboardSection>

      {full ? (
        <DashboardSection tourId="dash-activity" title="Recent Activity" action={{ label: 'Full log', to: '/activity' }}>
          <Panel>
            <ActivityFeed events={data.recent_activity} showActor={false} />
          </Panel>
        </DashboardSection>
      ) : null}
    </View>
  );
}
