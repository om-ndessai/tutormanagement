// What next, once Add a student or Add a tutor has saved (UI upgrades U3): the steps the welcome
// wizard offers after its own add -- the assessment, the plan, a pairing; for a tutor the tax setup
// and a pairing -- each the app's existing sheet, ticked here once it saves (`form-bridge`).
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutlinedCard } from '@/components/outlined-card';
import { useAwaitedSheet } from '@/features/onboarding/student-flow';
import type { SavedForm } from '@/lib/form-bridge';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

interface NextStep {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: Href;
  form: SavedForm;
}

function nextSteps(kind: 'student' | 'tutor', id: string): NextStep[] {
  if (kind === 'student') {
    return [
      {
        key: 'assess',
        title: 'Record the assessment',
        description: 'Where they stand: the level you recommend and a score per topic.',
        icon: 'clipboard-text-outline',
        href: { pathname: '/assessment-form', params: { student: id } },
        form: 'assessment',
      },
      {
        key: 'plan',
        title: 'Set the learning plan',
        description: 'The goal and its date, and the topics that lead there.',
        icon: 'flag-checkered',
        href: { pathname: '/plan-form', params: { student: id } },
        form: 'plan',
      },
      {
        key: 'pair',
        title: 'Pair with a tutor',
        description: 'Lessons can be recorded once they are paired.',
        icon: 'account-switch-outline',
        href: { pathname: '/assignment-form', params: { student: id } },
        form: 'assignment',
      },
    ];
  }
  return [
    {
      key: 'tax',
      title: 'Finish tax setup',
      description: 'Their mailing address for the 1099, and whether the office holds their SSN.',
      icon: 'file-document-outline',
      href: { pathname: '/person-form', params: { id, sections: 'tutor-tax' } },
      form: 'person',
    },
    {
      key: 'pair',
      title: 'Pair with a student',
      description: 'Which student they teach, and at what rate.',
      icon: 'account-switch-outline',
      href: { pathname: '/assignment-form', params: { tutor: id } },
      form: 'assignment',
    },
  ];
}

export function AddPersonDone({
  kind,
  person,
  onAgain,
}: {
  kind: 'student' | 'tutor';
  person: { id: string; name: string };
  /** Start the flow again, empty. */
  onAgain: () => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const openSheet = useAwaitedSheet();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const steps = nextSteps(kind, person.id);

  const close = () => {
    if (router.canGoBack()) router.back();
  };
  const openRecord = () => {
    close();
    router.navigate({ pathname: '/people/[id]', params: { id: person.id } });
  };

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
          Next, when you are ready. Anything you leave can be done from their record later.
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        {steps.map((step) => {
          const finished = done.has(step.key);
          return (
            <OutlinedCard key={step.key}>
              <Pressable
                testID={`add-person-done-${step.key}`}
                accessibilityRole="button"
                accessibilityLabel={`${step.title}${finished ? ', done' : ''}`}
                accessibilityHint={step.description}
                onPress={() => {
                  haptics.selection();
                  openSheet(step.href, step.form, () => setDone((was) => new Set(was).add(step.key)));
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: 64,
                  padding: space.md,
                  borderRadius: radius.lg,
                  backgroundColor: pressed ? theme.tokens.muted : 'transparent',
                })}
              >
                <Icon
                  source={finished ? 'check-circle' : step.icon}
                  size={24}
                  color={finished ? theme.colors.primary : theme.tokens.mutedForeground}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="titleMedium">{step.title}</Text>
                  <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
                    {finished ? 'Done.' : step.description}
                  </Text>
                </View>
                <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
              </Pressable>
            </OutlinedCard>
          );
        })}
      </View>

      <View style={{ gap: space.sm }}>
        <Button
          testID="add-person-done-close"
          mode="contained"
          onPress={close}
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
          {kind === 'student' ? 'Add another student' : 'Add another tutor'}
        </Button>
      </View>
    </ScrollView>
  );
}
