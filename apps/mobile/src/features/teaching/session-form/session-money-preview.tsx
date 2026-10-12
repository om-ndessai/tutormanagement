// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (SessionPreview).
// Shows exactly what will be billed, and why, before anything is saved: the length always, and
// the money only when the form was opened from Finance (`showMoney`, false by default). The
// figures come from the same shared helpers the Worker uses, but the server still derives them
// itself and ignores anything the client sends.
import {
  computeAmountCents,
  elapsedMinutes,
  formatCents,
  formatDuration,
  resolveChargeRateCents,
  resolveRateCents,
  roundToQuarterHour,
  type Assignment,
  type SessionMode,
  type StudentProfile,
} from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export interface SessionPreviewFigures {
  elapsed: number;
  billed: number;
  rate: number | null;
  amount: number | null;
  /** Admin only: null for a tutor, who is never sent the price. */
  charge: number | null;
}

/** The live preview: elapsed -> billed quarter hours -> money. */
export function previewFigures(
  startedAt: string,
  endedAt: string,
  mode: SessionMode,
  assignment: Assignment | undefined,
  studentPrices: Pick<StudentProfile, 'charge_rate_in_person_cents' | 'charge_rate_virtual_cents'> | null,
): SessionPreviewFigures | null {
  const elapsed = elapsedMinutes(startedAt, endedAt);
  if (elapsed === null) return null;
  const billed = roundToQuarterHour(elapsed);
  const rate = assignment
    ? resolveRateCents(
        mode,
        { in_person: assignment.rate_in_person_cents, virtual: assignment.rate_virtual_cents },
        {
          in_person: assignment.effective_rate_in_person_cents,
          virtual: assignment.effective_rate_virtual_cents,
        },
      )
    : null;
  const chargeRate = studentPrices ? resolveChargeRateCents(mode, studentPrices) : null;
  return {
    elapsed,
    billed,
    rate,
    amount: rate == null ? null : computeAmountCents(billed, rate),
    charge: chargeRate == null ? null : computeAmountCents(billed, chargeRate),
  };
}

export function SessionMoneyPreview({
  preview,
  hasAssignment,
  isAdmin,
  showMoney = false,
}: {
  preview: SessionPreviewFigures | null;
  hasAssignment: boolean;
  isAdmin: boolean;
  showMoney?: boolean;
}) {
  const brand = useBrand();
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const box = {
    backgroundColor: theme.tokens.muted,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    gap: 4,
  } as const;

  if (!preview) {
    return (
      <View testID="record-preview" style={box}>
        <Text variant="bodyMedium" style={{ color: muted }}>
          Enter a start and end time.
        </Text>
      </View>
    );
  }

  const rounded = preview.billed !== preview.elapsed;

  return (
    <View testID="record-preview" style={box}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
          <Icon source="clock-outline" size={16} color={muted} />
          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
            {formatDuration(preview.billed)}
          </Text>
          {rounded ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              rounded from {formatDuration(preview.elapsed)}
            </Text>
          ) : null}
        </View>
        {/* A missing rate still warns on the Tutoring tab: it is a problem to fix, not a figure. */}
        {preview.amount != null ? (
          showMoney ? (
            <View testID="record-money" style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '500',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: muted,
                }}
              >
                {isAdmin ? 'Tutor pay' : 'Your pay'}
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {formatCents(preview.amount)}
              </Text>
            </View>
          ) : null
        ) : (
          <Text variant="bodySmall" style={{ color: hasAssignment ? theme.colors.error : muted }}>
            {hasAssignment ? 'No rate set for this mode' : 'Choose a student'}
          </Text>
        )}
      </View>

      {showMoney && preview.rate != null ? (
        <Text variant="bodySmall" style={{ color: muted }}>
          {isAdmin ? 'The tutor is' : 'You are'} paid in quarter hours at {formatCents(preview.rate)}/hr.
        </Text>
      ) : null}

      {/* The admin's view of the same lesson: both sides and the cut. */}
      {showMoney && isAdmin && preview.amount != null ? (
        preview.charge != null ? (
          <Text variant="bodySmall">
            Family charged{' '}
            <Text style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {formatCents(preview.charge)}
            </Text>{' '}
            · {brand.short} keeps{' '}
            <Text style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {formatCents(preview.charge - preview.amount)}
            </Text>
          </Text>
        ) : (
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            No price is set on this student for this mode.
          </Text>
        )
      ) : null}
    </View>
  );
}
