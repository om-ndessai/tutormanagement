import { CircleAlertIcon } from 'lucide-react';
import type { SessionMode } from '@tmi/shared';

import { Badge } from '@/components/ui/badge';

/**
 * Phase 75 (JF18, R34): which of a student's prices the office has not set, in words -- never an amount, so a tutor,
 * whose view blanks the prices, reads it too. For one mode (a schedule's): "No price set" when that one is missing.
 * Otherwise "No price set" for both, or "No virtual price set" for one.
 */
export function priceMissingWords(missing: readonly SessionMode[] | null | undefined, mode?: SessionMode): string | null {
  if (!missing || missing.length === 0) return null;
  if (mode) return missing.includes(mode) ? 'No price set' : null;
  if (missing.length > 1) return 'No price set';
  return missing[0] === 'virtual' ? 'No virtual price set' : 'No in-person price set';
}

/** The flag as a badge, where `priceMissingWords` says so; nothing otherwise. */
export function NoPriceBadge({
  missing,
  mode,
  testId = 'no-price',
}: {
  missing: readonly SessionMode[] | null | undefined;
  mode?: SessionMode;
  testId?: string;
}) {
  const words = priceMissingWords(missing, mode);
  if (!words) return null;
  return (
    <Badge
      variant="outline"
      className="border-warning/60 text-warning-foreground dark:text-warning gap-1 text-[10px]"
      data-testid={testId}
    >
      <CircleAlertIcon className="size-3" aria-hidden />
      {words}
    </Badge>
  );
}
