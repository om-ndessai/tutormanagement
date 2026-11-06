// Ported from apps/web/src/features/teaching/assignments-page.tsx @ 1132322 (RateCell, the phone
// card's rate lines) and assignment-dialog.tsx (fallbackHint). A pairing's rates are what its
// tutor is paid: the API blanks them for everyone but that tutor and an admin
// (`scopeAssignmentRates`), and this is the only file of the feature that formats them.
//
// Phase 75 (docs/journey-fixes-plan.md JF18, JF27): a pairing whose saved override equals the tutor's CURRENT
// default reads as the default (no "custom" pill; nothing in the data changes); the form's empty field says what it
// follows ("Alex's default, $75.00"); and a student price the office has not set reads "No price set" on the
// pairing -- from the server's `price_missing`, never an amount, so a tutor reads it too.
import { formatCents, type Assignment, type SessionMode } from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/** Whose pay this row is to the reader: the office's to see, or the tutor's own. */
export function seesPairingPay(
  row: Pick<Assignment, 'tutor_user_id'>,
  viewer: { id: string; isAdmin: boolean } | null,
): boolean {
  return Boolean(viewer && (viewer.isAdmin || row.tutor_user_id === viewer.id));
}

/** A tutor's default pay rates, when the reader has them (their own, or the office's fetch of the tutor). */
export type TutorDefaults = { in_person: number | null; virtual: number | null };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * What an empty override field follows, named rather than implied: "Alex's default, $75.00" -- or, with no default,
 * that there is none ("Alex has no default rate"); before the tutor is known, nothing.
 */
export function rateFallbackHint(fallbackCents: number | null, tutorName: string | null | undefined): string {
  if (!tutorName) return '';
  const first = firstName(tutorName);
  return fallbackCents == null ? `${first} has no default rate` : `${first}'s default, ${formatCents(fallbackCents)}`;
}

/**
 * An override the form shows: the saved one, unless it equals the tutor's current default -- then it is shown as the
 * default it is (empty, following it). `centsToInput` stays the caller's.
 */
export function overrideShown(override: number | null, defaultCents: number | null | undefined): number | null {
  return override != null && defaultCents != null && override === defaultCents ? null : override;
}

/** A rate line of a pairing: the rate in force, and whether it is really the pairing's own ("custom"). */
export function pairingRateLines(
  assignment: Pick<
    Assignment,
    'rate_in_person_cents' | 'rate_virtual_cents' | 'effective_rate_in_person_cents' | 'effective_rate_virtual_cents'
  >,
  isAdmin: boolean,
  defaults?: TutorDefaults | null,
): { key: 'in-person' | 'virtual'; label: string; effective: number | null; custom: boolean }[] {
  const custom = (override: number | null, effective: number | null, mode: SessionMode) =>
    effective != null && override != null && (defaults == null || override !== defaults[mode]);
  return [
    {
      key: 'in-person',
      label: isAdmin ? 'Tutor pay, in person' : 'Your rate, in person',
      effective: assignment.effective_rate_in_person_cents,
      custom: custom(assignment.rate_in_person_cents, assignment.effective_rate_in_person_cents, 'in_person'),
    },
    {
      key: 'virtual',
      label: isAdmin ? 'Tutor pay, virtual' : 'Your rate, virtual',
      effective: assignment.effective_rate_virtual_cents,
      custom: custom(assignment.rate_virtual_cents, assignment.effective_rate_virtual_cents, 'virtual'),
    },
  ];
}

/** "No price set", "No virtual price set", "No in-person price set" -- or null where every price is set. */
export function missingPriceLine(missing: readonly SessionMode[] | undefined): string | null {
  const list = missing ?? [];
  if (list.includes('in_person') && list.includes('virtual')) return 'No price set';
  if (list.includes('in_person')) return 'No in-person price set';
  if (list.includes('virtual')) return 'No virtual price set';
  return null;
}

/** The family's price not set (R34): a flag on the pairing, for whoever sees the pairing -- never an amount. */
export function PairingPriceMissing({ assignment }: { assignment: Pick<Assignment, 'id' | 'price_missing'> }) {
  const theme = useAppTheme();
  const line = missingPriceLine(assignment.price_missing);
  if (!line) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon source="alert-circle-outline" size={16} color={theme.colors.primary} />
      <Text testID={`pairing-price-missing-${assignment.id}`} variant="bodySmall" style={{ fontWeight: '600' }}>
        {line}
      </Text>
    </View>
  );
}

/**
 * The rate in force for each mode, and whether it overrides the tutor's default. "Tutor pay" for
 * the office, "Your rate" for the tutor. Rendered only for a reader who may see it.
 */
export function PairingRates({
  assignment,
  isAdmin,
  defaults,
}: {
  assignment: Assignment;
  isAdmin: boolean;
  /** The tutor's current defaults, when known: an override equal to one is shown as the default. */
  defaults?: TutorDefaults | null;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const lines = pairingRateLines(assignment, isAdmin, defaults);

  return (
    <View
      testID={`pairing-rates-${assignment.id}`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}
    >
      {lines.map((line) => (
        <View
          key={line.key}
          testID={`pairing-rate-${line.key}-${assignment.id}`}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, maxWidth: '100%' }}
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
          {line.custom ? (
            <View
              testID={`pairing-custom-${line.key}-${assignment.id}`}
              style={{
                borderRadius: radius.sm,
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: theme.tokens.muted,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '500' }}>custom</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
