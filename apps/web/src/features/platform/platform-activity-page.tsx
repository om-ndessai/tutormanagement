import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { formatTimestamp } from '@/lib/utils';
import { usePlatformAudit } from './api';

/** What the platform itself has done: organizations, their admins, platform admins. */
export function PlatformActivityPage() {
  const audit = usePlatformAudit();
  const rows = audit.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        description="What the platform did. Each line is also in the affected organization’s own log."
      />
      <Card className="py-0">
        <CardContent className="p-0">
          <ul className="divide-y" aria-label="Platform activity">
            {rows.map((row) => (
              <li key={row.id} className="grid gap-0.5 px-4 py-3 text-sm">
                <span>{row.description}</span>
                <span className="text-muted-foreground text-xs">
                  {row.actor_name}
                  {row.organization_name ? ` · ${row.organization_name}` : ''} ·{' '}
                  {formatTimestamp(row.created_at, '—')}
                </span>
              </li>
            ))}
            {!audit.isPending && rows.length === 0 && (
              <li className="text-muted-foreground px-4 py-6 text-sm">Nothing yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
