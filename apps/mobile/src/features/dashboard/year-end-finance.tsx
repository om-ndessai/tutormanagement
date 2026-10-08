// Ported from apps/web/src/features/dashboard/year-end-panel.tsx @ 1132322 -- the list only. The
// 1099-NEC is printed on the device in feature 28, so there is no print button here yet. Named
// *finance* so the money-file rule lets it format amounts.
import { formatCents, isMailingAddressComplete } from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Divider, SegmentedButtons, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { SsnReceiptButton } from '@/features/users/ssn-receipt-button';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useTaxStatus } from './api';
import { orgYear } from './finance-format';

/** The year being filed for, plus the two before it. */
function selectableYears(current: number): number[] {
  return [current, current - 1, current - 2];
}

/**
 * Year-end documents, one row per tutor: what each was paid in the tax year, and what the office
 * still lacks for the form (their SSN on file, a full address). The year is chosen rather than
 * assumed, because the work happens in January for the year that just ended.
 */
export function YearEndFinance() {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const current = orgYear(timeZone);
  const [year, setYear] = useState(current);

  const { data, isPending } = useTaxStatus(year);
  const tutors = data?.data ?? [];
  const { organization } = useAuth();
  const instituteTin = organization?.settings?.tin ?? null;

  // Paid first, since those are the forms that have to be filed.
  const ordered = [...tutors].sort((a, b) => b.paid_this_year_cents - a.paid_this_year_cents);

  return (
    <Panel testID="year-end" title="Year-end documents">
      <View style={{ gap: space.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground }}>
            Tax year
          </Text>
          <SegmentedButtons
            density="small"
            value={String(year)}
            onValueChange={(value) => {
              haptics.selection();
              setYear(Number(value));
            }}
            buttons={selectableYears(current).map((option) => ({
              value: String(option),
              label: String(option),
              testID: `year-end-year-${option}`,
              accessibilityLabel: `Tax year ${option}`,
            }))}
          />
        </View>

        {isPending ? (
          <View style={{ gap: space.sm }}>
            <Skeleton width="100%" height={36} />
            <Skeleton width="100%" height={36} />
          </View>
        ) : ordered.length === 0 ? (
          <EmptyNote>No tutors on the books.</EmptyNote>
        ) : (
          <View>
            {ordered.map((tutor, index) => (
              <View key={tutor.user_id}>
                {index > 0 ? <Divider /> : null}
                <View
                  testID={`year-end-tutor-${tutor.user_id}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
                      {tutor.full_name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                      {tutor.paid_this_year_cents > 0
                        ? `${formatCents(tutor.paid_this_year_cents)} paid in ${year}`
                        : `Nothing paid in ${year}`}
                      {!tutor.ssn_received_on ? ' · SSN not on file' : ''}
                      {!isMailingAddressComplete(tutor.address) ? ' · No full address' : ''}
                    </Text>
                  </View>
                  {!tutor.ssn_received_on ? (
                    <SsnReceiptButton
                      testID={`year-end-ssn-${tutor.user_id}`}
                      userId={tutor.user_id}
                      fullName={tutor.full_name}
                      received={false}
                      mode="text"
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          The SSN is typed when the form is printed and is never stored. The recipient’s address comes from
          the tutor’s record.{' '}
          {instituteTin
            ? `The payer box is filled from the organization settings (${instituteTin}).`
            : 'Add the TIN on the Organization settings page and it will fill the payer box for you.'}
        </Text>
      </View>
    </Panel>
  );
}
