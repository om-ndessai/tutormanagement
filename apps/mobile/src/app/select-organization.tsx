// Ported from apps/web/src/features/organizations/select-organization-page.tsx @ 1132322
import { USER_ROLE_LABELS } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, List, Surface, Text, TouchableRipple } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { useAnswerInvitation, useSetDefaultOrganization } from '@/features/organizations/api';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/**
 * Where someone who belongs to several organizations -- or has been invited to one -- chooses
 * where to go. The choice is remembered on this device for the next launch; a starred default
 * outranks it.
 */
export default function SelectOrganizationScreen() {
  const { user, memberships, invitations, platformAdmin, chooseOrganization, refreshSession, signOut } =
    useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const answer = useAnswerInvitation();
  const setDefault = useSetDefaultOrganization();
  const [entering, setEntering] = useState<string | null>(null);

  const active = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');

  async function enter(slug: string) {
    setEntering(slug);
    haptics.selection();
    try {
      await chooseOrganization(slug);
      router.replace('/dashboard');
    } catch {
      toast.error('That organization could not be opened. Try again.');
    } finally {
      setEntering(null);
    }
  }

  /** Where they land on signing in; pressing the current default clears it. */
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

  async function respond(slug: string, name: string, accept: boolean) {
    try {
      await answer.mutateAsync({ slug, accept });
      await refreshSession();
      toast.success(accept ? `You have joined ${name}.` : `Invitation to ${name} declined.`);
    } catch {
      toast.error('That invitation could not be answered. Try again.');
    }
  }

  return (
    <Screen testID="screen-select-organization" edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <LogoMark size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall" accessibilityRole="header">
            Choose an organization
          </Text>
          {user ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Signed in as {user.email ?? user.full_name}
            </Text>
          ) : null}
        </View>
      </View>

      {invitations.length > 0 ? (
        <View style={{ gap: space.sm }} accessibilityLabel="Invitations">
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            INVITATIONS
          </Text>
          {invitations.map((invite) => (
            <Surface
              key={invite.slug}
              elevation={1}
              style={{ borderRadius: radius.lg, padding: space.lg, gap: space.md }}
              testID={`invitation-${invite.slug}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <OrgAvatar org={invite} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium">{invite.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Invited as {invite.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ') || 'a member'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' }}>
                <Button
                  mode="text"
                  disabled={answer.isPending}
                  onPress={() => void respond(invite.slug, invite.name, false)}
                  testID={`invitation-decline-${invite.slug}`}
                >
                  Decline
                </Button>
                <Button
                  mode="contained"
                  icon="check"
                  disabled={answer.isPending}
                  onPress={() => void respond(invite.slug, invite.name, true)}
                  testID={`invitation-accept-${invite.slug}`}
                >
                  Accept
                </Button>
              </View>
            </Surface>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.sm }} accessibilityLabel="Your organizations">
        {active.map((org) => (
          <Surface key={org.slug} elevation={1} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableRipple
                style={{ flex: 1 }}
                onPress={() => void enter(org.slug)}
                disabled={entering !== null}
                testID={`org-${org.slug}`}
                accessibilityRole="button"
                accessibilityLabel={`Open ${org.name}`}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}
                >
                  <OrgAvatar org={org} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}
                    >
                      <Text variant="titleMedium" numberOfLines={1}>
                        {org.name}
                      </Text>
                      {org.is_default ? (
                        <Chip compact textStyle={{ fontSize: 11, marginVertical: 0 }} style={{ height: 24 }}>
                          Default
                        </Chip>
                      ) : null}
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {org.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
                    </Text>
                  </View>
                  <List.Icon
                    icon={entering === org.slug ? 'dots-horizontal' : 'chevron-right'}
                    color={theme.colors.onSurfaceVariant}
                  />
                </View>
              </TouchableRipple>
              {active.length > 1 ? (
                <IconButton
                  icon={org.is_default ? 'star' : 'star-outline'}
                  iconColor={org.is_default ? theme.colors.primary : theme.colors.onSurfaceVariant}
                  onPress={() => void toggleDefault(org.slug, org.name, org.is_default)}
                  disabled={setDefault.isPending}
                  testID={`org-default-${org.slug}`}
                  accessibilityState={{ selected: org.is_default }}
                  accessibilityLabel={
                    org.is_default
                      ? `Stop landing in ${org.name} on sign-in`
                      : `Land in ${org.name} on sign-in`
                  }
                />
              ) : null}
            </View>
          </Surface>
        ))}
        {active.length > 1 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Star one to land in it whenever you sign in.
          </Text>
        ) : null}

        {suspended.map((org) => (
          <View
            key={org.slug}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.lg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.outline,
              opacity: 0.7,
            }}
          >
            <OrgAvatar org={org} />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium">{org.name}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Your access here is suspended.
              </Text>
            </View>
          </View>
        ))}

        {platformAdmin ? (
          <Surface elevation={1} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <List.Item
              testID="select-platform-console"
              title="Platform console"
              description="Organizations and their admins"
              left={(props) => <List.Icon {...props} icon="shield-check-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/platform')}
            />
          </Surface>
        ) : null}

        {active.length === 0 && invitations.length === 0 && !platformAdmin ? (
          <Surface elevation={1} style={{ borderRadius: radius.lg, padding: space.lg }}>
            <Text variant="bodyMedium">
              You do not belong to any organization yet. Ask an administrator to add you.
            </Text>
          </Surface>
        ) : null}
      </View>

      <Button
        mode="text"
        onPress={() => void signOut()}
        testID="select-sign-out"
        style={{ alignSelf: 'flex-start' }}
      >
        Sign out
      </Button>
    </Screen>
  );
}
