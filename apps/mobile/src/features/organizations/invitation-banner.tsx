// Ported from apps/web/src/features/organizations/invitation-banner.tsx @ f96b984 (the working tree's Phase 60)
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useToast } from '@/components/toast';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

import { useAnswerInvitation } from './api';
import { dismissInvitationBanner, invitationBannerDismissed } from './spaces-model';

/**
 * Phase 60 (S6): someone inside a space who has been invited to another sees it on Home --
 * "<space> invited you", Accept (which enters it) and Not now (hidden for this app session). The
 * invitation comes from their own session; nothing else is read.
 */
export function InvitationBanner() {
  const { invitations, chooseOrganization } = useAuth();
  const answer = useAnswerInvitation();
  const toast = useToast();
  const theme = useAppTheme();
  const [dismissed, setDismissed] = useState(invitationBannerDismissed);

  const invite = invitations[0];
  if (!invite || dismissed) return null;
  const more = invitations.length - 1;

  function notNow() {
    haptics.selection();
    dismissInvitationBanner();
    setDismissed(true);
  }

  async function accept() {
    if (!invite) return;
    try {
      await answer.mutateAsync({ slug: invite.slug, accept: true });
      toast.success(`You have joined ${invite.name}.`);
      await chooseOrganization(invite.slug);
      if (router.canDismiss()) router.dismissAll();
      router.replace('/dashboard');
    } catch {
      toast.error('That invitation could not be answered. Try again.');
    }
  }

  return (
    <View
      testID="invitation-banner"
      accessibilityLabel="Invitation"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primaryContainer,
      }}
    >
      <Icon source="email-outline" size={20} color={theme.colors.onPrimaryContainer} />
      <View style={{ flex: 1, minWidth: 160 }}>
        <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }} testID="invitation-banner-text">
          {`${invite.name} invited you`}
        </Text>
        {more > 0 ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onPrimaryContainer, textDecorationLine: 'underline' }}
            onPress={() => router.push('/spaces')}
            accessibilityRole="link"
            testID="invitation-banner-more"
          >
            {`and ${more} more`}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          mode="contained"
          compact
          disabled={answer.isPending}
          loading={answer.isPending}
          onPress={() => void accept()}
          testID="invitation-banner-accept"
        >
          Accept
        </Button>
        <Button mode="text" compact onPress={notNow} textColor={theme.colors.onPrimaryContainer} testID="invitation-banner-not-now">
          Not now
        </Button>
      </View>
    </View>
  );
}
