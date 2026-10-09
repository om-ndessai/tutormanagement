// The directory's controls, from apps/web/src/features/users/users-page.tsx @ 1132322: search, role,
// status and "Show deactivated" -- plus the sort the web puts on its column headers. Stacked rather
// than squeezed onto one row, which on a phone pushed the page wider than the screen.
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  type UserRole,
  type UserSortField,
  type UserStatus,
} from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Menu, Searchbar, Switch, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { SORT_OPTIONS, sortLabel } from './people-model';

export interface PeopleFilterState {
  search: string;
  role: UserRole | null;
  status: UserStatus | null;
  includeDeleted: boolean;
  sort: UserSortField;
  order: 'asc' | 'desc';
}

export function PeopleFilters({
  value,
  onChange,
  isAdmin,
}: {
  value: PeopleFilterState;
  onChange: (next: Partial<PeopleFilterState>) => void;
  isAdmin: boolean;
}) {
  const theme = useAppTheme();
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const chooseRole = (role: UserRole | null) => {
    haptics.selection();
    onChange({ role });
  };

  return (
    <View style={{ gap: space.md }}>
      <Searchbar
        testID="people-search"
        placeholder="Search by name or email"
        value={value.search}
        onChangeText={(search) => onChange({ search })}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search users"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityLabel="Role">
        <Chip
          testID="people-role-all"
          selected={value.role === null}
          showSelectedCheck={false}
          mode={value.role === null ? 'flat' : 'outlined'}
          onPress={() => chooseRole(null)}
        >
          All roles
        </Chip>
        {USER_ROLES.map((role) => (
          <Chip
            key={role}
            testID={`people-role-${role}`}
            selected={value.role === role}
            showSelectedCheck={false}
            mode={value.role === role ? 'flat' : 'outlined'}
            onPress={() => chooseRole(value.role === role ? null : role)}
          >
            {USER_ROLE_LABELS[role]}
          </Chip>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Menu
          visible={statusOpen}
          onDismiss={() => setStatusOpen(false)}
          anchor={
            <Button
              testID="people-status-menu"
              mode="outlined"
              icon="chevron-down"
              contentStyle={{ flexDirection: 'row-reverse' }}
              onPress={() => setStatusOpen(true)}
              accessibilityLabel={`Status: ${value.status ? USER_STATUS_LABELS[value.status] : 'All statuses'}`}
            >
              {value.status ? USER_STATUS_LABELS[value.status] : 'All statuses'}
            </Button>
          }
        >
          <Menu.Item
            testID="people-status-any"
            title="All statuses"
            leadingIcon={value.status === null ? 'check' : undefined}
            onPress={() => {
              setStatusOpen(false);
              haptics.selection();
              onChange({ status: null });
            }}
          />
          {USER_STATUSES.map((status) => (
            <Menu.Item
              key={status}
              testID={`people-status-${status}`}
              title={USER_STATUS_LABELS[status]}
              leadingIcon={value.status === status ? 'check' : undefined}
              onPress={() => {
                setStatusOpen(false);
                haptics.selection();
                onChange({ status });
              }}
            />
          ))}
        </Menu>

        <Menu
          visible={sortOpen}
          onDismiss={() => setSortOpen(false)}
          anchor={
            <Button
              testID="people-sort-menu"
              mode="outlined"
              icon="sort"
              onPress={() => setSortOpen(true)}
              accessibilityLabel={`Sort: ${sortLabel(value.sort, value.order)}`}
            >
              {sortLabel(value.sort, value.order)}
            </Button>
          }
        >
          {SORT_OPTIONS.map((option) => {
            const chosen = option.sort === value.sort && option.order === value.order;
            return (
              <Menu.Item
                key={`${option.sort}-${option.order}`}
                testID={`people-sort-${option.sort}-${option.order}`}
                title={option.label}
                leadingIcon={chosen ? 'check' : undefined}
                onPress={() => {
                  setSortOpen(false);
                  haptics.selection();
                  onChange({ sort: option.sort, order: option.order });
                }}
              />
            );
          })}
        </Menu>
      </View>

      {/* Retired people are an admin's concern: the server ignores the flag for anyone else. */}
      {isAdmin ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.md,
          }}
        >
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            Show deactivated
          </Text>
          <Switch
            testID="people-include-deleted"
            value={value.includeDeleted}
            accessibilityLabel="Show deactivated"
            onValueChange={(includeDeleted) => {
              haptics.selection();
              onChange({ includeDeleted });
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
