// UI audit (JF5; docs/journey-fixes-plan.md, Phase 71; owner, 2026-11-04: "stay until dismissed"): the
// person's own requests to join a space and the spaces' answers, from their session (`join_requests`) and
// nothing else, in the web's words (apps/web/src/features/organizations/request-outcomes.tsx, working tree).
// Waiting -- "Asked to join <space> · waiting for its admins.", Withdraw. Let in -- "You're in <space>.", Open
// (enters it, as Spaces does) and a dismiss. Declined -- "<space> did not let you in.", the day it answered,
// Ask again (Spaces' Join with a code) and a dismiss. An answer stays until it is dismissed
// (POST /spaces/join-requests/:slug/dismiss); viewing or opening it marks nothing.
//
// `YourRequestsCard` is the member home's card, above Next up, in every space; `RequestAnswerRow` is one answer,
// also on Spaces (`prefix="welcome"`).
import type { MyJoinRequest } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

import { useDismissJoinOutcome, useWithdrawRequest } from './api';
import { OrgAvatar } from './org-avatar';
import { declinedOnLine, requestLine } from './space-model';

/** Into a space's Home, from wherever the answer was read. */
function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/dashboard');
}

/** Spaces' Join with a code, opened on its code field. */
export function openJoinWithCode() {
  router.push({ pathname: '/spaces', params: { join: '1' } });
}

/** The home's card: every request the session lists, waiting or answered. Nothing when there are none. */
export function YourRequestsCard() {
  const { joinRequests } = useAuth();
  const toast = useToast();
  // Held here: withdrawing refreshes the session, which unmounts the row before its own callbacks run.
  const withdraw = useWithdrawRequest();
  if (joinRequests.length === 0) return null;

  async function withdrawFrom(request: MyJoinRequest) {
    haptics.selection();
    try {
      await withdraw.mutateAsync(request.slug);
      toast.success(`Request to ${request.name} withdrawn.`);
    } catch (caught) {
      toast.error(problemMessage(caught, 'Could not withdraw the request.'));
    }
  }

  return (
    <OutlinedCard
      testID="home-requests"
      accessibilityLabel="Your requests"
      style={{ borderRadius: radius.lg }}
    >
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="titleMedium" accessibilityRole="header">
          Your requests
        </Text>
        {joinRequests.map((request) =>
          request.outcome === null ? (
            <View
              key={request.slug}
              testID={`home-request-${request.slug}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}
            >
              <OrgAvatar org={request} size={36} />
              <Text variant="bodyMedium" style={{ flex: 1, minWidth: 160 }}>
                {requestLine(request)}
              </Text>
              <Button
                testID={`home-request-withdraw-${request.slug}`}
                mode="text"
                compact
                disabled={withdraw.isPending}
                contentStyle={{ minHeight: MIN_TARGET }}
                accessibilityLabel={`Withdraw the request to ${request.name}`}
                onPress={() => void withdrawFrom(request)}
              >
                Withdraw
              </Button>
            </View>
          ) : (
            <RequestAnswerRow
              key={request.slug}
              request={request}
              prefix="home-request"
              onAskAgain={openJoinWithCode}
            />
          ),
        )}
      </View>
    </OutlinedCard>
  );
}

/**
 * One space's answer: let in (Open) or declined (the day, Ask again), each with a dismiss. On Home the ids
 * are `home-request-<part>-<slug>`; on Spaces the row is `welcome-<outcome>-<slug>` and its parts
 * `welcome-<part>-<slug>`.
 */
export function RequestAnswerRow({
  request,
  prefix,
  onAskAgain,
}: {
  request: MyJoinRequest;
  prefix: 'home-request' | 'welcome';
  onAskAgain: () => void;
}) {
  const { chooseOrganization } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const dismiss = useDismissJoinOutcome();
  const [opening, setOpening] = useState(false);
  const approved = request.outcome === 'approved';
  const rowId =
    prefix === 'home-request' ? `home-request-${request.slug}` : `welcome-${request.outcome}-${request.slug}`;
  const when = approved ? null : declinedOnLine(request.answered_at, timeZone);

  async function dismissIt() {
    haptics.selection();
    try {
      await dismiss.mutateAsync(request.slug);
    } catch (caught) {
      toast.error(problemMessage(caught, 'Could not dismiss it. Try again.'));
    }
  }

  async function open() {
    haptics.selection();
    setOpening(true);
    try {
      // The space opens (and becomes the last choice); the answer stays until it is dismissed, as the web's.
      await chooseOrganization(request.slug);
      goHome();
    } catch {
      toast.error('That space could not be opened. Try again.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <View
      testID={rowId}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: theme.tokens.muted,
      }}
    >
      <OrgAvatar org={request} size={36} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
          {requestLine(request)}
        </Text>
        {when ? (
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {when}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {approved ? (
            <Button
              testID={`${prefix}-open-${request.slug}`}
              mode="contained-tonal"
              compact
              icon="arrow-right"
              loading={opening}
              disabled={opening}
              contentStyle={{ minHeight: MIN_TARGET }}
              accessibilityLabel={`Open ${request.name}`}
              onPress={() => void open()}
            >
              Open
            </Button>
          ) : (
            <Button
              testID={`${prefix}-ask-again-${request.slug}`}
              mode="outlined"
              compact
              icon="key-outline"
              contentStyle={{ minHeight: MIN_TARGET }}
              accessibilityLabel={`Ask ${request.name} again`}
              onPress={() => {
                haptics.selection();
                onAskAgain();
              }}
            >
              Ask again
            </Button>
          )}
        </View>
      </View>
      <IconButton
        testID={`${prefix}-dismiss-${request.slug}`}
        icon="close"
        size={20}
        iconColor={theme.tokens.mutedForeground}
        disabled={dismiss.isPending || opening}
        accessibilityLabel="Dismiss"
        onPress={() => void dismissIt()}
      />
    </View>
  );
}
