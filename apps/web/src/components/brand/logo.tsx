import { cn } from '@/lib/utils';
import { useBrand, useBrandReady } from '@/providers/brand-provider';

/**
 * The institute's own artwork, shipped in `public/`. Only an organization a
 * platform admin has given `builtin_logo: 'institute'` wears it.
 */
const LOGO_MARK_SRC = '/logo-mark.png';
const LOGO_FULL_SRC = '/logo-full.png';

/**
 * The drawn mark, for an organization with no logo of its own and for the
 * platform itself: pi over a rule, inside a tile that takes its colour from
 * the palette rather than from literals, so it follows dark mode for free.
 */
function MathMark({ className, bare = false }: { className?: string; bare?: boolean }) {
  // On a coloured panel the tile has nothing to sit against, so the glyph goes
  // on alone in white -- the institute's raster mark gets knocked out to white
  // for the same reason, and neither is achievable with the other's technique.
  if (bare) {
    return (
      <svg
        viewBox="0 0 48 48"
        role="img"
        aria-hidden
        className={cn('size-9 select-none', className)}
      >
        <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
          <path d="M11 17h26" />
          <path d="M19 17v17" />
          <path d="M30 17v12c0 3 1.6 5 4 5" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-hidden
      className={cn('size-9 select-none', className)}
    >
      <defs>
        <linearGradient id="chmi-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-500)" />
          <stop offset="100%" stopColor="var(--brand-800)" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#chmi-tile)" />

      {/* pi: a bar over two legs, the right one kicked out like the glyph. */}
      <g
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3.4"
        strokeLinecap="round"
      >
        <path d="M13 18h22" />
        <path d="M20 18v14" />
        <path d="M29 18v10c0 2.6 1.4 4 3.6 4" />
        {/* The rule underneath: a ratio has a line in it. */}
        <path d="M15 39h18" opacity="0.55" />
      </g>
    </svg>
  );
}

/**
 * Holds the space without claiming an identity, while the deployment is still
 * saying which one it has.
 */
function MarkPlaceholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('bg-muted/60 inline-block size-9 shrink-0 rounded-xl', className)}
    />
  );
}

export function LogoMark({
  className,
  /**
   * Rendered on a coloured panel. Each brand reaches white its own way, and
   * the caller should not have to know which: the institute's raster mark is
   * knocked out with a filter, the drawn mark simply inherits the colour.
   */
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const brand = useBrand();
  const ready = useBrandReady();

  if (!ready) return <MarkPlaceholder className={className} />;

  const src = brand.logo_mark_url ?? (brand.builtin_logo === 'institute' ? LOGO_MARK_SRC : null);
  if (!src) {
    return <MathMark className={className} bare={onDark} />;
  }

  // On a coloured panel the institute's transparent artwork is knocked out to
  // white. An uploaded logo may well be opaque -- knocking it out would leave a
  // white block -- so it sits on a light chip instead.
  if (onDark && brand.logo_mark_url) {
    return (
      <span className={cn('inline-flex size-9 items-center justify-center rounded-xl bg-white p-1', className)}>
        <img src={src} alt="" aria-hidden className="size-full select-none object-contain" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={cn(
        'size-9 select-none object-contain',
        onDark && 'brightness-0 invert drop-shadow-sm',
        className,
      )}
    />
  );
}

export function LogoFull({ className }: { className?: string }) {
  const brand = useBrand();
  const ready = useBrandReady();

  if (!ready) return <MarkPlaceholder className={cn('h-10 w-40 rounded-lg', className)} />;

  const src = brand.logo_full_url ?? (brand.builtin_logo === 'institute' ? LOGO_FULL_SRC : null);
  if (!src) {
    return (
      <span className={cn('flex items-center gap-3', className)}>
        <LogoMark className="size-10" />
        <span className="font-display text-lg leading-tight font-semibold">{brand.name}</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={brand.name}
      className={cn('h-10 w-auto select-none object-contain', className)}
    />
  );
}

/** Mark plus a stacked wordmark, sized for the sidebar header. */
export function LogoLockup({ className }: { className?: string }) {
  const brand = useBrand();
  const ready = useBrandReady();

  if (!ready) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <MarkPlaceholder className="size-10" />
        <div className="min-w-0 space-y-1.5">
          <span className="bg-muted/60 block h-3 w-24 rounded" />
          <span className="bg-muted/40 block h-2.5 w-32 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark className="size-10" />
      <div className="min-w-0 leading-tight">
        <p className="font-display truncate text-sm font-semibold">{brand.short}</p>
        <p className="text-sidebar-muted-foreground truncate text-xs">{brand.tagline}</p>
      </div>
    </div>
  );
}
