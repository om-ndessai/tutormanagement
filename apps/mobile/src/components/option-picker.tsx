// One choice from a list, inline in a form sheet: the web's Select, as a field that opens a list of
// options below it. A search field appears once there are more options than fit at a glance. The
// record sheet's PairingPicker is the same shape, specialised to pairings. A short fixed list (the twelve
// months) can be laid out as a grid instead (`columns`): every option in view, no search, no inner scroll.
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { Divider, Icon, Searchbar, Text } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { ICON_TARGET } from '@/components/icon-button';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

const SEARCH_FROM = 7;
const SHOWN = 8;

export interface PickerOption {
  id: string;
  label: string;
  /** A muted second part, e.g. "with Alex Chen". */
  detail?: string;
  /** Shown but not choosable (the web's disabled SelectItem): a grade with no questions yet. */
  disabled?: boolean;
}

export function OptionPicker({
  testID,
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  emptyText,
  searchPlaceholder = 'Search',
  defaultOpen,
  scroll = false,
  startAt,
  columns,
}: {
  /** The field's testID; each option is `<testID>-<id>`, the search field `<testID>-search`. */
  testID: string;
  label: string;
  placeholder: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  /** Whether the list starts open (default: while nothing is chosen). A fitted quick sheet starts it closed. */
  defaultOpen?: boolean;
  /**
   * Every option in a list that scrolls within about eight rows, rather than the first eight and a
   * search: for a short, fixed list a reader scans (the Assessment's levels), not a long one of names.
   */
  scroll?: boolean;
  /**
   * Where a `scroll` list opens while nothing is chosen: scrolled to this option, so a long list starts where most
   * readers' answer is (the birth year opens near an adult's, UI audit JF35, Phase 78); a chosen option opens at
   * itself. Typing in the search still narrows the whole list.
   */
  startAt?: string;
  /**
   * Every option at once, in a grid of this many columns, with no search field and no inner scroll: for a
   * short fixed list read at a glance (the birth month; UI audit JF35, where October hid below the edge).
   */
  columns?: number;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const chosen = options.find((option) => option.id === value);
  const [open, setOpen] = useState(defaultOpen ?? !value);
  const [search, setSearch] = useState('');

  const needle = search.trim().toLowerCase();
  const matching = options.filter(
    (option) =>
      !needle ||
      option.label.toLowerCase().includes(needle) ||
      (option.detail?.toLowerCase().includes(needle) ?? false),
  );
  const shown = scroll ? matching : matching.slice(0, SHOWN);
  // A `scroll` list opens at the chosen option, else at `startAt` -- once per opening, and not while searching.
  const listRef = useRef<ScrollView | null>(null);
  const placed = useRef(false);
  const anchor = scroll && !needle ? value || startAt : undefined;

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={chosen ? `${label}: ${chosen.label}. Change` : placeholder}
        onPress={() => {
          placed.current = false;
          setOpen((was) => !was);
        }}
        style={({ pressed }) => ({
          minHeight: MIN_TARGET + 8,
          borderWidth: 1,
          borderColor: error ? theme.colors.error : theme.colors.outline,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: pressed ? theme.tokens.muted : 'transparent',
        })}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: error ? theme.colors.error : muted }}>{label}</Text>
          <Text variant="bodyLarge" style={{ color: chosen ? theme.colors.onSurface : muted }}>
            {chosen ? chosen.label : placeholder}
            {chosen?.detail ? (
              <Text variant="bodySmall" style={{ color: muted }}>
                {' '}
                {chosen.detail}
              </Text>
            ) : null}
          </Text>
        </View>
        <Icon source={open ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />
      </Pressable>
      {error ? <FieldError>{error}</FieldError> : null}

      {open ? (
        <View style={{ gap: space.sm }}>
          {options.length === 0 && emptyText ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              {emptyText}
            </Text>
          ) : null}
          {options.length >= SEARCH_FROM && !columns ? (
            <Searchbar
              testID={`${testID}-search`}
              placeholder={searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
          ) : null}
          {options.length > 0 && columns ? (
            <OptionGrid
              testID={testID}
              columns={columns}
              options={options}
              value={value}
              onChoose={(id) => {
                haptics.selection();
                onChange(id);
                setOpen(false);
              }}
            />
          ) : null}
          {options.length > 0 && !columns ? (
            <ListFrame
              scroll={scroll}
              scrollRef={listRef}
              testID={`${testID}-list`}
              style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: radius.md }}
            >
              {shown.map((option, index) => {
                const selected = option.id === value;
                return (
                  <View
                    key={option.id}
                    onLayout={
                      option.id === anchor
                        ? (event) => {
                            if (placed.current) return;
                            placed.current = true;
                            listRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
                          }
                        : undefined
                    }
                  >
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      testID={`${testID}-${option.id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: Boolean(option.disabled) }}
                      disabled={option.disabled}
                      onPress={() => {
                        haptics.selection();
                        // The search field goes with the list; on Android its keyboard would stay.
                        Keyboard.dismiss();
                        onChange(option.id);
                        setOpen(false);
                        setSearch('');
                      }}
                      style={({ pressed }) => ({
                        minHeight: ICON_TARGET, // 44pt iOS, 48dp Android (ux-audit F-5)
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
                      })}
                    >
                      <Text
                        variant="bodyMedium"
                        style={{ flex: 1, color: option.disabled ? muted : theme.colors.onSurface }}
                      >
                        {option.label}
                        {option.detail ? (
                          <Text variant="bodySmall" style={{ color: muted }}>
                            {' '}
                            {option.detail}
                          </Text>
                        ) : null}
                      </Text>
                      {selected ? <Icon source="check" size={18} color={theme.colors.primary} /> : null}
                    </Pressable>
                  </View>
                );
              })}
              {matching.length === 0 ? (
                <Text variant="bodySmall" style={{ color: muted, padding: space.md }}>
                  Nothing matches that name.
                </Text>
              ) : null}
            </ListFrame>
          ) : null}
          {!scroll && !columns && matching.length > SHOWN ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              Showing {SHOWN} of {matching.length}. Type to narrow it down.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Every option as a cell of a grid, `columns` to a row (the options' testIDs as in the list). */
function OptionGrid({
  testID,
  columns,
  options,
  value,
  onChoose,
}: {
  testID: string;
  columns: number;
  options: PickerOption[];
  value: string;
  onChoose: (id: string) => void;
}) {
  const theme = useAppTheme();
  const rows: PickerOption[][] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
  return (
    <View
      testID={`${testID}-list`}
      accessibilityRole="radiogroup"
      style={{
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, r) => (
        <View
          key={row[0]!.id}
          style={{
            flexDirection: 'row',
            borderTopWidth: r > 0 ? 1 : 0,
            borderTopColor: theme.colors.outlineVariant,
          }}
        >
          {Array.from({ length: columns }, (_, c) => {
            const option = row[c];
            const edge = { borderLeftWidth: c > 0 ? 1 : 0, borderLeftColor: theme.colors.outlineVariant };
            if (!option) return <View key={`empty-${c}`} style={{ flex: 1, ...edge }} />;
            const selected = option.id === value;
            return (
              <Pressable
                key={option.id}
                testID={`${testID}-${option.id}`}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected, disabled: Boolean(option.disabled) }}
                disabled={option.disabled}
                onPress={() => {
                  Keyboard.dismiss();
                  onChoose(option.id);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: ICON_TARGET, // 44pt iOS, 48dp Android
                  paddingHorizontal: space.xs,
                  paddingVertical: space.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  backgroundColor: selected
                    ? theme.colors.primaryContainer
                    : pressed
                      ? theme.tokens.muted
                      : 'transparent',
                  ...edge,
                })}
              >
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={{
                    flexShrink: 1,
                    textAlign: 'center',
                    fontWeight: selected ? '700' : '400',
                    color: option.disabled
                      ? theme.tokens.mutedForeground
                      : selected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurface,
                  }}
                >
                  {option.label}
                </Text>
                {selected ? <Icon source="check" size={16} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The options' frame: a plain view, or, for a `scroll` picker, a list about eight rows tall that scrolls. */
function ListFrame({
  scroll,
  scrollRef,
  testID,
  style,
  children,
}: {
  scroll: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  testID: string;
  style: ViewStyle;
  children: ReactNode;
}) {
  if (!scroll) {
    return (
      <View style={style} accessibilityRole="radiogroup">
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      // Inside the screen's own scroll view: Android scrolls the inner list only when told to.
      nestedScrollEnabled
      // Its own setting, not the outer one's: without it a tap on an option while the search
      // field's keyboard is up only puts the keyboard away, and the option needs a second tap.
      keyboardShouldPersistTaps="handled"
      style={[style, { maxHeight: SHOWN * (ICON_TARGET + 8) }]}
      accessibilityRole="radiogroup"
    >
      {children}
    </ScrollView>
  );
}
