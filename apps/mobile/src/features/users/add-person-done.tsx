// What next, once someone is added (UI upgrades U3; Phase 76, JF21): the next steps of shared
// `nextStepsAfterAdd` -- "Pair Yusuf with a tutor", "Set a weekly lesson" (once they are paired) and "Record an
// assessment"; for a tutor "Pair Alex with a student" and "Finish tax setup" -- each the app's existing sheet or flow,
// ticked here once it saves (`form-bridge`). It follows Add a student, Add a tutor and the person form opened from the
// Add chooser ("Someone else"), in place of a toast.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutlinedCard } from '@/components/outlined-card';
import { useAwaitedSheet } from '@/features/onboarding/student-flow';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { addPersonNextSteps, nextStepSets, type AddedPersonRef, type NextStepView } from './add-person-model';

function closeScreen() {
  if (router.canGoBack()) router.back();
}

export function AddPersonDone({
  person,
  onAgain,
  againLabel,
  variant = 'screen',
}: {
  person: AddedPersonRef;
  /** Start the flow again, empty. */
  onAgain: () => void;
  /** "Add another student", "Add another tutor", "Add someone else". */
  againLabel: string;
  /** `sheet`: inside the person form's sheet (no safe-area top, the sheet's own scroll). */
  variant?: 'screen' | 'sheet';
}) {
  const theme = useAppTheme();
  const openSheet = useAwaitedSheet();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  // The pairing the pairing form made, so "Set a weekly lesson" can open on it.
  const [pairingId, setPairingId] = useState<string | null>(null);
  const { organization } = useAuth();
  const steps = addPersonNextSteps(person, nextStepSets(organization), pairingId);

  const openRecord = () => {
    closeScreen();
    router.navigate({ pathname: '/people/[id]', params: { id: person.id } });
  };

  function take(step: NextStepView) {
    if (!step.href) return;
    haptics.selection();
    if (step.leave || !step.form) {
      closeScreen();
      router.navigate(step.href);
      return;
    }
    openSheet(step.href, step.form, (id) => {
      setDone((was) => new Set(was).add(step.id));
      if (step.form === 'assignment' && step.id === 'pair_tutor') setPairingId(id);
    });
  }

  const body = (
    <>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            backgroundColor: theme.tokens.highlightSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon source="check-decagram" size={36} color={theme.tokens.celebrate} />
        </View>
        <Text
          testID="add-person-done-title"
          variant="headlineSmall"
          accessibilityRole="header"
          style={{ textAlign: 'center' }}
        >
          {`${person.name} is added`}
        </Text>
        <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.tokens.mutedForeground }}>
          {steps.length > 0
            ? 'Next, when you are ready. Anything you leave can be done from their record later.'
            : 'Everything else can be done from their record.'}
        </Text>
      </View>

      {steps.length > 0 ? (
        <View testID="add-done-next" style={{ gap: space.sm }}>
          {steps.map((step) => {
            const finished = done.has(step.id);
            const blocked = step.href === null;
            return (
              <OutlinedCard key={step.id}>
                <Pressable
                  testID={`add-done-next-${step.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${step.label}${finished ? ', done' : ''}`}
                  accessibilityHint={step.description}
                  accessibilityState={{ disabled: blocked }}
                  disabled={blocked}
                  onPress={() => take(step)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    minHeight: 64,
                    padding: space.md,
                    borderRadius: radius.lg,
                    opacity: blocked ? 0.6 : 1,
                    backgroundColor: pressed ? theme.tokens.muted : 'transparent',
                  })}
                >
                  <Icon
                    source={finished ? 'check-circle' : step.icon}
                    size={24}
                    color={finished ? theme.colors.primary : theme.tokens.mutedForeground}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="titleMedium">{step.label}</Text>
                    <Text
                      testID={`add-done-next-${step.id}-line`}
                      variant="bodyMedium"
                      style={{ color: theme.tokens.mutedForeground }}
                    >
                      {finished ? 'Done.' : step.description}
                    </Text>
                  </View>
                  {blocked ? null : <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />}
                </Pressable>
              </OutlinedCard>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="add-person-done-close"
          mode="contained"
          onPress={closeScreen}
          contentStyle={{ minHeight: MIN_TARGET + 4 }}
        >
          Done
        </Button>
        <Button
          testID="add-person-done-record"
          mode="outlined"
          icon="account-outline"
          onPress={openRecord}
          contentStyle={{ minHeight: MIN_TARGET + 4 }}
        >
          Open their record
        </Button>
        <Button
          testID="add-person-done-again"
          mode="text"
          icon="plus"
          onPress={onAgain}
          contentStyle={{ minHeight: MIN_TARGET + 4 }}
        >
          {againLabel}
        </Button>
      </View>
    </>
  );

  return variant === 'sheet' ? (
    <View testID="add-person-done" style={{ gap: space.lg }}>
      {body}
    </View>
  ) : (
    <DoneScreen>{body}</DoneScreen>
  );
}

function DoneScreen({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID="add-person-done"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      {children}
    </ScrollView>
  );
}
