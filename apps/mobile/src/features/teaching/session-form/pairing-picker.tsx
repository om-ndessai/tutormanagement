// The pairing a lesson is recorded against: the web's Student select
// (session-form-dialog.tsx @ 1132322), as an inline list in the sheet. A search field appears once
// there are more pairings than fit at a glance (an admin sees every pairing in the organization).
import type { Assignment } from '@tmi/shared';
import { useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { Divider, HelperText, Icon, Searchbar, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

const SEARCH_FROM = 7;
const SHOWN = 8;

export function PairingPicker({
  assignments,
  value,
  onChange,
  showTutor,
  error,
  testID = 'record-pairing',
}: {
  assignments: Assignment[];
  value: string;
  onChange: (assignmentId: string) => void;
  /** An admin picks among every tutor's pairings, so each names its tutor. */
  showTutor: boolean;
  error?: string;
  /** The field's testID; each option is `<testID>-<assignment id>`. */
  testID?: string;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const chosen = assignments.find((a) => a.id === value);
  const [open, setOpen] = useState(!chosen);
  const [search, setSearch] = useState('');

  const needle = search.trim().toLowerCase();
  const matching = assignments.filter(
    (a) =>
      !needle || a.student_name.toLowerCase().includes(needle) || a.tutor_name.toLowerCase().includes(needle),
  );
  const shown = matching.slice(0, SHOWN);

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={chosen ? `Student: ${chosen.student_name}. Change` : 'Choose a student'}
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
          <Text style={{ fontSize: 11, color: error ? theme.colors.error : muted }}>Student</Text>
          <Text variant="bodyLarge" style={{ color: chosen ? theme.colors.onSurface : muted }}>
            {chosen ? chosen.student_name : 'Choose a student'}
            {chosen && showTutor ? (
              <Text variant="bodySmall" style={{ color: muted }}>
                {' '}
                with {chosen.tutor_name}
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
          {assignments.length === 0 ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              You have no students assigned. An admin assigns students to tutors.
            </Text>
          ) : null}
          {assignments.length >= SEARCH_FROM ? (
            <Searchbar
              testID={`${testID}-search`}
              placeholder="Search students or tutors"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
          ) : null}
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
                      // The search field goes with the list; on Android its keyboard would stay.
                      Keyboard.dismiss();
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
                      {option.student_name}
                      {showTutor ? (
                        <Text variant="bodySmall" style={{ color: muted }}>
                          {' '}
                          with {option.tutor_name}
                        </Text>
                      ) : null}
                    </Text>
                    {selected ? <Icon source="check" size={18} color={theme.colors.primary} /> : null}
                  </Pressable>
                </View>
              );
            })}
            {matching.length === 0 && assignments.length > 0 ? (
              <Text variant="bodySmall" style={{ color: muted, padding: space.md }}>
                No pairing matches that name.
              </Text>
            ) : null}
          </View>
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
