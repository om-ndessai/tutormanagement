// Ported from apps/web/src/features/users/guardian-picker.tsx @ 1132322.
//
// Picks the adults responsible for this person. Backs two rules at once: every student must have
// at least one (and they are created in ONE request with the student), and a tutor who is still a
// minor may have one too. Only users who already hold the parent role can be chosen, so the link
// cannot claim someone is a parent while their record says otherwise. A parent not yet on file is
// added through the same person form, opened over this one, and comes back chosen.
import { RELATIONSHIPS, RELATIONSHIP_LABELS } from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, HelperText, Icon, IconButton, Searchbar, Text } from 'react-native-paper';

import { Choice } from '@/components/form-choice';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useUserDetail, useUsers } from './api';
import { onGuardianCreated } from './guardian-bridge';
import { addGuardian, removeGuardian, updateGuardian, type GuardianValue } from './person-form-model';

export function GuardianPicker({
  value,
  onChange,
  excludeUserId,
  knownNames,
  error,
  required,
}: {
  value: GuardianValue[];
  onChange: (links: GuardianValue[]) => void;
  /** The person being edited, who must not appear in their own guardian list. */
  excludeUserId?: string;
  /** Names already known for the linked ids (an edited record's guardians). */
  knownNames?: Record<string, string>;
  error?: string;
  required?: boolean;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 250);
  const [names, setNames] = useState<Record<string, string>>(knownNames ?? {});
  const { data, isFetching } = useUsers(
    { role: 'parent', ...(search ? { search } : {}), limit: 25, sort: 'full_name' },
    { enabled: search.length > 0 },
  );

  // A parent created in the sheet opened over this one arrives here, chosen.
  useEffect(
    () =>
      onGuardianCreated((guardian) => {
        setNames((current) => ({ ...current, [guardian.id]: guardian.full_name }));
        onChange(addGuardian(value, guardian.id));
      }),
    [value, onChange],
  );

  const candidates = search
    ? (data?.data ?? []).filter(
        (candidate) =>
          candidate.id !== excludeUserId && !value.some((link) => link.guardian_user_id === candidate.id),
      )
    : [];
  // A guardian linked before this form knew their name -- the welcome wizard's preset (`?guardian=`)
  // -- is looked up on their own, one at a time, and remembered.
  const unnamed = value.find((link) => !names[link.guardian_user_id] && !knownNames?.[link.guardian_user_id]);
  const unnamedDetail = useUserDetail(unnamed?.guardian_user_id ?? null);
  const found = unnamedDetail.data?.data;
  if (found && unnamed && found.id === unnamed.guardian_user_id && !names[found.id]) {
    setNames((current) => ({ ...current, [found.id]: found.full_name }));
  }
  const nameFor = (id: string) => names[id] ?? knownNames?.[id] ?? 'Unknown';

  function add(id: string, fullName: string) {
    haptics.selection();
    setNames((current) => ({ ...current, [id]: fullName }));
    onChange(addGuardian(value, id));
    setQuery('');
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleSmall" style={{ color: error ? theme.colors.error : undefined }}>
          Parents / guardians
          {required ? <Text style={{ color: theme.colors.error }}> *</Text> : null}
        </Text>
        <Text variant="bodySmall" style={{ color: muted }}>
          Only people who already have the Parent role can be selected.
        </Text>
      </View>

      {value.map((link) => {
        const name = nameFor(link.guardian_user_id);
        return (
          <Card
            key={link.guardian_user_id}
            testID={`guardian-${link.guardian_user_id}`}
            mode="outlined"
            style={{ borderRadius: radius.md }}
          >
            <View style={{ padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text variant="bodyMedium" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                  {name}
                </Text>
                <IconButton
                  testID={`guardian-${link.guardian_user_id}-remove`}
                  icon="close"
                  accessibilityLabel={`Remove ${name}`}
                  onPress={() => {
                    haptics.selection();
                    onChange(removeGuardian(value, link.guardian_user_id));
                  }}
                  style={{ margin: 0 }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityLabel="Relationship">
                {RELATIONSHIPS.map((relationship) => (
                  <Choice
                    key={relationship}
                    testID={`guardian-${link.guardian_user_id}-rel-${relationship}`}
                    label={RELATIONSHIP_LABELS[relationship]}
                    selected={link.relationship === relationship}
                    onPress={() => onChange(updateGuardian(value, link.guardian_user_id, { relationship }))}
                  />
                ))}
              </View>
              <Pressable
                testID={`guardian-${link.guardian_user_id}-primary`}
                accessibilityRole="radio"
                accessibilityState={{ checked: link.is_primary }}
                accessibilityLabel={`${name} is the primary contact`}
                onPress={() => {
                  haptics.selection();
                  onChange(updateGuardian(value, link.guardian_user_id, { is_primary: true }));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET }}
              >
                <Icon
                  source={link.is_primary ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={link.is_primary ? theme.colors.primary : muted}
                />
                <Text variant="bodyMedium" style={{ color: muted }}>
                  Primary contact
                </Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      <Searchbar
        testID="guardian-search"
        placeholder="Add a parent or guardian"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        loading={isFetching && search.length > 0}
        accessibilityLabel="Search parents to add"
      />
      {search && candidates.length > 0 ? (
        <Card mode="outlined" style={{ borderRadius: radius.md }}>
          {candidates.slice(0, 8).map((candidate) => (
            <Pressable
              key={candidate.id}
              testID={`guardian-option-${candidate.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${candidate.full_name}`}
              onPress={() => add(candidate.id, candidate.full_name)}
              style={({ pressed }) => ({
                minHeight: MIN_TARGET,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                justifyContent: 'center',
                backgroundColor: pressed ? theme.colors.primaryContainer : 'transparent',
              })}
            >
              <Text variant="bodyMedium">{candidate.full_name}</Text>
              {candidate.email ? (
                <Text variant="bodySmall" style={{ color: muted }}>
                  {candidate.email}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </Card>
      ) : null}
      {search && !isFetching && candidates.length === 0 ? (
        <Text variant="bodySmall" style={{ color: muted }}>
          No parent matches. Add them below.
        </Text>
      ) : null}

      <Button
        testID="guardian-new"
        mode="outlined"
        icon="account-plus-outline"
        style={{ alignSelf: 'flex-start' }}
        onPress={() =>
          router.push({ pathname: '/person-form', params: { preset: 'parent', for: 'guardian' } })
        }
      >
        New parent…
      </Button>

      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}
