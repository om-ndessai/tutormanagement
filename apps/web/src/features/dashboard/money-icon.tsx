import { MinusIcon, PlusIcon, WalletIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A wallet carrying a plus or minus sign.
 *
 * Lucide has no wallet-with-sign glyph, so the sign is composed on top as a
 * small badge. It is drawn on the card's own background colour and with a
 * heavier stroke, so it punches out of the wallet outline instead of blending
 * into it at small sizes.
 *
 * `aria-hidden` throughout: these sit beside a label that already says which
 * figure it is, so announcing them would only repeat it.
 */
function WalletWithSign({
  sign,
  className,
}: {
  sign: 'plus' | 'minus';
  className?: string;
}) {
  const Sign = sign === 'plus' ? PlusIcon : MinusIcon;

  return (
    <span className={cn('relative inline-flex shrink-0', className)} aria-hidden>
      <WalletIcon className="size-full" />

      {/*
        A filled disc in the icon's own colour with the sign knocked out of it,
        rather than the sign on a card-coloured disc. The first version assumed
        the background behind it was the card, so on the tinted chip it showed
        as a pale blob; this version reads correctly on any background because
        it only ever uses currentColor and the card token for the cut-out.
      */}
      <span className="absolute -right-1 -bottom-1 flex size-[58%] items-center justify-center rounded-full bg-current">
        <Sign className="text-card size-[78%]" strokeWidth={4} />
      </span>
    </span>
  );
}

/** Money still to come in. */
export function WalletPlusIcon({ className }: { className?: string }) {
  return <WalletWithSign sign="plus" className={className} />;
}

/** Money still owed out. */
export function WalletMinusIcon({ className }: { className?: string }) {
  return <WalletWithSign sign="minus" className={className} />;
}
