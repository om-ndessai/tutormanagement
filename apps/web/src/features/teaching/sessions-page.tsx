import { useMemo, useState } from 'react';
import { ChevronDownIcon, DownloadIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SESSION_MODE_LABELS,
  formatCents,
  formatClockTime,
  formatDuration,
  marginCents,
  shownAmountCents,
  shownRateCents,
  type TutoringSession,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { SessionFormDialog } from './session-form-dialog';
import { StartSessionButton } from './start-session-button';
import { useDeleteSession, useSessions } from './api';

const PAGE_SIZE = 25;

/**
 * The tutor's worklist and the admin's billing view are the same screen: what
 * differs is how much of it the API returns, which is decided server-side.
 */
export function SessionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TutoringSession | null>(null);
  const [removing, setRemoving] = useState<TutoringSession | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [from, to, page],
  );

  // Mirrors the on-screen filter so the export matches the view.
  const exportQuery = useMemo(() => {
    const search = new URLSearchParams();
    if (from) search.set('from', from);
    if (to) search.set('to', to);
    const query = search.toString();
    return query ? `?${query}` : '';
  }, [from, to]);

  const { data, isPending } = useSessions(params);
  const remove = useDeleteSession();

  const sessions = data?.data ?? [];
  const totals = data?.totals;
  const total = totals?.session_count ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  async function confirmRemove() {
    if (!removing) return;

    try {
      await remove.mutateAsync(removing.id);
      toast.success('Session deleted.');
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not delete the session.',
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Sessions"
        description={
          isAdmin
            ? 'Every lesson taught, and what it earned.'
            : isTutor
              ? 'Lessons you have taught, and what you have earned.'
              : 'Lessons taught, and what they cost.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Carries the current date filter, so what you download is what
                you are looking at. A plain link: the cookie goes along and the
                browser names the file from Content-Disposition. */}
            <Button variant="outline" asChild>
              <a href={`/api/sessions/export.csv${exportQuery}`} download>
                <DownloadIcon />
                CSV
              </a>
            </Button>
            {(isTutor || isAdmin) && (
              <>
                <StartSessionButton />
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <PlusIcon />
                  Record a session
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* The running total is the point of the page, so it leads. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Sessions" value={totals ? String(totals.session_count) : undefined} />
        <SummaryTile
          label="Time taught"
          value={totals ? formatDuration(totals.total_minutes) : undefined}
        />
        <SummaryTile
          label={isAdmin ? 'Billed' : isTutor ? 'Earned' : 'Charged'}
          value={
            totals
              ? formatCents(totals.total_charge_amount_cents ?? totals.total_tutor_amount_cents ?? 0)
              : undefined
          }
          emphasis
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="from" className="text-muted-foreground text-xs">
            From
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(0);
            }}
            className="w-full sm:w-40"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to" className="text-muted-foreground text-xs">
            To
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(0);
            }}
            className="w-full sm:w-40"
          />
        </div>
        {(from || to) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom('');
              setTo('');
              setPage(0);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isPending && sessions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions recorded{from || to ? ' in this period' : ' yet'}.
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {sessions.map((session) => {
          const isOpen = expanded === session.id;
          const canEdit = isAdmin || session.tutor_user_id === user?.id;

          return (
            <li key={session.id}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {session.student_name}
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          with {session.tutor_name}
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>{session.occurred_on}</span>
                        <span>·</span>
                        <span>
                          {formatClockTime(session.started_at)}–
                          {formatClockTime(session.ended_at)}
                        </span>
                        <span>·</span>
                        <span>{formatDuration(session.duration_minutes)}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {SESSION_MODE_LABELS[session.mode]}
                        </Badge>
                        {session.auto_stopped && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-400"
                          >
                            Auto-stopped
                          </Badge>
                        )}
                      </p>
                      {/* The end of this one was imposed by the limit, not
                          watched, so it is the figure most worth checking. */}
                      {session.auto_stopped && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          The timer ran past the session limit, so this was recorded at it. Edit
                          it if the lesson was a different length.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-display font-semibold tabular-nums">
                          {formatCents(shownAmountCents(session) ?? 0)}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {formatCents(shownRateCents(session) ?? 0)}/hr
                        </p>
                        {/* Only an admin sees both sides, so only they see this. */}
                        {marginCents(session) !== null && (
                          <p className="text-muted-foreground text-[11px]">
                            {formatCents(marginCents(session)!)} kept
                          </p>
                        )}
                      </div>

                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit session"
                            onClick={() => {
                              setEditing(session);
                              setFormOpen(true);
                            }}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete session"
                            onClick={() => setRemoving(session)}
                          >
                            <Trash2Icon />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {session.notes && (
                    <div className="mt-3 border-t pt-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : session.id)}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                        aria-expanded={isOpen}
                      >
                        <ChevronDownIcon
                          className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                        {isOpen ? 'Hide notes' : 'Session notes'}
                      </button>
                      {isOpen && (
                        <p className="mt-2 text-sm whitespace-pre-wrap">{session.notes}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <SessionFormDialog open={formOpen} onOpenChange={setFormOpen} existing={editing} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The {removing?.occurred_on} session with {removing?.student_name} and its{' '}
              {formatCents(shownAmountCents(removing ?? { tutor_amount_cents: null, charge_amount_cents: null }) ?? 0)}{' '}
              charge will be removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | undefined;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        {value === undefined ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <p
            className={`font-display mt-1 font-semibold tabular-nums ${emphasis ? 'text-2xl' : 'text-xl'}`}
          >
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
