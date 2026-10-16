// The create button's sheet (UI upgrades U2): the reader's own actions, as large rows. Each one
// only routes to the sheet that already does the work; nothing here creates anything itself.
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState, type RefObject } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIconSize } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useActiveSession, useAssignments } from '@/features/teaching/api';
import { createActions, type CreateAction } from './create-actions';

export function CreateSheet({ sheetRef }: { sheetRef: RefObject<BottomSheetModal | null> }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const isTutor = user?.roles.includes('tutor') ?? false;

  // Android's back closes the sheet before it leaves the screen.
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      sheetRef.current?.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [open, sheetRef]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  const choose = useCallback(
    (action: CreateAction) => {
      haptics.selection();
      sheetRef.current?.dismiss();
      router.push(action.href);
    },
    [sheetRef],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      animateOnMount={!reduced}
      backdropComponent={renderBackdrop}
      onChange={(index) => setOpen(index >= 0)}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.outlineVariant }}
      accessibilityLabel="Create"
    >
      <BottomSheetScrollView
        testID="create-sheet"
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: space.xl + insets.bottom,
          gap: space.xs,
        }}
      >
        <Text variant="titleLarge" accessibilityRole="header" style={{ marginBottom: space.sm }}>
          Create
        </Text>
        {/* Only a tutor asks whether they teach anyone (and whether a lesson is running): Start
            needs both, and nobody else is offered it. */}
        {isTutor && user ? (
          <TutorActions userId={user.id} onChoose={choose} />
        ) : (
          <ActionList actions={createActions(user?.roles)} onChoose={choose} />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function TutorActions({ userId, onChoose }: { userId: string; onChoose: (action: CreateAction) => void }) {
  const { user } = useAuth();
  // The same queries as Sessions' Start button, so the cache is shared.
  const pairings = useAssignments({ tutor_user_id: userId });
  const active = useActiveSession();
  const actions = createActions(user?.roles, {
    teaches: (pairings.data?.data.length ?? 0) > 0,
    // Unknown counts as running, as on Sessions: Start appears once the server says nothing is.
    lessonRunning: !active.isSuccess || active.data.data.mine !== null,
  });
  return <ActionList actions={actions} onChoose={onChoose} />;
}

function ActionList({
  actions,
  onChoose,
}: {
  actions: CreateAction[];
  onChoose: (action: CreateAction) => void;
}) {
  return (
    <View accessibilityRole="menu" style={{ gap: space.xs }}>
      {actions.map((action) => (
        <ActionRow key={action.id} action={action} onChoose={onChoose} />
      ))}
    </View>
  );
}

const ActionRow = memo(function ActionRow({
  action,
  onChoose,
}: {
  action: CreateAction;
  onChoose: (action: CreateAction) => void;
}) {
  const theme = useAppTheme();
  const iconSize = useIconSize(24);
  const disc = Math.max(44, iconSize + 20);
  return (
    <Pressable
      testID={`create-action-${action.id}`}
      accessibilityRole="menuitem"
      accessibilityLabel={action.title}
      accessibilityHint={action.description}
      onPress={() => onChoose(action)}
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
        <Icon source={action.icon} size={iconSize} color={theme.colors.onPrimaryContainer} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleMedium">{action.title}</Text>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          {action.description}
        </Text>
      </View>
      <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
    </Pressable>
  );
});
