// Ported from apps/web/src/features/teaching/assignments-page.tsx @ 1132322 (RateCell, the phone
// card's rate lines) and assignment-dialog.tsx (fallbackHint). A pairing's rates are what its
// tutor is paid: the API blanks them for everyone but that tutor and an admin
// (`scopeAssignmentRates`), and this is the only file of the feature that formats them.
import { formatCents, type Assignment } from '@tmi/shared';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/** Whose pay this row is to the reader: the office's to see, or the tutor's own. */
export function seesPairingPay(
  row: Pick<Assignment, 'tutor_user_id'>,
  viewer: { id: string; isAdmin: boolean } | null,
): boolean {
  return Boolean(viewer && (viewer.isAdmin || row.tutor_user_id === viewer.id));
}

/** What a cleared rate field will fall back to, named rather than implied. */
export function rateFallbackHint(fallbackCents: number | null, example: string): string {
  if (fallbackCents == null) return example;
  return `${formatCents(fallbackCents)} (default)`;
}

/**
 * The rate in force for each mode, and whether it overrides the tutor's default. "Tutor pay" for
 * the office, "Your rate" for the tutor. Rendered only for a reader who may see it.
 */
export function PairingRates({ assignment, isAdmin }: { assignment: Assignment; isAdmin: boolean }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const lines = [
    {
      key: 'in-person',
      label: isAdmin ? 'Tutor pay, in person' : 'Your rate, in person',
      effective: assignment.effective_rate_in_person_cents,
      override: assignment.rate_in_person_cents,
    },
    {
      key: 'virtual',
      label: 'Virtual',
      effective: assignment.effective_rate_virtual_cents,
      override: assignment.rate_virtual_cents,
    },
  ];

  return (
    <View
      testID={`pairing-rates-${assignment.id}`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}
    >
      {lines.map((line) => (
        <View
          key={line.key}
          testID={`pairing-rate-${line.key}-${assignment.id}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text variant="bodySmall" style={{ color: muted }}>
            {line.label}:
          </Text>
          {line.effective == null ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              No rate set
            </Text>
          ) : (
            <Text variant="bodySmall" style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>
              {formatCents(line.effective)}
            </Text>
          )}
          {line.effective != null && line.override != null ? (
            <View
              testID={`pairing-custom-${line.key}-${assignment.id}`}
              style={{
                borderRadius: radius.sm,
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: theme.tokens.muted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '500' }}>custom</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
