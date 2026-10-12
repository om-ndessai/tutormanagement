// Ported from apps/web/src/pages/profile-page.tsx @ 1132322: the reader's own record, read-only,
// through the same view as anyone else's -- plus the appearance control, which on the web sits in the
// header.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';

import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { Screen } from '@/components/screen';
import { DictationControl } from '@/features/dictation/dictation-control';
import { AppearanceControl } from '@/features/shell/appearance-control';
import { HapticsControl } from '@/features/shell/haptics-control';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useUserDetail } from './api';
import { DevSignInNotice } from './dev-sign-in-notice';
import { UserDetailView } from './user-detail-view';

export function ProfileScreen() {
  const { user } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const { data, isPending, error, refetch } = useUserDetail(user?.id ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const muted = theme.tokens.mutedForeground;
  // Dictation is for writing a lesson up, which only tutors and admins do (P3).
  const writesLessons = Boolean(user?.roles.some((role) => role === 'tutor' || role === 'admin'));

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-profile" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'My profile' }} />
      <Text variant="bodyMedium" style={{ color: muted }}>
        {`How ${brand.name} has you on file.`}
      </Text>
      <DevSignInNotice />
      <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: space.lg }}>
        {isPending ? <DetailSkeleton label="Loading your record…" avatar /> : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
        {data ? <UserDetailView user={data.data} /> : null}
      </Card>
      <Text testID="profile-footer" variant="bodySmall" style={{ color: muted, textAlign: 'center' }}>
        Something wrong here? Ask an administrator to update your record.
      </Text>
      <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: space.lg }}>
        <View style={{ gap: space.lg }}>
          <AppearanceControl testID="profile-appearance" describe />
          <Divider />
          <HapticsControl testID="profile-haptics" />
          {writesLessons ? (
            <>
              <Divider />
              <DictationControl testID="profile-dictation" />
            </>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}
