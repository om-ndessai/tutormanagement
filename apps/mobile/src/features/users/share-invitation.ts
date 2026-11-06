// Phase 76 (JF37): an invitation, told by hand. A self-serve space sends no email, and anyone invited accepts at
// sign-in, so every invited row on People -- and each row InvitePeople sends -- hands over the same words, shared
// `invitationText` with the space's sets ("…, a space for practice and assessments. Open <address>/spaces and sign in
// with Google using ana@example.com: your invitation is waiting there."). The app has no clipboard module: the
// system share sheet offers Copy on both systems, and a confirmation says it went.
import { invitationText, type FeatureState } from '@tmi/shared';
import { useCallback } from 'react';
import { Share } from 'react-native';

import { useToast } from '@/components/toast';
import { invitationAddress } from '@/features/organizations/space-model';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';

/** What the confirmation says once the share sheet has sent (or copied) it. */
export const INVITATION_SHARED = 'Invitation shared.';

/** The words for one invited address, from the reader, the space and where it waits. */
export function invitationMessage(input: {
  inviter: string | null | undefined;
  space: string | null | undefined;
  origin: string | null | undefined;
  email: string;
  org: Partial<FeatureState> | null | undefined;
}): string {
  return invitationText({
    inviter: input.inviter || 'Someone',
    space: input.space || 'a space',
    // The link opens on the invitation (the person's Spaces page), not on the guest game page (UI audit JF12).
    address: invitationAddress(input.origin),
    email: input.email,
    org: input.org,
  });
}

/** The invitation's words for an address here, and a share of them with the confirmation. */
export function useShareInvitation() {
  const { user, organization } = useAuth();
  const toast = useToast();
  const textFor = useCallback(
    (email: string) =>
      invitationMessage({
        inviter: user?.full_name,
        space: organization?.name,
        origin: serverOrigin(),
        email,
        org: organization,
      }),
    [organization, user?.full_name],
  );
  const share = useCallback(
    async (email: string) => {
      try {
        const result = await Share.share({ message: textFor(email) });
        // A sheet closed without sending says nothing (iOS tells; Android always reports it sent).
        if (result.action === Share.sharedAction) toast.success(INVITATION_SHARED);
      } catch {
        toast.error('Could not open the share sheet.');
      }
    },
    [textFor, toast],
  );
  return { textFor, share };
}
