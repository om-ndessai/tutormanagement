// Ported from apps/web/src/features/organizations/spaces-page.tsx @ f96b984 (the working tree's Phase 60; Phase 72's
// invitation line and "Just you" @ 98c40ab, working tree)
import { PLATFORM_BRAND, type Membership } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, List, Surface, Text, TouchableRipple } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { ListItem } from '@/components/list-item';
import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { useRefresh } from '@/hooks/use-refresh';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import { useAnswerInvitation, useLeaveSpace } from './api';
import { OrgAvatar } from './org-avatar';
import { SpaceWelcome } from './space-welcome';
import { invitedAsLine, membershipLine } from './spaces-model';

/** Into a space's Home, from the selector or from the Spaces screen pushed over a space. */
function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/dashboard');
}

/**
 * Phase 60 (S7, docs/spaces-plan.md): Spaces, the person's own console. Inside a space it is pushed
 * from the account sheet, under the header "Spaces"; with no space chosen it is the selector ("Choose
 * a space", or "Welcome to Aimtrue" with nowhere to go), full screen. Everything on it comes from the
 * person's own session (memberships, invitations, requests) -- no other read. `focusJoin` (Home's "Ask
 * again", UI audit JF5; the account sheet's Join with a code, JF7) opens it on Join with a code; `focusStart` (the
 * account sheet's and the (+)'s Start a space) on the new space's name.
 */
export function SpacesScreen({ focusJoin = false, focusStart = false }: { focusJoin?: boolean; focusStart?: boolean } = {}) {
  const { user, organization, memberships, invitations, platformAdmin, chooseOrganization, refreshSession, signOut } =
    useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const answer = useAnswerInvitation();
  const { refreshing, onRefresh } = useRefresh(() => refreshSession());

  const active = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');
  // Nowhere to go yet: the Welcome.
  const newcomer = memberships.length === 0 && invitations.length === 0;
  const framed = organization !== null;
  const title = framed ? 'Spaces' : newcomer ? `Welcome to ${PLATFORM_BRAND.name}` : 'Choose a space';

  async function respond(slug: string, name: string, accept: boolean) {
    try {
      await answer.mutateAsync({ slug, accept });
      if (accept) {
        // S6: accepting enters the space at once, and it becomes the last choice.
        toast.success(`You have joined ${name}.`);
        await chooseOrganization(slug);
        goHome();
        return;
      }
      await refreshSession();
      toast.success(`Invitation to ${name} declined.`);
      // On the selector, nothing pending may now leave one space: the landing rule enters it.
      if (!framed) router.replace('/');
    } catch {
      toast.error('That invitation could not be answered. Try again.');
    }
  }

  return (
    <Screen
      testID="screen-spaces"
      edges={framed ? ['bottom'] : ['top', 'bottom']}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {framed ? null : <LogoMark size={36} />}
        <View style={{ flex: 1, gap: 2 }}>
          {framed ? null : (
            <Text variant="headlineSmall" accessibilityRole="header" testID={newcomer ? 'welcome-title' : 'spaces-title'}>
              {title}
            </Text>
          )}
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="spaces-subtitle">
            {user ? `Signed in as ${user.email ?? user.full_name}. ` : ''}
            {newcomer
              ? 'Join a space with its code, or start your own.'
              : 'You land in the space you opened last. Each tab can be in a different one.'}
          </Text>
        </View>
      </View>

      {invitations.length > 0 ? (
        <View style={{ gap: space.sm }} accessibilityLabel="Invitations">
          <Text variant="labelLarge" accessibilityRole="header" style={{ color: theme.colors.onSurfaceVariant }}>
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
                  {/* The whole name, wrapped (UI audit JF12), and who invited them. */}
                  <Text variant="titleMedium">{invite.name}</Text>
                  <Text
                    testID={`invitation-line-${invite.slug}`}
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {invitedAsLine(invite)}
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

      {memberships.length > 0 ? (
        <View style={{ gap: space.sm }} accessibilityLabel="Your spaces">
          <Text variant="labelLarge" accessibilityRole="header" style={{ color: theme.colors.onSurfaceVariant }}>
            YOUR SPACES
          </Text>
          {active.map((org) => (
            <SpaceRow key={org.slug} org={org} current={org.slug === organization?.slug} />
          ))}
          {suspended.map((org) => (
            <SpaceRow key={org.slug} org={org} current={false} />
          ))}
        </View>
      ) : null}

      {platformAdmin ? (
        <Surface elevation={1} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <ListItem
            testID="spaces-platform-console"
            title="Platform console"
            description="Spaces and their admins"
            left={(props) => <List.Icon {...props} icon="shield-check-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              if (router.canDismiss()) router.dismissAll();
              router.push('/platform');
            }}
          />
        </Surface>
      ) : null}

      {/* Requests sent, Join with a code, Make a space -- and, belonging nowhere, Delete my account. */}
      <SpaceWelcome firstTime={memberships.length === 0} focusJoin={focusJoin} focusStart={focusStart} />

      {framed ? null : (
        <Button
          mode="text"
          onPress={() => void signOut()}
          testID="spaces-sign-out"
          style={{ alignSelf: 'flex-start' }}
        >
          Sign out
        </Button>
      )}
    </Screen>
  );
}

/** One of the person's spaces: Open, and Leave (S8) behind a confirmation. */
export function SpaceRow({ org, current }: { org: Membership; current: boolean }) {
  const { organization, chooseOrganization, refreshSession, reland } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const leave = useLeaveSpace();
  const [asking, setAsking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const suspended = org.status === 'suspended';
  // A space of one's own reads "Just you" (UI audit JF33): its roles say nothing there.
  const roles = membershipLine(org);

  async function open() {
    haptics.selection();
    // Even the space the app is in: choosing it opens it, so it becomes the last choice (S4, S7).
    setOpening(true);
    try {
      await chooseOrganization(org.slug);
      goHome();
    } catch {
      toast.error('That space could not be opened. Try again.');
    } finally {
      setOpening(false);
    }
  }

  async function confirmLeave() {
    setProblem(null);
    try {
      await leave.mutateAsync(org.slug);
      toast.success(`You have left ${org.name}.`);
      if (org.slug === organization?.slug) {
        // Leaving the space the app is in: the landing rule decides where to go next.
        if (router.canDismiss()) router.dismissAll();
        await reland().catch(() => undefined);
        router.replace('/');
        return;
      }
      setAsking(false);
      await refreshSession();
      // On the selector, one space left and nothing pending: the landing rule enters it.
      if (!organization) router.replace('/');
    } catch (caught) {
      haptics.error();
      const message = problemMessage(caught, 'Could not leave the space. Try again.');
      setProblem(message);
      toast.error(message);
    }
  }

  return (
    <Surface elevation={1} style={{ borderRadius: radius.lg, overflow: 'hidden' }} testID={`org-row-${org.slug}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {suspended ? (
          <View
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, opacity: 0.7 }}
            testID={`org-${org.slug}`}
          >
            <OrgAvatar org={org} />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium">{org.name}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Your access here is suspended.
              </Text>
            </View>
          </View>
        ) : (
          <TouchableRipple
            style={{ flex: 1 }}
            onPress={() => void open()}
            disabled={opening}
            testID={`org-${org.slug}`}
            accessibilityRole="button"
            accessibilityLabel={`Open ${org.name}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
              <OrgAvatar org={org} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Text variant="titleMedium" numberOfLines={1}>
                    {org.name}
                  </Text>
                  {current ? (
                    <Chip
                      compact
                      testID={`org-here-${org.slug}`}
                      textStyle={{ fontSize: 12, marginVertical: 0 }}
                      style={{ height: 24 }}
                    >
                      Here now
                    </Chip>
                  ) : null}
                </View>
                <Text testID={`org-roles-${org.slug}`} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {roles}
                </Text>
              </View>
              <List.Icon icon={opening ? 'dots-horizontal' : 'chevron-right'} color={theme.colors.onSurfaceVariant} />
            </View>
          </TouchableRipple>
        )}
        <IconButton
          icon="logout"
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => {
            haptics.selection();
            setProblem(null);
            setAsking((was) => !was);
          }}
          testID={`space-leave-${org.slug}`}
          accessibilityLabel={`Leave ${org.name}`}
          accessibilityState={{ expanded: asking }}
        />
      </View>
      {asking ? (
        <View
          style={{
            gap: space.sm,
            padding: space.lg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.outlineVariant,
          }}
          testID={`space-leave-confirm-${org.slug}`}
        >
          <Text variant="bodyMedium">{`You stop being a member of ${org.name}. Its records of you stay.`}</Text>
          {problem ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.error }}
              accessibilityRole="alert"
              testID={`space-leave-problem-${org.slug}`}
            >
              {problem}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              disabled={leave.isPending}
              loading={leave.isPending}
              onPress={() => void confirmLeave()}
              testID={`space-leave-yes-${org.slug}`}
            >
              {`Leave ${org.short_name}`}
            </Button>
            <Button mode="text" onPress={() => setAsking(false)} testID={`space-leave-stay-${org.slug}`}>
              Stay
            </Button>
          </View>
        </View>
      ) : null}
    </Surface>
  );
}
