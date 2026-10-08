// Ported from apps/web/src/features/dashboard/user-picker.tsx @ 1132322 -- the combobox becomes the
// body of the (org)/view-as sheet.
import { USER_ROLE_LABELS } from '@tmi/shared';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Divider, Icon, List, Searchbar, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { useUsers } from '@/features/users/api';
import { RoleIcons } from '@/features/users/role-icon';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { chooseFromSheet } from './view-as';

/**
 * Chooses whose dashboard to view. The directory is searched on the server, so it stays usable
 * however many people the organization has, not just the first page. Admins only: the sheet
 * renders nothing for anyone else, and the API refuses them anyway.
 */
export function UserPickerSheet({ current }: { current: string | null }) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 250);
  const isAdmin = user?.roles.includes('admin') ?? false;

  const { data, isFetching } = useUsers(
    { ...(debounced ? { search: debounced } : {}), limit: 25, sort: 'full_name' },
    { enabled: isAdmin },
  );
  const users = useMemo(
    () => (data?.data ?? []).filter((candidate) => candidate.id !== user?.id),
    [data, user?.id],
  );

  function choose(userId: string | null) {
    haptics.selection();
    chooseFromSheet(userId);
  }

  if (!isAdmin) return <Screen testID="screen-view-as">{null}</Screen>;

  // An empty slot rather than a transparent glyph: Android draws a 'transparent' icon colour black.
  const check = (selected: boolean) =>
    selected ? (
      <Icon source="check" size={20} color={theme.colors.primary} />
    ) : (
      <View style={{ width: 20, height: 20 }} />
    );

  return (
    <Screen testID="screen-view-as" edges={['bottom']} contentStyle={{ paddingTop: space.xl, gap: space.md }}>
      <Text variant="titleLarge" accessibilityRole="header">
        View dashboard as
      </Text>
      <Searchbar
        testID="view-as-search"
        placeholder="Search by name or email…"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        loading={isFetching}
      />
      <View>
        <List.Item
          testID="view-as-self"
          title="My own dashboard"
          left={() => (
            <View style={{ justifyContent: 'center', paddingLeft: space.sm }}>{check(current === null)}</View>
          )}
          onPress={() => choose(null)}
        />
        {users.map((candidate) => (
          <View key={candidate.id}>
            <Divider />
            <List.Item
              testID={`view-as-user-${candidate.id}`}
              title={candidate.full_name}
              description={candidate.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ') || 'No role'}
              left={() => (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.sm }}
                >
                  {check(current === candidate.id)}
                  <RoleIcons roles={candidate.roles} size={18} />
                </View>
              )}
              onPress={() => choose(candidate.id)}
            />
          </View>
        ))}
        {users.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.tokens.mutedForeground, textAlign: 'center', paddingVertical: space.xl }}
          >
            {isFetching ? 'Searching…' : 'No one matches that name or email.'}
          </Text>
        ) : null}
      </View>
      {!debounced && users.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon source="magnify" size={14} color={theme.tokens.mutedForeground} />
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            Showing the first {users.length}. Type to search everyone.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
