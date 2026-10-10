// The web's user menu and organization switcher, as one sheet.
import { USER_ROLE_LABELS } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Divider, IconButton, List, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { useSetDefaultOrganization } from '@/features/organizations/api';
import { useOnboarding } from '@/features/onboarding/onboarding-provider';
import { OrgAvatar } from '@/features/organizations/org-avatar';
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
    leaveOrganization,
    signOut,
  } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const setDefault = useSetDefaultOrganization();
  const { openWizard } = useOnboarding();
  if (!user) return null;

  const others = memberships.filter((m) => m.status === 'active' && m.slug !== organization?.slug);
  const active = memberships.filter((m) => m.status === 'active');

  async function switchTo(slug: string) {
    haptics.selection();
    router.dismissAll();
    await chooseOrganization(slug);
    router.replace('/dashboard');
  }

  async function toggleDefault(slug: string, name: string, isDefault: boolean) {
    haptics.selection();
    try {
      await setDefault.mutateAsync(isDefault ? null : slug);
      toast.success(
        isDefault
          ? 'You will choose where to go when you sign in.'
          : `You will land in ${name} when you sign in.`,
      );
    } catch {
      toast.error('Your default organization could not be changed. Try again.');
    }
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

      {organization && active.length > 0 ? (
        <View>
          <List.Subheader style={{ paddingHorizontal: 0 }}>Organizations</List.Subheader>
          {[organization.slug, ...others.map((o) => o.slug)].map((slug) => {
            const m = active.find((x) => x.slug === slug);
            if (!m) return null;
            const current = slug === organization.slug;
            return (
              <List.Item
                key={slug}
                testID={`account-org-${slug}`}
                title={m.name}
                description={current ? 'You are here' : m.roles.map((r) => USER_ROLE_LABELS[r]).join(' · ')}
                left={() => <OrgAvatar org={m} size={36} />}
                onPress={current ? undefined : () => void switchTo(slug)}
                right={() =>
                  active.length > 1 ? (
                    <IconButton
                      icon={m.is_default ? 'star' : 'star-outline'}
                      iconColor={m.is_default ? theme.colors.primary : theme.colors.onSurfaceVariant}
                      onPress={() => void toggleDefault(slug, m.name, m.is_default)}
                      testID={`account-default-${slug}`}
                      accessibilityLabel={
                        m.is_default ? `Stop landing in ${m.name} on sign-in` : `Land in ${m.name} on sign-in`
                      }
                    />
                  ) : null
                }
                style={{ paddingHorizontal: 0 }}
              />
            );
          })}
          {invitations.length > 0 || others.length > 0 ? (
            <List.Item
              testID="account-all-organizations"
              title="All organizations…"
              left={(props) => <List.Icon {...props} icon="swap-horizontal" />}
              onPress={() => {
                router.dismissAll();
                leaveOrganization();
                router.replace('/select-organization');
              }}
              style={{ paddingHorizontal: 0 }}
            />
          ) : null}
        </View>
      ) : null}

      <Divider />
      <AppearanceControl />
      <Divider />

      <View>
        <List.Item
          testID="account-profile"
          title="My profile"
          left={(props) => <List.Icon {...props} icon="account-outline" />}
          onPress={() => {
            router.back();
            router.push('/profile');
          }}
          style={{ paddingHorizontal: 0 }}
        />
        <List.Item
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
        {platformAdmin ? (
          <List.Item
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
        <List.Item
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
    </Screen>
  );
}
