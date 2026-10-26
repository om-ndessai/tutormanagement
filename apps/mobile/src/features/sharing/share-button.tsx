// Ported from apps/web/src/features/sharing/share-button.tsx @ 3279506
//
// Mobile differences (design 65): the card and the text name the platform (`PLATFORM_BRAND.short`), never the
// space's short name (R22: no space's name on a public page). The system share sheet carries the text and the link (`Share.share`),
// and Picture hands the card, captured by react-native-view-shot, to the share sheet as a PNG that is
// deleted once the sheet closes. No Copy text and no direct X/Facebook/… links: the share sheet offers
// Copy and every installed app. Confirmations are said in Quest's own frame (`useQuestNotice`): the
// buttons live in Quest's full-screen modals, which cover the app's toast on iOS.
import { PLATFORM_BRAND, type CreateShareInput, type Share as ShareRow } from '@tmi/shared';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { captureRef } from 'react-native-view-shot';

import { CheckRow } from '@/components/check-row';
import { useQuestNotice } from '@/features/quest/quest-notice';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useCreateShare, useWithdrawShare } from './api';
import { ShareCardView } from './share-card-view';
import { mayShowName, shareAllowed, shareLinkAndText } from './share-model';

/**
 * Phase 56 (docs/sharing-plan.md, R22): Share. Makes a public link to a card the server builds from
 * the reader's own result, then offers the system share sheet, the picture, and Withdraw. No captions,
 * no other names; an adult may show their first name. Hidden for a child a space added.
 */
export function ShareButton({
  input,
  label = 'Share',
  testID = 'share-button',
  compact = false,
}: {
  input: CreateShareInput;
  label?: string;
  testID?: string;
  compact?: boolean;
}) {
  const { user, account } = useAuth();
  const [open, setOpen] = useState(false);
  if (!shareAllowed(user, account)) return null;
  return (
    <>
      <Button
        testID={testID}
        mode="outlined"
        icon="share-variant"
        compact={compact}
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        contentStyle={{ minHeight: compact ? 44 : 48 }}
      >
        {label}
      </Button>
      {open ? <ShareDialog input={input} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ShareDialog({ input, onClose }: { input: CreateShareInput; onClose: () => void }) {
  const { user, account } = useAuth();
  // R22: no space's name on a public card -- the platform's name, never the space's short name.
  const brand = PLATFORM_BRAND.short;
  const { height } = useWindowDimensions();
  const theme = useAppTheme();
  const notice = useQuestNotice();
  const create = useCreateShare();
  const withdraw = useWithdrawShare();
  const [showName, setShowName] = useState(false);
  const [share, setShare] = useState<ShareRow | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const cardRef = useRef<View>(null);
  const adult = mayShowName(user, account);
  const { link, text } = share ? shareLinkAndText(share, serverOrigin(), brand) : { link: '', text: '' };

  async function make() {
    setRefusal(null);
    try {
      const made = await create.mutateAsync({ ...input, show_first_name: adult && showName });
      haptics.success();
      setShare(made.data);
    } catch (caught) {
      haptics.error();
      setRefusal(caught instanceof ApiRequestError ? caught.message : 'Could not make the link.');
    }
  }

  async function systemShare() {
    try {
      // The text ends with the link; iOS also takes the link as a URL of its own.
      await Share.share({ message: text, url: link });
    } catch {
      // The person closed the sheet: nothing to say.
    }
  }

  async function sharePicture() {
    let file: File | null = null;
    try {
      // A PNG in the cache (view-shot's temporary file), handed to the share sheet.
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1200 });
      file = new File(uri);
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share' });
    } catch {
      setRefusal('Could not make the picture.');
    } finally {
      // Nothing is left on the phone once the sheet closes.
      if (file?.exists) file.delete();
    }
  }

  async function takeBack() {
    if (!share) return;
    try {
      await withdraw.mutateAsync(share.id);
      notice.success('Withdrawn: the link now says it is no longer available.');
      onClose();
    } catch (caught) {
      setRefusal(caught instanceof ApiRequestError ? caught.message : 'Could not withdraw it.');
    }
  }

  return (
    <Portal>
      <Dialog visible onDismiss={onClose} testID="share-dialog">
        <Dialog.Title>Share</Dialog.Title>
        <View style={{ maxHeight: height * 0.6 }}>
          <ScrollView contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.sm }}>
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              A link anyone can open, with the numbers and nothing else: no other player’s name, no space’s
              name. You can withdraw it any time; it expires after a year.
            </Text>
            {!share ? (
              adult ? (
                <CheckRow
                  testID="share-show-name"
                  label="Show my first name"
                  checked={showName}
                  onChange={(checked) => {
                    haptics.selection();
                    setShowName(checked);
                  }}
                />
              ) : null
            ) : (
              <>
                <ShareCardView ref={cardRef} card={share.card} firstName={share.first_name} brand={brand} />
                <View
                  style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: radius.md, padding: space.md }}
                >
                  <Text testID="share-text" variant="bodySmall" selectable>
                    {text}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Button
                    testID="share-system"
                    mode="contained"
                    icon="share-variant"
                    onPress={() => void systemShare()}
                    contentStyle={{ minHeight: 44 }}
                  >
                    Share…
                  </Button>
                  <Button
                    testID="share-picture"
                    mode="outlined"
                    icon="image-outline"
                    onPress={() => void sharePicture()}
                    contentStyle={{ minHeight: 44 }}
                  >
                    Picture
                  </Button>
                </View>
              </>
            )}
            {refusal ? (
              <Text testID="share-error" variant="bodySmall" style={{ color: theme.colors.error }}>
                {refusal}
              </Text>
            ) : null}
          </ScrollView>
        </View>
        {/* Dialog.Actions hands each direct child its props, so no fragments here. */}
        {!share ? (
          <Dialog.Actions>
            <Button testID="share-cancel" onPress={onClose}>
              Cancel
            </Button>
            <Button
              testID="share-make"
              mode="contained"
              onPress={() => void make()}
              loading={create.isPending}
              disabled={create.isPending}
            >
              Make the link
            </Button>
          </Dialog.Actions>
        ) : (
          <Dialog.Actions>
            <Button testID="share-withdraw" onPress={() => void takeBack()} disabled={withdraw.isPending}>
              Withdraw the link
            </Button>
            <Button testID="share-done" onPress={onClose}>
              Done
            </Button>
          </Dialog.Actions>
        )}
      </Dialog>
    </Portal>
  );
}
