import { cn } from '@/lib/utils';

/** Served straight from `public/`, so no bundler import is needed. */
const LOGO_MARK_SRC = '/logo-mark.png';
const LOGO_FULL_SRC = '/logo-full.png';

const INSTITUTE_NAME = 'Mathematics Institute of the Triangle';

/**
 * Both assets are the institute's own logo, extracted from
 * trianglemathinstitute.com with the background keyed out so the mark sits on
 * light and dark surfaces alike.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_MARK_SRC}
      alt=""
      aria-hidden
      className={cn('size-9 select-none object-contain', className)}
    />
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_FULL_SRC}
      alt={INSTITUTE_NAME}
      className={cn('h-10 w-auto select-none object-contain', className)}
    />
  );
}

/** Mark plus a stacked wordmark, sized for the sidebar header. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark className="size-10" />
      <div className="min-w-0 leading-tight">
        <p className="font-display truncate text-sm font-semibold">TMI Portal</p>
        <p className="text-muted-foreground truncate text-xs">Exploring the fun of Math</p>
      </div>
    </div>
  );
}
