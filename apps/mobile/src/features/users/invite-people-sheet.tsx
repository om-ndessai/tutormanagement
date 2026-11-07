// Phase 76 (JF21, JF37): "Invite by email" from the one Add chooser -- the welcome wizard's InvitePeople (rows of email
// and role, each the ordinary add-person request, status invited) in a sheet, at any time, for the space's adult
// admins (`mayAddPeople`, as the API). Each invitation is shared by hand, with what the space is for.
// Phase 79 (M3; the web's add-person.tsx @ 758a19f, working tree): titled with the chooser's own words ("Anyone, by
// email"), and they join as a member unless a role is chosen.
import { addChoices, mayAddPeople } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/state-views';
import { InvitePeople } from '@/features/organizations/invite-people';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { ADD_CHOOSER_LOCKED } from './add-person-model';

/** The chooser's own words for this choice (shared `addChoices`, "Anyone, by email"). */
export const INVITE_TITLE =
  addChoices({ tutoring: false, personal: false, mayAdd: true }).find((choice) => choice.id === 'invite')?.label ??
  'Anyone, by email';

function close() {
  if (router.canGoBack()) router.back();
}

export function InvitePeopleSheet() {
  const theme = useAppTheme();
  const { user, account } = useAuth();
  const may = user ? mayAddPeople({ roles: user.roles, account }) : false;
  return (
    <Screen testID="screen-invite-people" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {may ? (
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <Text testID="invite-people-title" variant="titleLarge" accessibilityRole="header">
              {INVITE_TITLE}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              They join as a member when they sign in with that address, unless you choose a role. No email is sent
              from here: share each invitation.
            </Text>
          </View>
          <InvitePeople onDone={close} doneLabel="Done" />
        </View>
      ) : (
        <EmptyState icon="lock-outline" title={ADD_CHOOSER_LOCKED} />
      )}
    </Screen>
  );
}
