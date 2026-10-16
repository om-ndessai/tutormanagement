// One decision, or up to three inputs (UI upgrades U2; docs/ui-upgrades-spec.md): the body of a
// `formSheet` route. A title, an optional line under it, the body, and the primary action at the
// sheet's foot with a quiet Cancel beside it -- in the thumb zone, never at the end of a long scroll.
//
// Register the route with `sheetAllowedDetents: 'fitToContents'` and `sheetGrabberVisible: true`:
// the sheet is then exactly as tall as what it holds, so the action row is its bottom edge. The
// root is a ScrollView on purpose: react-native-screens sizes a form sheet's content natively and
// only resizes a root ScrollView (`RNSScreenContentWrapper`), so a View with a flex body and a
// separate footer collapses its body to nothing (checked on the iOS 27 simulator, U2). When the
// content outgrows the screen -- the largest text sizes -- the sheet stops at full height and
// scrolls, action included. Leaving with unsaved work asks first (`dirty`); `onPrimary` gets
// `leave` to close after a save without being asked.
import { router } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { FieldErrorProvider, useFieldErrorAnchors } from './field-error';

export interface QuickSheetProps {
  /** The root's testID; the action is `<testID>-save`, Cancel `<testID>-cancel`. */
  testID?: string;
  /** The buttons' prefix when it differs from the root's (`payment` -> `payment-save`). */
  actionTestID?: string;
  title: string;
  /** One line under the title. */
  description?: string;
  children: ReactNode;
  /** The action's label (default "Save"). */
  primaryLabel?: string;
  /** A Material Community Icons name for the action. */
  primaryIcon?: string;
  /** Runs on the action. Close with `leave()` on success, so a saved sheet is not asked about. */
  onPrimary: (done: { leave: (close?: () => void) => void }) => void | Promise<void>;
  primaryDisabled?: boolean;
  /** The action is under way: it spins, and both buttons wait. */
  loading?: boolean;
  /** How to leave without saving (default: back out of the route). */
  onCancel?: () => void;
  cancelLabel?: string;
  /** A refusal tied to no field, shown just above the action. */
  error?: string | null;
  /** Whether leaving would lose work: Cancel, a swipe down and Android's back then ask first. */
  dirty?: boolean;
}

export function QuickSheet({
  testID = 'quick-sheet',
  actionTestID,
  title,
  description,
  children,
  primaryLabel = 'Save',
  primaryIcon,
  onPrimary,
  primaryDisabled = false,
  loading = false,
  onCancel,
  cancelLabel = 'Cancel',
  error,
  dirty = false,
}: QuickSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { leave } = useUnsavedChangesGuard(dirty);
  const actions = actionTestID ?? testID;
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useFieldErrorAnchors(scrollRef, true);

  const back = () => (router.canGoBack() ? router.back() : undefined);
  const cancel = () => (onCancel ? onCancel() : back());

  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.md }}
      // It fits at the default text size, so it does not scroll (or bounce) unless it must.
      alwaysBounceVertical={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      // Android's form sheet drags unless its child scrolls as a nested scroll (see Screen).
      nestedScrollEnabled
      onScroll={(event) => anchors.onScroll(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={64}
    >
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text variant="titleLarge" accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {description}
            </Text>
          ) : null}
        </View>
        <FieldErrorProvider value={anchors.anchors}>{children}</FieldErrorProvider>
      </View>

      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.outlineVariant,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          gap: space.sm,
        }}
      >
        {error ? (
          <HelperText type="error" padding="none" testID={`${actions}-error`}>
            {error}
          </HelperText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Button
            testID={`${actions}-cancel`}
            mode="text"
            onPress={cancel}
            disabled={loading}
            contentStyle={styles.button}
          >
            {cancelLabel}
          </Button>
          <Button
            testID={`${actions}-save`}
            mode="contained"
            icon={primaryIcon}
            onPress={() => void onPrimary({ leave: (close) => leave(close ?? back) })}
            loading={loading}
            disabled={loading || primaryDisabled}
            style={{ flexGrow: 1 }}
            contentStyle={styles.button}
          >
            {primaryLabel}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
