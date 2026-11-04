// The web's user menu and space switcher, as one sheet (Phase 60: no star; "Spaces" opens the
// person's own console, apps/web/src/features/organizations/{org-switcher,spaces-page}.tsx).
import { tourOffered, USER_ROLE_LABELS } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

import { ListItem } from '@/components/list-item';
import { ReleasePhase } from '@/components/release-phase';
import { Screen } from '@/components/screen';
import { chooseHomeRole, useHomeRole } from '@/features/dashboard/home-role';
import { RoleSelector } from '@/features/dashboard/role-selector';
import { useOnboarding } from '@/features/onboarding/onboarding-provider';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { invitationsWaiting } from '@/features/organizations/spaces-model';
import { AppearanceControl } from '@/features/shell/appearance-control';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

export default function AccountSheet() {
  const {
    user,
    organization,
    memberships,
    invitations,
    platformAdmin,
    chooseOrganization,
    signOut,
  } = useAuth();
  const theme = useAppTheme();
  const { openWizard } = useOnboarding();
  const homeRole = useHomeRole();
  if (!user) return null;

  const others = memberships.filter((m) => m.status === 'active' && m.slug !== organization?.slug);
  const active = memberships.filter((m) => m.status === 'active');

  function openSpaces() {
    haptics.selection();
    router.dismissAll();
    router.push('/spaces');
  }

  async function switchTo(slug: string) {
    haptics.selection();
    router.dismissAll();
    await chooseOrganization(slug);
    router.replace('/dashboard');
  }

  return (
    <Screen testID="screen-account" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleLarge">{user.full_name}</Text>
        {user.email ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {user.email}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="account-roles">
          {user.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
          {organization ? ` at ${organization.short_name}` : ''}
        </Text>
      </View>

      {/* Which dashboard Home shows, for someone with several roles here (UI upgrades U6: the
          chips moved off Home, which now opens on the greeting and Today). */}
      {homeRole && homeRole.roles.length > 1 ? (
        <View testID="account-home-role" style={{ gap: space.xs }}>
          <List.Subheader style={{ paddingHorizontal: 0 }}>Home shows</List.Subheader>
          <RoleSelector roles={homeRole.roles} current={homeRole.current} onChoose={chooseHomeRole} />
        </View>
      ) : null}

      {organization ? (
        <View>
          <List.Subheader style={{ paddingHorizontal: 0 }}>Spaces</List.Subheader>
          {[organization.slug, ...others.map((o) => o.slug)].map((slug) => {
            const m = active.find((x) => x.slug === slug);
            if (!m) return null;
            const current = slug === organization.slug;
            return (
              <ListItem
                key={slug}
                testID={`account-org-${slug}`}
                title={m.name}
                description={current ? 'You are here' : m.roles.map((r) => USER_ROLE_LABELS[r]).join(' · ')}
                left={() => <OrgAvatar org={m} size={36} />}
                onPress={current ? undefined : () => void switchTo(slug)}
                style={{ paddingHorizontal: 0 }}
              />
            );
          })}
          {/* Phase 60 (S6, S7): invitations waiting, and the person's own console -- always. */}
          {invitations.length > 0 ? (
            <ListItem
              testID="account-invitations"
              title={invitationsWaiting(invitations.length)}
              left={(props) => <List.Icon {...props} icon="email-outline" />}
              onPress={openSpaces}
              style={{ paddingHorizontal: 0 }}
            />
          ) : null}
          <ListItem
            testID="account-spaces"
            title="All spaces"
            description="Invitations, codes, starting or leaving a space"
            left={(props) => <List.Icon {...props} icon="view-grid-outline" />}
            onPress={openSpaces}
            style={{ paddingHorizontal: 0 }}
          />
        </View>
      ) : null}

      <Divider />
      <AppearanceControl />
      <Divider />

      <View>
        <ListItem
          testID="account-profile"
          title="My profile"
          left={(props) => <List.Icon {...props} icon="account-outline" />}
          onPress={() => {
            router.back();
            router.push('/profile');
          }}
          style={{ paddingHorizontal: 0 }}
        />
        {/* Owner, 2026-11-04: the tour is Tutoring's (`tourOffered`), as the web's Getting started. */}
        {tourOffered(organization) ? (
          <ListItem
            testID="account-tour"
            title="Take the tour"
            left={(props) => <List.Icon {...props} icon="compass-outline" />}
            onPress={() => {
              haptics.selection();
              router.back();
              openWizard();
            }}
            style={{ paddingHorizontal: 0 }}
          />
        ) : null}
        {platformAdmin ? (
          <ListItem
            testID="account-platform"
            title="Platform console"
            left={(props) => <List.Icon {...props} icon="shield-check-outline" />}
            onPress={() => {
              router.dismissAll();
              router.push('/platform');
            }}
            style={{ paddingHorizontal: 0 }}
          />
        ) : null}
        <ListItem
          testID="account-sign-out"
          title="Sign out"
          left={(props) => <List.Icon {...props} icon="logout" />}
          onPress={() => {
            router.dismissAll();
            void signOut();
          }}
          style={{ paddingHorizontal: 0 }}
        />
      </View>
      <ReleasePhase />
    </Screen>
  );
}
