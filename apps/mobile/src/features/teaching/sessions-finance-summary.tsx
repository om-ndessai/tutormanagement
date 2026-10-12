// Ported from apps/web/src/features/teaching/sessions-page.tsx @ 1132322 (the Finance tab's money
// tiles). Each tile is one side of the money, labelled from the reader's point of view, and
// appears only when the reader sees that side on some lesson: a tutor who is also a parent gets
// both "Earned" and "Charged". Rendered on the Finance tab only.
import { formatCents, type SessionTotals } from '@tmi/shared';
import type { ReactNode } from 'react';

import { StatCard } from '@/components/stat-card';

const money = (cents: number): string => formatCents(cents);

export function sessionMoneyTiles({
  totals,
  isAdmin,
  isTutor,
  brandShort,
}: {
  totals: SessionTotals | undefined;
  isAdmin: boolean;
  isTutor: boolean;
  brandShort: string;
}): ReactNode[] {
  if (isAdmin) {
    return [
      <StatCard
        key="charged"
        label="Charged"
        icon="cash-multiple"
        value={totals ? (totals.total_charge_amount_cents ?? 0) : undefined}
        formatValue={money}
        hint={totals ? `${formatCents(totals.total_tutor_amount_cents)} paid to tutors` : undefined}
        animate={false}
      />,
      <StatCard
        key="cut"
        label={`${brandShort} cut`}
        icon="bank-outline"
        value={
          totals
            ? (totals.total_charge_amount_cents ?? 0) - (totals.total_tutor_amount_cents ?? 0)
            : undefined
        }
        formatValue={money}
        animate={false}
      />,
    ];
  }

  const tiles: ReactNode[] = [];
  if (totals?.total_tutor_amount_cents != null || (!totals && isTutor)) {
    tiles.push(
      <StatCard
        key="earned"
        label="Earned"
        icon="cash"
        value={totals?.total_tutor_amount_cents ?? undefined}
        formatValue={money}
        hint="Paid to you for these lessons"
        animate={false}
      />,
    );
  }
  if (totals?.total_charge_amount_cents != null) {
    tiles.push(
      <StatCard
        key="charged"
        label="Charged"
        icon="cash-multiple"
        value={totals.total_charge_amount_cents}
        formatValue={money}
        hint={isTutor ? 'For your own or your family’s lessons' : 'What these lessons cost you'}
        animate={false}
      />,
    );
  }
  return tiles;
}
