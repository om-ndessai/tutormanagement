// Ported from apps/web/src/features/onboarding/onboarding-wizard.tsx @ 1132322: the welcome and the
// done screens. An admin chooses: the tour, adding a student, adding a tutor. Everyone else takes
// the tour and then confirms the details the office keeps on them. Closing it at any point is
// fine -- whatever was added stays. Phase 74 (JF25): "A quick tour" -- no "portal", no "the dashboard and
// the menu".
import { featureAllowed, featureOn, tourOffered } from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, Chip, Icon, Surface, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { InvitePeople } from '@/features/organizations/invite-people';
import { clearInviteStep } from '@/features/organizations/invite-step';
import { useOnboarding } from './onboarding-provider';
import { useWizardFrame } from './wizard-layout';

/** The heading every wizard screen opens with: a title and what it is for. */
export function WizardHeading({ title, description }: { title: string; description: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text testID="onboarding-title" variant="headlineSmall" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {description}
      </Text>
    </View>
  );
}

export function WelcomeScreen() {
  const brand = useBrand();
  const { user, organization } = useAuth();
  const { startTour, tourDone } = useOnboarding();
  // Phase 50 (onboarding-wizard.tsx @ 2471d84, working tree): adding a tutor, and a student's plan
  // and tutor, are Tutoring's.
  const tutoring = featureAllowed(organization, 'tutoring');
  const assessment = featureOn(organization, 'assessment');
  const tour = tourOffered(organization, user?.roles);
  const { close } = useWizardFrame();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const firstName = user?.full_name.split(' ')[0] ?? '';

  return (
    <Screen testID="screen-onboarding" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Welcome' }} />
      <WizardHeading
        title={`Welcome to ${brand.short}${firstName ? `, ${firstName}` : ''}`}
        description={
          isAdmin
            ? tour
              ? tutoring
                ? 'A quick tour, and guided setup for a new student or tutor.'
                : 'A quick tour, and guided setup for a new student.'
              : tutoring
                ? 'Guided setup for a new student or tutor.'
                : 'Guided setup for a new student.'
            : tour
              ? 'A quick tour, then a check that the office has your details right.'
              : 'A check that the office has your details right.'
        }
      />

      <View style={{ gap: space.md }}>
        {/* The tour is Tutoring's (owner, 2026-11-04): a new space without it never offers it (UI audit J06A). */}
        {tour ? (
          <Choice
            testID="onboarding-choice-tour"
            icon="compass-outline"
            title="Take the tour"
            description="Your home and the menu, one part at a time, with what each is for."
            badge={tourDone ? 'Done' : 'Tour'}
            action="Take the tour"
            onPress={() => {
              // Marked first, so closing the wizard here is leaving for the tour, not closing it.
              startTour();
              close();
            }}
          />
        ) : null}
        {isAdmin ? (
          <>
            <Choice
              testID="onboarding-choice-student"
              icon="school-outline"
              title="Add a student"
              description={
                tutoring
                  ? 'Create or pick the family, add the student, then their assessment, learning plan and tutor.'
                  : assessment
                    ? 'Create or pick the family, add the student, then start their first assessment.'
                    : 'Create or pick the family, then add the student.'
              }
              action="Add a student"
              onPress={() => router.push('/onboarding/student')}
            />
            {tutoring ? (
            <Choice
              testID="onboarding-choice-tutor"
              icon="account-plus-outline"
              title="Add a tutor"
              description="Their details, then how they are paid, when they can teach, and their students."
              action="Add a tutor"
              onPress={() => router.push('/onboarding/tutor')}
            />
            ) : null}
          </>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        {!isAdmin ? (
          <Button
            testID="onboarding-confirm-mine"
            mode="outlined"
            onPress={() => router.push('/onboarding/confirm')}
          >
            Confirm my details
          </Button>
        ) : null}
        <Button testID="onboarding-skip" mode={isAdmin ? 'contained' : 'text'} onPress={close}>
          {isAdmin ? 'I’m done' : 'Skip for now'}
        </Button>
      </View>
    </Screen>
  );
}

/**
 * Phase 61 (S12, onboarding-wizard.tsx's 'invite' screen, working tree on f96b984): straight after
 * starting a space, before the wizard's start. Skip or Continue goes on to the start.
 */
export function InviteScreen() {
  const { organization } = useAuth();
  return (
    <Screen testID="screen-onboarding-invite" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Invite people' }} />
      <WizardHeading
        title="Invite people"
        description={`Ask the adults who will use ${organization?.name ?? 'your space'} to join you. They accept when they sign in.`}
      />
      <InvitePeople
        onDone={() => {
          clearInviteStep();
          // Opened straight on this screen, the wizard's stack holds it alone: going back would
          // close the wizard, so the start replaces it.
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}

export function DoneScreen() {
  const theme = useAppTheme();
  const { close } = useWizardFrame();
  return (
    <Screen testID="screen-onboarding-done" edges={['bottom']}>
      <Stack.Screen options={{ title: 'All set', headerBackVisible: false }} />
      <WizardHeading
        title="You’re all set"
        description="Take the tour, in your account menu, brings this back."
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon source="check" size={18} color={theme.tokens.success} />
        <Text variant="bodyMedium">That’s everything. Welcome aboard.</Text>
      </View>
      <Button testID="onboarding-done-close" mode="contained" onPress={close}>
        Done
      </Button>
    </Screen>
  );
}

function Choice({
  testID,
  icon,
  title,
  description,
  badge,
  action,
  onPress,
}: {
  testID: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  action: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Surface
      elevation={0}
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primaryContainer,
          }}
        >
          <Icon source={icon} size={18} color={theme.colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Text variant="titleSmall">{title}</Text>
            {badge ? (
              <Chip
                testID={`${testID}-badge`}
                compact
                icon={badge === 'Done' ? 'check' : undefined}
                textStyle={{ fontSize: 12, marginVertical: 0 }}
              >
                {badge}
              </Chip>
            ) : null}
          </View>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {description}
          </Text>
        </View>
      </View>
      <Button
        testID={testID}
        mode="outlined"
        onPress={() => {
          haptics.selection();
          onPress();
        }}
      >
        {action}
      </Button>
    </Surface>
  );
}
