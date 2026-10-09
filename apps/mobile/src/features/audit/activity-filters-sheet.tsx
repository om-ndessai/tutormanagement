// Ported from apps/web/src/features/audit/activity-page.tsx @ 1132322 (its filter row). On the phone
// the filters live in an in-screen bottom sheet (immersive-design §5): Person (admins only), Action,
// From and To. Each change applies at once, as on the web.
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { auditEntity } from '@tmi/shared';
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { BackHandler, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateTimeField } from '@/components/date-time-field';
import { OptionPicker, type PickerOption } from '@/components/option-picker';
import { useUsers } from '@/features/users/api';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { actionLabel, type ActivityFilter } from './activity-model';
import { useAuditActions } from './api';

const ANY = 'any';

export function ActivityFiltersSheet({
  sheetRef,
  filter,
  onChange,
  isAdmin,
  today,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  filter: ActivityFilter;
  onChange: (next: ActivityFilter) => void;
  isAdmin: boolean;
  /** The organization's today, "YYYY-MM-DD": where a newly set date starts. */
  today: string;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const snapPoints = useMemo(() => ['75%'], []);

  // Only admins can list everybody, so the person filter -- and its request -- is theirs alone.
  const users = useUsers({ limit: 100, sort: 'full_name' }, { enabled: isAdmin });
  const actions = useAuditActions();

  const people: PickerOption[] = useMemo(
    () => [
      { id: ANY, label: 'Everyone' },
      ...(users.data?.data ?? []).map((user) => ({ id: user.id, label: user.full_name })),
    ],
    [users.data],
  );
  const actionOptions: PickerOption[] = useMemo(
    () => [
      { id: ANY, label: 'All actions' },
      ...(actions.data?.data ?? []).map((value) => ({
        id: value,
        label: actionLabel(value),
        detail: auditEntity(value),
      })),
    ],
    [actions.data],
  );

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

  function set(next: Partial<ActivityFilter>) {
    haptics.selection();
    onChange({ ...filter, ...next });
  }

  const hasFilters = Boolean(filter.user_id || filter.action || filter.from || filter.to);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      animateOnMount={!reduced}
      backdropComponent={renderBackdrop}
      onChange={(index) => setOpen(index >= 0)}
      backgroundStyle={{ backgroundColor: theme.colors.elevation.level1 }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.outline }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      accessibilityLabel="Filter activity"
    >
      <BottomSheetScrollView
        testID="activity-filters-sheet"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: space.xxl + insets.bottom,
          gap: space.lg,
        }}
      >
        <Text variant="titleLarge" accessibilityRole="header">
          Filter activity
        </Text>

        {isAdmin ? (
          <OptionPicker
            testID="activity-filter-person"
            label="Person"
            placeholder="Everyone"
            options={people}
            value={filter.user_id ?? ANY}
            onChange={(id) => set({ user_id: id === ANY ? undefined : id })}
            searchPlaceholder="Search people"
          />
        ) : null}

        <OptionPicker
          testID="activity-filter-action"
          label="Action"
          placeholder="All actions"
          options={actionOptions}
          value={filter.action ?? ANY}
          onChange={(id) => set({ action: id === ANY ? undefined : id })}
          searchPlaceholder="Search actions"
        />

        <DateFilter
          testID="activity-filter-from"
          label="From"
          value={filter.from}
          start={filter.to && filter.to < today ? filter.to : today}
          maximumDate={filter.to}
          onChange={(from) => set({ from })}
        />
        <DateFilter
          testID="activity-filter-to"
          label="To"
          value={filter.to}
          start={filter.from && filter.from > today ? filter.from : today}
          minimumDate={filter.from}
          onChange={(to) => set({ to })}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
          {hasFilters ? (
            <Button testID="activity-filters-clear" mode="text" onPress={() => onChange({})}>
              Clear filters
            </Button>
          ) : null}
          <Button testID="activity-filters-done" mode="contained" onPress={() => sheetRef.current?.dismiss()}>
            Done
          </Button>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

/** A date that may be absent: "Any day" until it is set, then the picker and a way to clear it. */
function DateFilter({
  testID,
  label,
  value,
  start,
  minimumDate,
  maximumDate,
  onChange,
}: {
  testID: string;
  label: string;
  value: string | undefined;
  start: string;
  minimumDate?: string;
  maximumDate?: string;
  onChange: (value: string | undefined) => void;
}) {
  const theme = useAppTheme();
  if (!value) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          {label}
        </Text>
        <Button
          testID={`${testID}-any`}
          mode="outlined"
          icon="calendar-blank-outline"
          accessibilityLabel={`${label}: any day. Choose a day`}
          onPress={() => onChange(start)}
        >
          Any day
        </Button>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View style={{ flex: 1 }}>
        <DateTimeField
          testID={testID}
          mode="date"
          label={label}
          value={value}
          onChange={onChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      </View>
      <IconButton
        testID={`${testID}-clear`}
        icon="close"
        accessibilityLabel={`Clear the ${label.toLowerCase()} date`}
        onPress={() => onChange(undefined)}
        style={{ margin: 0 }}
      />
    </View>
  );
}
