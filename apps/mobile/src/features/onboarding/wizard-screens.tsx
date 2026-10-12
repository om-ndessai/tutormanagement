// Ported from apps/web/src/features/onboarding/onboarding-wizard.tsx @ 1132322: the welcome and the
// done screens. An admin chooses: the tour, adding a student, adding a tutor. Everyone else takes
// the tour and then confirms the details the office keeps on them. Closing it at any point is
// fine -- whatever was added stays.
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, Chip, Icon, Surface, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
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
  const { user } = useAuth();
  const { startTour, tourDone } = useOnboarding();
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
            ? 'A quick tour of the portal, and guided setup for a new student or tutor.'
            : 'A quick tour of the portal, then a check that the office has your details right.'
        }
      />

      <View style={{ gap: space.md }}>
        <Choice
          testID="onboarding-choice-tour"
          icon="compass-outline"
          title="Take the tour"
          description="The dashboard and the menu, one part at a time, with what each is for."
          badge={tourDone ? 'Done' : 'Tour'}
          action="Take the tour"
          onPress={() => {
            // Marked first, so closing the wizard here is leaving for the tour, not closing it.
            startTour();
            close();
          }}
        />
        {isAdmin ? (
          <>
            <Choice
              testID="onboarding-choice-student"
              icon="school-outline"
              title="Add a student"
              description="Create or pick the family, add the student, then their assessment, learning plan and tutor."
              action="Add a student"
              onPress={() => router.push('/onboarding/student')}
            />
            <Choice
              testID="onboarding-choice-tutor"
              icon="account-plus-outline"
              title="Add a tutor"
              description="Their details, then how they are paid, when they can teach, and their students."
              action="Add a tutor"
              onPress={() => router.push('/onboarding/tutor')}
            />
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
        Go to my dashboard
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
                textStyle={{ fontSize: 11, marginVertical: 0 }}
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
