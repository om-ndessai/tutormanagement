// Phase 76 (JF21; the app's model, docs/mobile/parity.md U2): a student's record says who teaches them and when --
// their tutor(s), from their pairings (`GET /assignments?student_user_id=`), and their weekly lessons
// (`GET /schedules?student_user_id=`), each in words with its place by name only (R16). Tutoring only. No money: no
// rate, price or "No price set" is read here. What the reader may see is the server's (both lists are scoped).
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { Skeleton } from '@/components/skeleton';
import { useSchedules } from '@/features/schedules/api';
import { useAssignments } from '@/features/teaching/api';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { Detail, Muted, Section } from './detail-row';
import { studentTutors, studentWeeklyLessons, weeklyLessonLine } from './people-model';
import { PersonAvatar } from './person-avatar';

export function StudentTeaching({ studentId }: { studentId: string }) {
  const theme = useAppTheme();
  const pairings = useAssignments({ student_user_id: studentId });
  const schedules = useSchedules({ student_user_id: studentId });
  const tutors = studentTutors(pairings.data?.data ?? []);
  const lessons = studentWeeklyLessons(schedules.data?.data ?? []);

  return (
    <Section title="Tutors and lessons" icon="human-male-board" testID="person-section-tutoring">
      <Detail icon="account-tie-outline" label={tutors.length > 1 ? 'Tutors' : 'Tutor'} testID="person-tutors">
        {pairings.isPending ? (
          <Skeleton width="60%" height={20} />
        ) : tutors.length === 0 ? (
          <Muted>No tutor yet.</Muted>
        ) : (
          <View style={{ gap: space.xs }}>
            {tutors.map((tutor) => (
              <Pressable
                key={tutor.id}
                testID={`person-tutor-${tutor.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${tutor.name}, their tutor, open their record`}
                onPress={() => router.push({ pathname: '/people/[id]', params: { id: tutor.id } })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: MIN_TARGET,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
                })}
              >
                <PersonAvatar name={tutor.name} size={32} />
                <Text variant="bodyMedium" style={{ flex: 1, fontWeight: '600' }}>
                  {tutor.name}
                </Text>
                <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}
      </Detail>
      <Detail icon="calendar-sync-outline" label="Weekly lessons" testID="person-lessons">
        {schedules.isPending ? (
          <Skeleton width="80%" height={20} />
        ) : lessons.length === 0 ? (
          <Muted>No weekly lesson yet.</Muted>
        ) : (
          <View style={{ gap: space.xs }}>
            {lessons.map((schedule) => (
              <Text key={schedule.id} testID={`person-lesson-${schedule.id}`} variant="bodyMedium">
                {weeklyLessonLine(schedule)}
              </Text>
            ))}
          </View>
        )}
      </Detail>
    </Section>
  );
}
