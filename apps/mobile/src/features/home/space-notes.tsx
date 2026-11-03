// Moved from the Phase 50 space home (`features/dashboard/space-home-screen.tsx`, entry 62), which Phase 66's
// member home replaces: in a space without Tutoring, a card for Quest, the word that Assessment is
// switched off, or the calm word when nothing is on. Same copy and testIDs.
import { featureAllowed, featureOn } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { EmptyState } from '@/components/state-views';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/** What a space without Tutoring says about its sets (nothing where Tutoring is on). */
export function SpaceNotes({ learner }: { learner: boolean }) {
  const { user, organization } = useAuth();
  if (featureOn(organization, 'tutoring')) return null;
  const isAdmin = user?.roles.includes('admin') ?? false;
  const assessmentOn = featureOn(organization, 'assessment');
  const assessmentAllowed = featureAllowed(organization, 'assessment');
  const questOn = featureOn(organization, 'quest');
  const anythingOff =
    (assessmentAllowed && !assessmentOn) || (featureAllowed(organization, 'quest') && !questOn);
  return (
    <>
      {assessmentAllowed && !assessmentOn ? <AssessmentOffCard isAdmin={isAdmin} /> : null}
      {/* The learner has the Play home itself. */}
      {questOn && !learner ? <QuestCard /> : null}
      {!assessmentAllowed && !questOn ? <EmptySpaceHome isAdmin={isAdmin} anythingOff={anythingOff} /> : null}
    </>
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
