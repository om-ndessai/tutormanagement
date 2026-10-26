// Ported from apps/web/src/features/teaching/session-money.tsx @ 1132322 (Phase 54's paid-directly
// labels @ 24066d9, working tree)
import { formatCents, marginCents, type TutoringSession } from '@tmi/shared';
import { View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

type Money = Pick<
  TutoringSession,
  'money_view' | 'tutor_rate_cents' | 'tutor_amount_cents' | 'charge_rate_cents' | 'charge_amount_cents'
> &
  Partial<Pick<TutoringSession, 'paid_directly'>>;

/**
 * A lesson's money, said from the reader's side of it (Phase 17).
 *
 *   admin   what the family was charged, then the tutor's pay and the organization's cut
 *   tutor   "Your pay", at their rate
 *   family  "You pay", at the price per hour
 *
 * Every screen that shows a lesson's money renders it through this, so the label always matches
 * the figure. Renders nothing for `money_view: 'none'`.
 */
export function SessionMoney({
  session,
  compact = false,
  style,
}: {
  session: Money;
  /** One line only: the headline figure with its label, for dense lists. */
  compact?: boolean;
  style?: ViewStyle;
}) {
  const brand = useBrand();
  const theme = useAppTheme();
  if (session.money_view === 'none') return null;

  const admin = session.money_view === 'admin';
  const tutor = session.money_view === 'tutor';
  const amount = tutor ? session.tutor_amount_cents : session.charge_amount_cents;
  const rate = tutor ? session.tutor_rate_cents : session.charge_rate_cents;
  // Phase 54: a lesson paid directly is one price the family pays the tutor; there is no cut, so
  // nobody is shown one.
  const direct = Boolean(session.paid_directly);
  const label = direct
    ? admin
      ? 'Paid to the tutor'
      : tutor
        ? 'Family pays you'
        : 'You pay the tutor'
    : admin
      ? 'Charged'
      : tutor
        ? 'Your pay'
        : 'You pay';
  const muted = theme.tokens.mutedForeground;

  if (compact) {
    return (
      <View testID="session-money" style={[{ alignItems: 'flex-end' }, style]}>
        <Text variant="bodyMedium" style={{ fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {formatCents(amount)}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 16, color: muted }}>
          {admin && !direct ? `${formatCents(marginCents(session))} to ${brand.short}` : label}
        </Text>
      </View>
    );
  }

  return (
    <View testID="session-money" style={[{ alignItems: 'flex-end' }, style]}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: muted,
        }}
      >
        {label}
      </Text>
      <Text variant="titleMedium" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {formatCents(amount)}
      </Text>
      <Text style={{ fontSize: 12, color: muted }}>{formatCents(rate)}/hr</Text>
      {admin && !direct ? (
        <Text style={{ fontSize: 12, color: muted, fontVariant: ['tabular-nums'] }}>
          Tutor {formatCents(session.tutor_amount_cents)} · {brand.short}{' '}
          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.onSurface }}>
            {formatCents(marginCents(session))}
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

/** "its $95.00 charge and $70.00 tutor pay", for a sentence about deleting it. */
export function describeSessionMoney(session: Money): string {
  switch (session.money_view) {
    case 'admin':
      if (session.paid_directly) return `its ${formatCents(session.charge_amount_cents)} price`;
      return `its ${formatCents(session.charge_amount_cents)} charge and ${formatCents(session.tutor_amount_cents)} tutor pay`;
    case 'tutor':
      return `your ${formatCents(session.tutor_amount_cents)} pay for it`;
    case 'family':
      return `its ${formatCents(session.charge_amount_cents)} charge`;
    default:
      return 'its record';
  }
}
