// One choice from a list, inline in a form sheet: the web's Select, as a field that opens a list of
// options below it. A search field appears once there are more options than fit at a glance. The
// record sheet's PairingPicker is the same shape, specialised to pairings.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Divider, HelperText, Icon, Searchbar, Text } from 'react-native-paper';

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
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const chosen = options.find((option) => option.id === value);
  const [open, setOpen] = useState(!value);
  const [search, setSearch] = useState('');

  const needle = search.trim().toLowerCase();
  const matching = options.filter(
    (option) =>
      !needle ||
      option.label.toLowerCase().includes(needle) ||
      (option.detail?.toLowerCase().includes(needle) ?? false),
  );
  const shown = matching.slice(0, SHOWN);

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={chosen ? `${label}: ${chosen.label}. Change` : placeholder}
        onPress={() => setOpen((was) => !was)}
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
          <Text style={{ fontSize: 11, color: error ? theme.colors.error : muted }}>{label}</Text>
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
      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}

      {open ? (
        <View style={{ gap: space.sm }}>
          {options.length === 0 && emptyText ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              {emptyText}
            </Text>
          ) : null}
          {options.length >= SEARCH_FROM ? (
            <Searchbar
              testID={`${testID}-search`}
              placeholder={searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
          ) : null}
          {options.length > 0 ? (
            <View
              style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: radius.md }}
              accessibilityRole="radiogroup"
            >
              {shown.map((option, index) => {
                const selected = option.id === value;
                return (
                  <View key={option.id}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      testID={`${testID}-${option.id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        haptics.selection();
                        onChange(option.id);
                        setOpen(false);
                        setSearch('');
                      }}
                      style={({ pressed }) => ({
                        minHeight: MIN_TARGET,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
                      })}
                    >
                      <Text variant="bodyMedium" style={{ flex: 1 }}>
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
            </View>
          ) : null}
          {matching.length > SHOWN ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              Showing {SHOWN} of {matching.length}. Type to narrow it down.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
