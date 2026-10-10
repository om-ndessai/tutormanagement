// Ported from apps/web/src/components/layout/command-palette.tsx @ 1132322: navigation becomes
// search -- type a few letters of a page, a person or an action. Only ever offers what the reader
// may do; the API decides the rest.
import { USER_ROLE_LABELS } from '@tmi/shared';
import { router, Stack, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, List, Searchbar, Surface, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { useOptionalOnboarding } from '@/features/onboarding/onboarding-provider';
import { useUsers } from '@/features/users/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme, useThemeMode } from '@/providers/theme-provider';
import { motion, radius, space } from '@/theme/tokens';
import { useNavItems } from './nav-items';
import { filterRows, PEOPLE_MIN_CHARS, personHref, THEME_ACTIONS } from './search-model';

interface ActionRow {
  key: string;
  testID: string;
  label: string;
  value: string;
  icon: string;
  run: () => void;
}

function Section({ testID, title, children }: { testID: string; title: string; children: React.ReactNode }) {
  return (
    <View testID={testID}>
      <List.Subheader style={{ paddingHorizontal: space.xs }}>{title}</List.Subheader>
      <Surface elevation={1} style={{ borderRadius: radius.lg }}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>
      </Surface>
    </View>
  );
}

export function SearchScreen() {
  const theme = useAppTheme();
  const { user, memberships, organization, platformAdmin, chooseOrganization, signOut } = useAuth();
  const { setMode } = useThemeMode();
  const destinations = useNavItems();
  const onboarding = useOptionalOnboarding();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const [query, setQuery] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Leaving by hand before a theme action closes search must not pop a second screen.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // People are searched on the server, as the reader is allowed to see them, once there are two
  // letters to go on.
  const search = useDebouncedValue(query.trim(), 200);
  const searching = search.length >= PEOPLE_MIN_CHARS;
  const people = useUsers(
    { search: searching ? search : undefined, limit: 6, sort: 'full_name' },
    { enabled: searching },
  );
  const found = searching ? (people.data?.data ?? []) : [];
  const peopleLoading =
    query.trim().length >= PEOPLE_MIN_CHARS && (search !== query.trim() || people.isFetching);

  /** Leaves search, as the palette closes, then does what was asked. */
  function leaveThen(action: () => void) {
    haptics.selection();
    router.back();
    action();
  }

  function go(href: Href) {
    leaveThen(() => router.push(href));
  }

  const otherOrganizations = memberships.filter(
    (membership) => membership.status === 'active' && membership.slug !== organization?.slug,
  );

  const actions: ActionRow[] = [
    // The web palette's "Take the tour": the welcome wizard, which offers the tour (#34).
    ...(onboarding
      ? [
          {
            key: 'tour',
            testID: 'search-action-tour',
            label: 'Take the tour',
            value: 'take the tour help guide welcome',
            icon: 'compass-outline',
            run: () => leaveThen(() => onboarding.openWizard()),
          },
        ]
      : []),
    ...THEME_ACTIONS.map((action) => ({
      key: `theme-${action.mode}`,
      testID: `search-action-theme-${action.mode}`,
      label: action.label,
      value: action.value,
      icon: action.icon,
      // The theme changes HERE, and search closes once the new palette has faded in: changing it
      // while the screen is being popped re-renders every header mid-transition, which crashed
      // react-native-screens on Android ("ScreenStackFragment added into a non-stack container").
      run: () => {
        haptics.selection();
        setMode(action.mode);
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => router.back(), motion.slow + 100);
      },
    })),
    ...otherOrganizations.map((membership) => ({
      key: `org-${membership.slug}`,
      testID: `search-action-org-${membership.slug}`,
      label: `Switch to ${membership.name}`,
      value: `switch organization ${membership.name}`,
      icon: 'swap-horizontal',
      run: () => {
        haptics.selection();
        router.dismissAll();
        void chooseOrganization(membership.slug).then(() => router.replace('/dashboard'));
      },
    })),
    ...(platformAdmin
      ? [
          {
            key: 'platform',
            testID: 'search-action-platform',
            label: 'Platform console',
            value: 'platform console organizations',
            icon: 'shield-check-outline',
            run: () => {
              haptics.selection();
              router.dismissAll();
              router.push('/platform');
            },
          },
        ]
      : []),
    {
      key: 'sign-out',
      testID: 'search-action-sign-out',
      label: 'Sign out',
      value: 'sign out log out',
      icon: 'logout',
      run: () => {
        haptics.selection();
        router.dismissAll();
        void signOut();
      },
    },
  ];

  const pages = filterRows(
    destinations.map((item) => ({ item, value: `${item.label} ${item.keywords.join(' ')}` })),
    query,
  );
  const shownActions = filterRows(actions, query);
  const nothing = pages.length === 0 && shownActions.length === 0 && found.length === 0 && !peopleLoading;

  return (
    <Screen testID="screen-search">
      <Stack.Screen options={{ title: 'Search' }} />
      <Searchbar
        testID="search-input"
        placeholder="Search pages, people and actions…"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search pages, people and actions"
      />

      {nothing ? (
        <Text
          testID="search-empty"
          variant="bodyMedium"
          style={{ color: theme.tokens.mutedForeground, textAlign: 'center', paddingVertical: space.xl }}
        >
          {`Nothing matches “${query.trim()}”.`}
        </Text>
      ) : null}

      {pages.length > 0 ? (
        <Section testID="search-section-goto" title="Go to">
          {pages.map(({ item }) => (
            <List.Item
              key={item.tourId}
              testID={`search-goto-${item.tourId}`}
              title={item.label}
              left={(props) => <List.Icon {...props} icon={item.icon} />}
              onPress={() => go(item.href)}
            />
          ))}
        </Section>
      ) : null}

      {found.length > 0 || peopleLoading ? (
        <Section testID="search-section-people" title="People">
          {found.map((person) => (
            <List.Item
              key={person.id}
              testID={`search-person-${person.id}`}
              title={person.full_name}
              description={person.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
              accessibilityLabel={`${person.full_name}, ${person.roles.map((role) => USER_ROLE_LABELS[role]).join(', ')}`}
              left={(props) => <List.Icon {...props} icon="account-outline" />}
              onPress={() => go(personHref(person, isAdmin))}
            />
          ))}
          {found.length === 0 ? (
            <View testID="search-people-loading" style={{ padding: space.lg, alignItems: 'center' }}>
              <ActivityIndicator accessibilityLabel="Searching people" />
            </View>
          ) : null}
        </Section>
      ) : null}

      {shownActions.length > 0 ? (
        <Section testID="search-section-actions" title="Actions">
          {shownActions.map((action) => (
            <List.Item
              key={action.key}
              testID={action.testID}
              title={action.label}
              left={(props) => <List.Icon {...props} icon={action.icon} />}
              onPress={action.run}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
