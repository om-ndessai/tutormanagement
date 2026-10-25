// Phase 50 (docs/mobile/build-log.md, entry 62; the web's DashboardPage → AssessmentHome @ 2471d84,
// working tree): Home in a space without Tutoring. The dashboard is Tutoring's and answers 403 here,
// so this never calls `/dashboard` (nor `/home` or `/sessions`): the Assessment home while Assessment
// is on, a card for Quest while Quest is on, and a calm word when nothing is. The same for every
// role, so there are no role chips (`publishHomeRole(null)`).
import { featureAllowed, featureOn } from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { EmptyState } from '@/components/state-views';
import { useOptionalOnboarding } from '@/features/onboarding/onboarding-provider';
import { primaryRole } from '@/features/onboarding/onboarding-model';
import { useTourScroller } from '@/features/onboarding/tour-targets';
import { AccountButton } from '@/features/shell/account-button';
import { SearchButton } from '@/features/shell/search-button';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { AssessmentHome } from './assessment-home';
import { publishHomeRole } from './home-role';
import { Greeting } from './home-top';

function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SearchButton />
      <AccountButton />
    </View>
  );
}

export function SpaceHomeScreen() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = user?.roles.includes('admin') ?? false;
  const assessmentOn = featureOn(organization, 'assessment');
  const assessmentAllowed = featureAllowed(organization, 'assessment');
  const questOn = featureOn(organization, 'quest');
  const anythingOff =
    (assessmentAllowed && !assessmentOn) || (featureAllowed(organization, 'quest') && !questOn);

  // No role chips: the space home is the same for every role.
  useEffect(() => publishHomeRole(null), []);

  // The welcome wizard and the tour start as they do on the dashboard.
  const onboarding = useOptionalOnboarding();
  const reportDashboard = onboarding?.reportDashboard;
  const role = user ? primaryRole(user.roles) : null;
  useEffect(() => {
    if (role) reportDashboard?.({ role, viewingAs: false });
  }, [reportDashboard, role]);
  const tourScroller = useTourScroller();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['canvas-assessments'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen testID="screen-home" scrollRef={tourScroller} refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ headerRight: () => <HeaderActions /> }} />
      <Greeting />
      <View testID="space-home" style={{ gap: space.lg }}>
        {assessmentOn ? <AssessmentHome /> : null}
        {assessmentAllowed && !assessmentOn ? <AssessmentOffCard isAdmin={isAdmin} /> : null}
        {questOn ? <QuestCard /> : null}
        {!assessmentAllowed && !questOn ? (
          <EmptySpaceHome isAdmin={isAdmin} anythingOff={anythingOff} />
        ) : null}
      </View>
    </Screen>
  );
}

function OpenOrganization({ testID }: { testID: string }) {
  return (
    <Button
      testID={testID}
      mode="contained-tonal"
      onPress={() => router.navigate('/organization')}
      style={{ alignSelf: 'flex-start' }}
    >
      Open Space
    </Button>
  );
}

function QuestCard() {
  const theme = useAppTheme();
  return (
    <Panel title="Question Quest" testID="space-home-quest">
      <View style={{ gap: space.md }}>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Questions one at a time from the bank, and games to play together.
        </Text>
        <Button
          testID="space-home-quest-open"
          mode="contained"
          icon="trophy-outline"
          onPress={() => {
            haptics.selection();
            router.navigate('/quest');
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          Open Quest
        </Button>
      </View>
    </Panel>
  );
}

function AssessmentOffCard({ isAdmin }: { isAdmin: boolean }) {
  const theme = useAppTheme();
  return (
    <Panel testID="space-home-assessment-off">
      <View style={{ gap: space.md, paddingVertical: space.sm }}>
        <Text variant="titleSmall">Assessment isn&apos;t switched on yet.</Text>
        {isAdmin ? (
          <OpenOrganization testID="space-home-organization" />
        ) : (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            The office can switch it on.
          </Text>
        )}
      </View>
    </Panel>
  );
}

function EmptySpaceHome({ isAdmin, anythingOff }: { isAdmin: boolean; anythingOff: boolean }) {
  const brand = useBrand();
  return (
    <EmptyState
      testID="space-home-empty"
      icon="puzzle-outline"
      title={`Nothing is switched on in ${brand.short} yet.`}
      action={isAdmin && anythingOff ? <OpenOrganization testID="space-home-organization" /> : undefined}
    />
  );
}
