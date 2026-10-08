// Ported from apps/web/src/features/teaching/session-money.tsx @ 1132322
import { formatCents, marginCents, type TutoringSession } from '@tmi/shared';
import { View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

type Money = Pick<
  TutoringSession,
  'money_view' | 'tutor_rate_cents' | 'tutor_amount_cents' | 'charge_rate_cents' | 'charge_amount_cents'
>;

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
  const label = admin ? 'Charged' : tutor ? 'Your pay' : 'You pay';
  const muted = theme.tokens.mutedForeground;

  if (compact) {
    return (
      <View testID="session-money" style={[{ alignItems: 'flex-end' }, style]}>
        <Text variant="bodyMedium" style={{ fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {formatCents(amount)}
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 13, color: muted }}>
          {admin ? `${formatCents(marginCents(session))} to ${brand.short}` : label}
        </Text>
      </View>
    );
  }

  return (
    <View testID="session-money" style={[{ alignItems: 'flex-end' }, style]}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: muted,
        }}
      >
        {label}
      </Text>
      <Text variant="titleMedium" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {formatCents(amount)}
      </Text>
      <Text style={{ fontSize: 11, color: muted }}>{formatCents(rate)}/hr</Text>
      {admin ? (
        <Text style={{ fontSize: 11, color: muted, fontVariant: ['tabular-nums'] }}>
          Tutor {formatCents(session.tutor_amount_cents)} · {brand.short}{' '}
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.colors.onSurface }}>
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
      return `its ${formatCents(session.charge_amount_cents)} charge and ${formatCents(session.tutor_amount_cents)} tutor pay`;
    case 'tutor':
      return `your ${formatCents(session.tutor_amount_cents)} pay for it`;
    case 'family':
      return `its ${formatCents(session.charge_amount_cents)} charge`;
    default:
      return 'its record';
  }
}
