// Phase 76 (JF21, docs/journey-fixes-plan.md; owner 2026-11-05): ONE way to add people. The home's quick action, the
// (+) sheet's "Add people", People's header button and its empty state all open this chooser (`/add`): shared
// `addChoices` -- "A family (parent and child)" (in a personal space "My child", the reader the parent), "A tutor"
// where Tutoring is on, "Someone else" and "Invite by email". A choice gives way to its flow in place: the add-student
// flow (family first; `guardian=me` for "My child"), the add-tutor flow, the person form (which ends on the next
// steps), or InvitePeople in a sheet. A fitted sheet: its root is a ScrollView, as QuickSheet explains.
import { COMMON_COPY, PERSONAL_ADD_PERSON_LABEL, type AddChoice } from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/state-views';
import { useIconSize } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { ADD_CHOICE_ICONS, ADD_CHOOSER_LOCKED, addChoiceHref, chooserChoices } from './add-person-model';

function close() {
  if (router.canGoBack()) router.back();
}

export function AddChooser() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const iconSize = useIconSize(24);
  const disc = Math.max(44, iconSize + 20);
  const { user, account, organization } = useAuth();
  const choices = chooserChoices(organization, user ? { roles: user.roles, account } : null);
  const personal = organization?.personal ?? false;

  const choose = (choice: AddChoice) => {
    haptics.selection();
    // The sheet gives way to the flow it chose.
    router.replace(addChoiceHref(choice, { personal }));
  };

  return (
    <ScrollView
      testID="add-chooser"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.md }}
      alwaysBounceVertical={false}
      nestedScrollEnabled
    >
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text testID="add-chooser-title" variant="titleLarge" accessibilityRole="header">
            {personal ? PERSONAL_ADD_PERSON_LABEL : COMMON_COPY.add_person}
          </Text>
          {choices.length > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {personal ? 'Your child, with you as their parent.' : 'Who are you adding?'}
            </Text>
          ) : null}
        </View>
        {choices.length === 0 ? (
          <EmptyState testID="add-chooser-locked" icon="lock-outline" title={ADD_CHOOSER_LOCKED} />
        ) : (
          <View accessibilityRole="menu" style={{ gap: space.xs }}>
            {choices.map((choice) => (
              <Pressable
                key={choice.id}
                testID={`add-choice-${choice.id}`}
                accessibilityRole="menuitem"
                accessibilityLabel={choice.label}
                accessibilityHint={choice.description}
                onPress={() => choose(choice.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: 64,
                  paddingVertical: space.sm,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? theme.tokens.muted : 'transparent',
                })}
              >
                <View
                  style={{
                    width: disc,
                    height: disc,
                    borderRadius: disc / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.primaryContainer,
                  }}
                >
                  <Icon source={ADD_CHOICE_ICONS[choice.id]} size={iconSize} color={theme.colors.onPrimaryContainer} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="titleMedium">{choice.label}</Text>
                  <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
                    {choice.description}
                  </Text>
                </View>
                <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.outlineVariant,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
        }}
      >
        <Button testID="add-chooser-cancel" mode="text" onPress={close} contentStyle={{ minHeight: 48 }}>
          {choices.length === 0 ? 'Close' : 'Cancel'}
        </Button>
      </View>
    </ScrollView>
  );
}
