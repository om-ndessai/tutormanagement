import { ORG_PALETTE_HEX, type OrganizationBrand } from '@tmi/shared';

import { cn } from '@/lib/utils';

/**
 * An organization's mark in a list: its uploaded logo, the institute's own
 * artwork for the one organization that wears it, or its initials on its
 * palette colour. Never another organization's look.
 */
export function OrgAvatar({ org, className }: { org: OrganizationBrand; className?: string }) {
  const src = org.logo_mark_url ?? (org.builtin_logo === 'institute' ? '/logo-mark.png' : null);

  if (src) {
    return (
      <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-black/5', className)}>
        <img src={src} alt="" aria-hidden className="size-full object-contain" />
      </span>
    );
  }

  const initials = org.short_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      aria-hidden
      // The palette's own colour, as data: the list shows several
      // organizations at once, so the page's tokens cannot stand in for each.
      style={{ backgroundColor: ORG_PALETTE_HEX[org.palette] }}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white',
        className,
      )}
    >
      {initials}
    </span>
  );
}
