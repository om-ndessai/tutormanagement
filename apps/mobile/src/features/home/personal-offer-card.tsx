// Ported from apps/web/src/features/home/personal-offer-card.tsx @ 758a19f (working tree, built beside this one)
//
// Phase 80 (A12, docs/members-plan.md; build-log entry 89): someone a platform admin placed in a space when approving
// them is OFFERED a space of their own rather than given one -- once, at the top of the home, until they make it or say
// no thanks. Either answer re-reads the session, which puts the card away; a made space is one tap away in the toast
// ("Open it"). "Make my own space" stays on Spaces for anyone who says no thanks now. In the look of `KeptForYou`.
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { useMakePersonalSpace } from '@/features/organizations/api';
import { showsPersonalOffer } from '@/features/organizations/space-model';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/** Into a space's Home. */
function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/dashboard');
}

export function PersonalOfferCard() {
  const { personalSpaceOffer, organization, refreshSession, chooseOrganization } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const answer = useMakePersonalSpace();
  if (!showsPersonalOffer(personalSpaceOffer, organization)) return null;

  async function respond(make: boolean) {
    haptics.selection();
    try {
      const result = (await answer.mutateAsync({ make })).data;
      await refreshSession();
      const slug = result.slug;
      if (result.made && slug) {
        toast.success('Your own space is ready.', {
          label: 'Open it',
          onPress: () => void chooseOrganization(slug).then(goHome),
        });
      }
    } catch (caught) {
      toast.error(problemMessage(caught, 'That could not be saved. Try again.'));
    }
  }

  const making = answer.isPending && answer.variables?.make === true;
  const declining = answer.isPending && answer.variables?.make === false;

  return (
    <OutlinedCard testID="home-personal-offer" style={{ borderRadius: radius.lg, borderColor: theme.colors.primary }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.md }}>
        <Icon source="home-outline" size={20} color={theme.colors.primary} />
        <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
          <Text variant="titleSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
            Want a space of your own too?
          </Text>
          <Text testID="home-personal-offer-text" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {organization ? `You're in ${organization.name}. ` : ''}A space of your own is for practising on your own, or
            with your family later.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginLeft: 'auto' }}>
          <Button
            testID="home-personal-offer-no"
            mode="text"
            compact
            disabled={answer.isPending}
            loading={declining}
            onPress={() => void respond(false)}
            contentStyle={{ minHeight: 44 }}
          >
            No thanks
          </Button>
          <Button
            testID="home-personal-offer-make"
            mode="contained"
            compact
            disabled={answer.isPending}
            loading={making}
            onPress={() => void respond(true)}
            contentStyle={{ minHeight: 44 }}
          >
            Make my space
          </Button>
        </View>
      </View>
    </OutlinedCard>
  );
}
