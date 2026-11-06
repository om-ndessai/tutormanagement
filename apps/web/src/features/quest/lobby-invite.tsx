import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Share2Icon } from 'lucide-react';
import { PLATFORM_BRAND } from '@tmi/shared';

import { Button } from '@/components/ui/button';

/** Where a game code leads: the Play home, with the code filled in (`?code=`). */
export function gameInviteUrl(code: string): string {
  return `${window.location.origin}/?code=${encodeURIComponent(code)}`;
}

/**
 * Phase 62 (P7): the lobby's invitation -- a QR code a phone across the table can scan, and Share
 * (the system's share sheet, else a copy). It names nobody: the code and a link.
 */
export function LobbyInvite({ code, title }: { code: string; title: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = gameInviteUrl(code);
  // Phase 78 (JF32): the quest in words, and "game code" for the code.
  const text = `Join my ${title} quest on ${PLATFORM_BRAND.name}: game code ${code}`;

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(url, { margin: 1, width: 192 }).then(
      (data) => live && setQr(data),
      () => live && setQr(null),
    );
    return () => {
      live = false;
    };
  }, [url]);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success('The invitation is copied.');
    } catch {
      // Dismissed: nothing to say.
    }
  }

  return (
    <div className="flex items-center gap-4" data-testid="game-lobby-invite">
      {qr && <img src={qr} alt={`QR code for game code ${code}`} className="size-24 rounded-md border bg-white p-1" data-testid="game-lobby-qr" />}
      <Button variant="outline" onClick={() => void share()} data-testid="game-lobby-share">
        <Share2Icon /> Share
      </Button>
    </div>
  );
}
