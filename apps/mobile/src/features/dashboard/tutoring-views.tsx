// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 -- the Tutoring halves
// of AdminView and TutorView. The Finance halves are in finance-views.tsx.
import type { AdminDashboard, TutorDashboard } from '@tmi/shared';
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
 * The admin's figures (UI upgrades U6: the Analytics section, as one compact row above the tabs).
 * Counts only: it shows on Finance too, and money stays inside Finance.
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

/** The tutor's figures, above the tabs. No money: what they earned is the Finance tab's. */
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
 * The admin's Tutoring tab: its sections, most important first (the figures sit above the tabs
 * since U6). No money at all.
 */
export function AdminTutoring({ data }: { data: AdminDashboard }) {
  return (
    <View style={{ gap: space.xl }}>
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

      <DashboardSection
        tourId="dash-activity"
        title="Recent Activity"
        action={{ label: 'Full log', to: '/activity' }}
      >
        <Panel>
          <ActivityFeed events={data.recent_activity} />
        </Panel>
      </DashboardSection>
    </View>
  );
}

/**
 * The tutor's Tutoring tab: Next up first (the carousel's highlighted card), then the draft they
 * left today, then the rest. No money on this half: a tutor may have it open beside a student.
 * `mine` is false while an admin views it: a draft is its author's alone, so none is offered then.
 */
export function TutorTutoring({ data, mine = true }: { data: TutorDashboard; mine?: boolean }) {
  return (
    <View style={{ gap: space.xl }}>
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

      <DashboardSection
        tourId="dash-activity"
        title="Recent Activity"
        action={{ label: 'Full log', to: '/activity' }}
      >
        <Panel>
          <ActivityFeed events={data.recent_activity} showActor={false} />
        </Panel>
      </DashboardSection>
    </View>
  );
}
