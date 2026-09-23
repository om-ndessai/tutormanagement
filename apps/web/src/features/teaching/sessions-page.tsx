import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDownIcon, DownloadIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SESSION_MODE_LABELS,
  formatCents,
  formatClockTime,
  formatDuration,
  type TutoringSession,
} from '@tmi/shared';

import { FocusNotice } from '@/components/layout/focus-notice';
import { PageHeader } from '@/components/layout/page-header';
import {
  TutoringFinanceTabs,
  useTutoringFinanceTab,
} from '@/components/layout/tutoring-finance-tabs';
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
import { CommentsButton } from '@/features/comments/comments-button';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { SessionFormDialog } from './session-form-dialog';
import { SessionMoney, describeSessionMoney } from './session-money';
import { StartSessionButton } from './start-session-button';
import { useDeleteSession, useSession, useSessions } from './api';

const PAGE_SIZE = 25;

/**
 * The tutor's worklist and the admin's billing view are the same screen: what
 * differs is how much of it the API returns, which is decided server-side.
 *
 * It is split into Tutoring and Finance tabs (Phase 19). A tutor keeps this
 * open during a lesson to read the last session's notes, with the student
 * beside them, so the Tutoring tab -- the default -- carries no money at all:
 * no totals, no amounts on the lessons, none in the dialogs it opens. What the
 * API returns is unchanged; this is about what is on the screen.
 */
export function SessionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TutoringSession | null>(null);
  const [removing, setRemoving] = useState<TutoringSession | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab] = useTutoringFinanceTab();
  const showMoney = tab === 'finance';

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

  const { data, isPending: listPending } = useSessions(params);
  const remove = useDeleteSession();

  /**
   * A link from the comments feed names one session. It may sit on any page of
   * any filter, so it is fetched on its own and shown alone until the reader
   * asks for the rest.
   */
  const focusId = searchParams.get('focus');
  const focused = useSession(focusId);
  const clearFocus = () =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('focus');
        return next;
      },
      { replace: true },
    );

  const listSessions = data?.data ?? [];
  const sessions = focusId ? (focused.data ? [focused.data.data] : []) : listSessions;
  const isPending = focusId ? focused.isPending : listPending;
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

  /** One tab's content. Only the Finance tab passes `money`. */
  function renderView(money: boolean) {
    return (
      <>
        {/* The running totals lead. Each money tile is one side, labelled from
            the reader's point of view, and appears only when the reader sees
            that side on some lesson: a tutor who is also a parent gets both
            "Earned" and "Charged". */}
        <div className={`grid grid-cols-2 gap-4 ${money ? 'lg:grid-cols-4' : ''}`}>
          <SummaryTile label="Sessions" value={totals ? String(totals.session_count) : undefined} />
          <SummaryTile
            label="Time taught"
            value={totals ? formatDuration(totals.total_minutes) : undefined}
          />
          {!money ? null : isAdmin ? (
            <>
              <SummaryTile
                label="Charged"
                value={totals ? formatCents(totals.total_charge_amount_cents) : undefined}
                hint={totals ? `${formatCents(totals.total_tutor_amount_cents)} paid to tutors` : undefined}
                emphasis
              />
              <SummaryTile
                label="Institute cut"
                value={
                  totals
                    ? formatCents(
                        (totals.total_charge_amount_cents ?? 0) - (totals.total_tutor_amount_cents ?? 0),
                      )
                    : undefined
                }
                emphasis
              />
            </>
          ) : (
            <>
              {(totals?.total_tutor_amount_cents != null || (!totals && isTutor)) && (
                <SummaryTile
                  label="Earned"
                  value={totals ? formatCents(totals.total_tutor_amount_cents) : undefined}
                  hint="Paid to you for these lessons"
                  emphasis
                />
              )}
              {totals?.total_charge_amount_cents != null && (
                <SummaryTile
                  label="Charged"
                  value={formatCents(totals.total_charge_amount_cents)}
                  hint={isTutor ? 'For your own or your family’s lessons' : 'What these lessons cost you'}
                  emphasis
                />
              )}
            </>
          )}
        </div>

        <FocusNotice
          active={Boolean(focusId)}
          found={sessions.length > 0}
          what="session"
          onClear={clearFocus}
        />

        {!focusId && (
        <div className="flex flex-wrap items-end gap-3">
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
          {/* The export carries every amount, so it lives with the money.
              It takes the current date filter, so what you download is what
              you are looking at. A plain link: the cookie goes along and the
              browser names the file from Content-Disposition. */}
          {money && (
            <Button variant="outline" asChild className="sm:ml-auto">
              <a href={`/api/sessions/export.csv${exportQuery}`} download>
                <DownloadIcon />
                CSV
              </a>
            </Button>
          )}
        </div>
        )}

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
                              className="border-warning/60 text-warning-foreground dark:text-warning text-[10px]"
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
                        {money && <SessionMoney session={session} />}

                        <CommentsButton
                          target={{ target_type: 'session', target_id: session.id }}
                          title={`the ${session.occurred_on} session with ${session.student_name}`}
                          description={`${session.student_name} with ${session.tutor_name}, ${formatClockTime(session.started_at)}–${formatClockTime(session.ended_at)}.`}
                        />

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

        {!focusId && total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3">
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

      </>
    );
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
          (isTutor || isAdmin) && (
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          )
        }
      />

      <TutoringFinanceTabs tutoring={renderView(false)} finance={renderView(true)} />

      <SessionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={editing}
        showMoney={showMoney}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The {removing?.occurred_on} session with {removing?.student_name}, and{' '}
              {removing && showMoney ? describeSessionMoney(removing) : 'its record'}, will be removed. This
              cannot be undone.
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
  hint,
  emphasis,
}: {
  label: string;
  value: string | undefined;
  hint?: string;
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
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}
