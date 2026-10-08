// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 -- the Tutoring halves
// of AdminView and TutorView. The Finance halves are in finance-views.tsx.
import type { AdminDashboard, TutorDashboard } from '@tmi/shared';
import { View } from 'react-native';

import { DashboardSection, Panel } from '@/components/section';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ActivityFeed } from '@/features/audit/activity-feed';
import { ProgressSpotlight } from '@/features/progress/progress-spotlight';
import { space } from '@/theme/tokens';
import { RecentReflections } from './reflections';
import { SessionsCarousel } from './sessions-carousel';

/** One glyph per role (the web's ROLE_ICONS), as Material Community names. */
export const ROLE_ICONS = {
  admin: 'shield-account-outline',
  tutor: 'account-tie-outline',
  student: 'school-outline',
  parent: 'account-cog-outline',
} as const;

/** The admin's Tutoring tab: four sections, most important first. No money at all. */
export function AdminTutoring({ data }: { data: AdminDashboard }) {
  return (
    <View style={{ gap: space.xl }}>
      <DashboardSection tourId="dash-analytics" title="Analytics">
        <StatGrid>
          {[
            <StatCard
              key="students"
              compact
              label="Students"
              value={data.counts.students}
              icon={ROLE_ICONS.student}
              to="/people"
            />,
            <StatCard
              key="tutors"
              compact
              label="Tutors"
              value={data.counts.tutors}
              icon={ROLE_ICONS.tutor}
              to="/people"
            />,
            <StatCard
              key="parents"
              compact
              label="Parents"
              value={data.counts.parents}
              icon={ROLE_ICONS.parent}
              to="/people"
            />,
            <StatCard
              key="running"
              compact
              label="Sessions running"
              value={data.counts.live_sessions}
              icon="radio-tower"
              tone={data.counts.live_sessions > 0 ? 'success' : 'default'}
            />,
          ]}
        </StatGrid>
      </DashboardSection>

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
 * The tutor's Tutoring tab. No money on this half: a tutor may have it open beside a student.
 * What they earned is the Finance tab's first figure.
 */
export function TutorTutoring({ data }: { data: TutorDashboard }) {
  return (
    <View style={{ gap: space.xl }}>
      <DashboardSection tourId="dash-analytics" title="Analytics">
        <StatGrid>
          {[
            <StatCard
              key="students"
              compact
              label="Students"
              value={data.students.length}
              icon={ROLE_ICONS.student}
              to="/pairings"
            />,
            <StatCard
              key="sessions"
              compact
              label="Sessions"
              value={data.earnings.session_count}
              icon="book-open-variant"
              to="/sessions"
            />,
            <StatCard
              key="running"
              compact
              label="Sessions running"
              value={data.live_sessions}
              icon="radio-tower"
              tone={data.live_sessions > 0 ? 'success' : 'default'}
            />,
          ]}
        </StatGrid>
      </DashboardSection>

      <DashboardSection
        tourId="dash-sessions"
        title="Tutoring Sessions"
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        {/* Only lessons they teach, even for an admin viewing as them. */}
        <SessionsCarousel past={data.recent_sessions} tutorUserId={data.earnings.user_id} showTutor={false} />
      </DashboardSection>

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
