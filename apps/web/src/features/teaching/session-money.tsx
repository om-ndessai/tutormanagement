import { formatCents, marginCents, type TutoringSession } from '@tmi/shared';

import { cn } from '@/lib/utils';

type Money = Pick<
  TutoringSession,
  | 'money_view'
  | 'tutor_rate_cents'
  | 'tutor_amount_cents'
  | 'charge_rate_cents'
  | 'charge_amount_cents'
>;

/**
 * A lesson's money, said from the reader's side of it (Phase 17).
 *
 *   admin   what the family was charged, then the tutor's pay and the
 *           institute's cut beneath it
 *   tutor   "Your pay", at their rate
 *   family  "You pay", at the price per hour
 *
 * Every screen that shows a lesson's money renders it through this, so the
 * label always matches the figure. Before, a bare "$95.00" meant the price to
 * one reader and the pay to another, and a person who both tutors and parents
 * saw both meanings in one list with nothing to tell them apart.
 */
export function SessionMoney({
  session,
  compact = false,
  className,
}: {
  session: Money;
  /** One line only: the headline figure with its label, for dense lists. */
  compact?: boolean;
  className?: string;
}) {
  if (session.money_view === 'none') return null;

  const admin = session.money_view === 'admin';
  const tutor = session.money_view === 'tutor';
  const amount = tutor ? session.tutor_amount_cents : session.charge_amount_cents;
  const rate = tutor ? session.tutor_rate_cents : session.charge_rate_cents;
  const label = admin ? 'Charged' : tutor ? 'Your pay' : 'You pay';

  if (compact) {
    return (
      <span className={cn('text-right', className)}>
        <span className="block text-sm font-medium tabular-nums">{formatCents(amount)}</span>
        <span className="text-muted-foreground block text-[10px] leading-tight">
          {admin ? `${formatCents(marginCents(session))} to institute` : label}
        </span>
      </span>
    );
  }

  return (
    <div className={cn('text-right', className)}>
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">{label}</p>
      <p className="font-display font-semibold tabular-nums">{formatCents(amount)}</p>
      <p className="text-muted-foreground text-[11px]">{formatCents(rate)}/hr</p>
      {admin && (
        <p className="text-muted-foreground text-[11px] tabular-nums">
          Tutor {formatCents(session.tutor_amount_cents)} · Institute{' '}
          <span className="text-foreground font-medium">{formatCents(marginCents(session))}</span>
        </p>
      )}
    </div>
  );
}

/** "its $95.00 charge and $70.00 tutor pay", for a sentence about deleting it. */
export function describeSessionMoney(session: Money): string {
  switch (session.money_view) {
    case 'admin':
      return `its ${formatCents(session.charge_amount_cents)} charge and ${formatCents(session.tutor_amount_cents)} tutor pay`;
    case 'tutor':
      return `your ${formatCents(session.tutor_amount_cents)} pay for it`;
    case 'family':
      return `its ${formatCents(session.charge_amount_cents)} charge`;
    default:
      return 'its record';
  }
}
