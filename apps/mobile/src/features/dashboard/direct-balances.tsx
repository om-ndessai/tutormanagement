// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 24066d9 (working tree):
// DirectBalancesPanel and directTotals (Phase 54, `docs/tutor-spaces-plan.md`, R24). In a space paid
// directly, what each family owes each tutor. `of` says which side the reader is on: a tutor reads
// their families, a family its tutors, an admin both. The rows are the server's, scoped to the reader.
import { formatCents, type DirectBalance } from '@tmi/shared';
import { View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { EmptyNote, Panel } from '@/components/section';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/** The panel shows this many; Billing has them all. */
const SHOWN = 8;

/** What the rows add up to: charged, paid, and what is still owed (credit is not owed). */
export function directTotals(rows: readonly DirectBalance[]): {
  charged: number;
  paid: number;
  owed: number;
} {
  return {
    charged: rows.reduce((sum, row) => sum + row.charged_cents, 0),
    paid: rows.reduce((sum, row) => sum + row.paid_cents, 0),
    owed: rows.reduce((sum, row) => sum + Math.max(0, row.balance_cents), 0),
  };
}

/** "with Diego Ramos · 2 lessons · $50.00 paid", from the reader's side. */
export function directRowDetail(row: DirectBalance, of: 'tutor' | 'family' | 'admin'): string {
  const lead =
    of === 'admin' ? `with ${row.tutor_name} · ` : of === 'family' ? `for ${row.student_name} · ` : '';
  const lessons = `${row.session_count} ${row.session_count === 1 ? 'lesson' : 'lessons'}`;
  return `${lead}${lessons} · ${formatCents(row.paid_cents)} paid`;
}

export function DirectBalancesPanel({
  rows,
  title,
  of,
}: {
  rows: DirectBalance[];
  title: string;
  of: 'tutor' | 'family' | 'admin';
}) {
  const theme = useAppTheme();
  return (
    <Panel testID="direct-balances" title={title} action={{ label: 'Billing', to: '/billing' }}>
      {rows.length === 0 ? (
        <EmptyNote>No lessons paid directly yet.</EmptyNote>
      ) : (
        rows.slice(0, SHOWN).map((row, index) => {
          const key = `${row.student_user_id}-${row.tutor_user_id}`;
          return (
            <View key={key}>
              {index > 0 ? <Divider /> : null}
              <View
                testID={`direct-balance-${key}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
                    {of === 'family' ? row.tutor_name : row.student_name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                    {directRowDetail(row, of)}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                    color: row.balance_cents > 0 ? theme.colors.onSurface : theme.tokens.mutedForeground,
                  }}
                >
                  {formatCents(row.balance_cents)}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </Panel>
  );
}
