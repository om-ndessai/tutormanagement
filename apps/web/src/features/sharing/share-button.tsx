import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CopyIcon, DownloadIcon, Share2Icon } from 'lucide-react';
import {
  PLATFORM_BRAND,
  SHARE_TARGETS,
  SHARE_TARGET_LABELS,
  shareTargetUrl,
  shareText,
  shareUrl,
  type CreateShareInput,
  type Share,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useCreateShare, useWithdrawShare } from './api';
import { drawShareCard } from './card-image';

/**
 * Phase 56 (docs/sharing-plan.md, R22): Share. Makes a public link to a card
 * the server builds from the reader's own result, then offers the system share
 * sheet (with the picture, where the browser can), the picture to download,
 * the text to copy, and direct links. No captions, no other names; the maker
 * may show their first name if they are an adult, and may withdraw the link.
 *
 * Shown only to someone who may share: 13 or over -- a student a space added
 * (a child) never sees it, and the API refuses them anyway.
 */
export function ShareButton({
  input,
  label = 'Share',
  size = 'sm',
  testId,
}: {
  input: CreateShareInput;
  label?: string;
  size?: 'sm' | 'default';
  testId?: string;
}) {
  const { user, account } = useAuth();
  const [open, setOpen] = useState(false);
  const child = Boolean(user?.roles.includes('student')) && !account;
  if (!user || child) return null;
  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)} data-testid={testId ?? 'share-button'}>
        <Share2Icon />
        {label}
      </Button>
      <ShareDialog open={open} onOpenChange={setOpen} input={input} />
    </>
  );
}

function ShareDialog({
  open,
  onOpenChange,
  input,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: CreateShareInput;
}) {
  const { user, account } = useAuth();
  const create = useCreateShare();
  const withdraw = useWithdrawShare();
  const [showName, setShowName] = useState(false);
  const [share, setShare] = useState<Share | null>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  // An adult may show their own first name; a 13-17-year-old may not.
  const adult = account ? account.age_band === 'adult' : !user?.roles.includes('student');

  useEffect(() => {
    if (!open) {
      setShare(null);
      setShowName(false);
    }
  }, [open]);

  useEffect(() => {
    let url: string | null = null;
    if (!share) {
      setImage(null);
      return;
    }
    void drawShareCard(share.card, share.first_name, PLATFORM_BRAND.short).then((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setImage({ blob, url });
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [share]);

  const link = share ? shareUrl(window.location.origin, share.id) : '';
  const text = share ? shareText(share, link, PLATFORM_BRAND.short) : '';

  async function make() {
    try {
      const made = await create.mutateAsync({ ...input, show_first_name: adult && showName });
      setShare(made.data);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not make the link.');
    }
  }

  async function systemShare() {
    const file = image ? new File([image.blob], 'aimtrue-quest.png', { type: 'image/png' }) : null;
    const data: ShareData = { text, url: link };
    try {
      if (file && navigator.canShare?.({ ...data, files: [file] })) await navigator.share({ ...data, files: [file] });
      else if (navigator.share) await navigator.share(data);
      else await copy();
    } catch {
      // The person closed the sheet: nothing to say.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied.');
    } catch {
      toast.error('Could not copy. Select the text instead.');
    }
  }

  async function takeBack() {
    if (!share) return;
    await withdraw.mutateAsync(share.id);
    toast.success('Withdrawn: the link now says it is no longer available.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            A link anyone can open, with the numbers and nothing else: no other player’s name, no
            space’s name. You can withdraw it any time; it expires after a year.
          </DialogDescription>
        </DialogHeader>
        {/* R22: the platform's name on the card and text, never the space's. */}

        {!share ? (
          <div className="grid gap-4 py-2">
            {adult && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={showName}
                  onChange={(event) => setShowName(event.target.checked)}
                  data-testid="share-show-name"
                />
                Show my first name
              </label>
            )}
            <DialogFooter>
              <Button onClick={() => void make()} disabled={create.isPending} data-testid="share-make">
                Make the link
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            {image && <img src={image.url} alt="The card" className="w-full rounded-lg border" data-testid="share-image" />}
            <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap" data-testid="share-text">
              {text}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void systemShare()} data-testid="share-system">
                <Share2Icon />
                Share…
              </Button>
              {image && (
                <Button variant="outline" asChild>
                  <a href={image.url} download="aimtrue-quest.png">
                    <DownloadIcon />
                    Picture
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={() => void copy()} data-testid="share-copy">
                <CopyIcon />
                Copy text
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {SHARE_TARGETS.map((target) => (
                <a
                  key={target}
                  href={shareTargetUrl(target, link, text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground underline"
                >
                  {SHARE_TARGET_LABELS[target]}
                </a>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => void takeBack()} data-testid="share-withdraw">
                Withdraw the link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
