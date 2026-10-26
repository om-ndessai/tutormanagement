// Ported from apps/web/src/pages/profile-page.tsx @ 1132322: the reader's own record, read-only,
// through the same view as anyone else's -- plus the appearance control, which on the web sits in the
// header.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';
import { OutlinedCard } from '@/components/outlined-card';

import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { Screen } from '@/components/screen';
import { LegalLine } from '@/features/auth/legal-links';
import { SignInMethodsCard } from '@/features/auth/sign-in-methods-card';
import { DictationControl } from '@/features/dictation/dictation-control';
import { SpaceDangerPanel } from '@/features/organizations/space-code-card';
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
  const isAdmin = Boolean(user?.roles.includes('admin'));
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
      <OutlinedCard style={{ borderRadius: radius.lg }} contentStyle={{ padding: space.lg }}>
        {isPending ? <DetailSkeleton label="Loading your record…" avatar /> : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
        {data ? <UserDetailView user={data.data} /> : null}
      </OutlinedCard>
      <Text testID="profile-footer" variant="bodySmall" style={{ color: muted, textAlign: 'center' }}>
        Something wrong here? Ask an administrator to update your record.
      </Text>
      {/* Phase 55: the accounts that sign this person in. */}
      <SignInMethodsCard />
      <OutlinedCard style={{ borderRadius: radius.lg }} contentStyle={{ padding: space.lg }}>
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
      </OutlinedCard>
      {/* Phase 52: a member leaves here; an admin leaves from the Space screen. */}
      {!isAdmin ? <SpaceDangerPanel testID="profile-danger" leaveOnly /> : null}
      {/* Apple asks for account deletion to be findable in the app: this says how it is done. */}
      <Button
        testID="profile-delete-account"
        mode="text"
        textColor={muted}
        style={{ alignSelf: 'center' }}
        onPress={() =>
          Alert.alert(
            'Delete my account',
            'First leave every space you are in — or, if you made a space and run it, delete it from its Space screen. Then Delete my account is on the Welcome screen you land on.',
            [{ text: 'OK' }],
          )
        }
      >
        Delete my account
      </Button>
      <LegalLine
        testID="profile-legal"
        prefix={null}
        termsLabel="Terms of use"
        ids={{ terms: 'profile-terms', privacy: 'profile-privacy' }}
      />
    </Screen>
  );
}
