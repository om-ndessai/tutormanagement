import type { Context } from 'hono';
import {
  formatDuration,
  formatTimeRange,
  parseClockTime,
  ORG_PALETTE_HEX,
  ORG_QUERY_PARAM,
  type NotificationStatus,
  type OrgPalette,
} from '@tmi/shared';

import type { AppEnv, Env } from '../types.js';
import type { OrgId } from './org.js';
import { orgIdFromRow } from './org.js';
import {
  logNotifications,
  recipientsFor,
  type Audience,
  type LogRow,
  type Recipient,
} from '../repositories/notifications.js';
import { getOrganizationById } from '../repositories/organizations.js';

// ---------------------------------------------------------------------------
// Email notifications (Phase 32)
// ---------------------------------------------------------------------------
// While an organization's `email_notifications` flag is on, four actions email
// the people they concern. The rules (docs/data-exposure.md, R15):
//
//   * never blocks or breaks the action: it runs after the response, in
//     waitUntil, and a failure is recorded, never thrown;
//   * says no more than the recipient can already read in the portal -- who,
//     what kind of thing, when, and a link. No money, notes, write-up, comment
//     or assessment text;
//   * nobody is emailed about their own action, and nobody twice;
//   * only live members of THIS organization (recipientsFor).
//
// Cloudflare's free plan delivers only to verified destination addresses; any
// other address is refused, and the refusal is logged as `failed`. A Worker
// with no binding (local, the demo) logs `skipped`: what would have been sent.

/** What sending needs from wherever it is called: a request, or the cron. */
export interface Mailer {
  env: Env;
  waitUntil: (work: Promise<unknown>) => void;
}

/** A request's mailer: the work outlives the response. */
export function mailerFor(c: Context<AppEnv>): Mailer {
  let waitUntil: Mailer['waitUntil'];
  try {
    const ctx = c.executionCtx;
    waitUntil = (work) => ctx.waitUntil(work);
  } catch {
    // No execution context (a unit-style call): let it run unawaited.
    waitUntil = (work) => void work;
  }
  return { env: c.env, waitUntil };
}

/** The organization as far as an email needs it. */
export interface NotifyingOrg {
  id: OrgId;
  slug: string;
  name: string;
  palette: OrgPalette;
  email_notifications: boolean;
}

/** One notifying action, with the facts its emails may carry and nothing else. */
export type NotificationEvent = {
  /** Who did it: never emailed about it. Null for the sweep. */
  actorId: string | null;
} & (
  | { kind: 'user_added'; personId: string; personName: string; isStudent: boolean }
  | { kind: 'plan_added' | 'assessment_added'; studentId: string; studentName: string }
  | {
      kind: 'schedule_added' | 'session_recorded';
      studentId: string;
      studentName: string;
      tutorId: string;
      tutorName: string;
      /** "Tuesdays 4:00-5:00 PM · 1 hr", or "Monday, October 6, 4:00-5:00 PM". */
      when: string;
    }
);

/** "2026-10-06" -> "Monday, October 6, 2026": a calendar date, read as one. */
export function formatLessonDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Monday, October 6, 2026, 4:00-5:00 PM · 1 hr": a recorded lesson's when. */
export function describeLesson(lesson: {
  occurred_on: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
}): string {
  const start = parseClockTime(lesson.started_at);
  const end = parseClockTime(lesson.ended_at);
  const range = start !== null && end !== null ? formatTimeRange(start, end) : `${lesson.started_at}-${lesson.ended_at}`;
  return `${formatLessonDate(lesson.occurred_on)}, ${range} · ${formatDuration(lesson.duration_minutes)}`;
}

/** A recorded lesson's event, from the stored row. */
export function sessionRecordedEvent(
  actorId: string | null,
  session: {
    student_user_id: string;
    student_name: string;
    tutor_user_id: string;
    tutor_name: string;
    occurred_on: string;
    started_at: string;
    ended_at: string;
    duration_minutes: number;
  },
): NotificationEvent {
  return {
    kind: 'session_recorded',
    actorId,
    studentId: session.student_user_id,
    studentName: session.student_name,
    tutorId: session.tutor_user_id,
    tutorName: session.tutor_name,
    when: describeLesson(session),
  };
}

function audienceFor(event: NotificationEvent): Audience {
  switch (event.kind) {
    case 'user_added':
      return {
        subjectId: event.personId,
        guardians: event.isStudent,
        admins: true,
        subjectMayBeInvited: true,
      };
    case 'plan_added':
    case 'assessment_added':
      return { subjectId: event.studentId, guardians: true, pairedTutors: true };
    case 'schedule_added':
    case 'session_recorded':
      return { subjectId: event.studentId, tutorId: event.tutorId, guardians: true };
  }
}

function subjectIdOf(event: NotificationEvent): string {
  return event.kind === 'user_added' ? event.personId : event.studentId;
}

function pathFor(event: NotificationEvent): string {
  switch (event.kind) {
    case 'user_added':
      return '/';
    case 'plan_added':
    case 'assessment_added':
      return `/progress/${event.studentId}`;
    case 'schedule_added':
      return '/schedule';
    case 'session_recorded':
      return '/sessions';
  }
}

/** The subject line and the sentence that says what happened, for this reader. */
export function describe(
  event: NotificationEvent,
  org: Pick<NotifyingOrg, 'name'>,
  recipientId: string,
): { subject: string; lines: string[] } {
  switch (event.kind) {
    case 'user_added': {
      const isThem = recipientId === event.personId;
      return isThem
        ? {
            subject: `You have been added to ${org.name}`,
            lines: [`You have been added to ${org.name}'s tutoring portal.`],
          }
        : {
            subject: `${event.personName} was added to ${org.name}`,
            lines: [`${event.personName} has been added to ${org.name}'s tutoring portal.`],
          };
    }
    case 'plan_added':
      return {
        subject: `A learning plan for ${event.studentName}`,
        lines: [`A new learning plan has been set for ${event.studentName}.`],
      };
    case 'assessment_added':
      return {
        subject: `An assessment for ${event.studentName}`,
        lines: [`A new assessment has been recorded for ${event.studentName}.`],
      };
    case 'schedule_added':
      return {
        subject: `Lessons scheduled: ${event.studentName} with ${event.tutorName}`,
        lines: [
          `Regular lessons have been scheduled for ${event.studentName} with ${event.tutorName}:`,
          event.when,
        ],
      };
    case 'session_recorded':
      return {
        subject: `Lesson recorded: ${event.studentName} with ${event.tutorName}`,
        lines: [`${event.studentName}'s lesson with ${event.tutorName} has been recorded:`, event.when],
      };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The message itself: plain text, and a simple branded HTML version of the same words. */
export function compose(
  event: NotificationEvent,
  org: Pick<NotifyingOrg, 'name' | 'palette'>,
  recipient: Pick<Recipient, 'id' | 'full_name'>,
  link: string,
): { subject: string; text: string; html: string } {
  const { subject, lines } = describe(event, org, recipient.id);
  const greeting = `Hello ${recipient.full_name},`;
  const footer = `You are receiving this because ${org.name} has email notifications turned on.`;
  const text = [
    greeting,
    '',
    ...lines,
    '',
    `Open the portal: ${link}`,
    '',
    `-- ${org.name}`,
    footer,
  ].join('\n');

  const color = ORG_PALETTE_HEX[org.palette] ?? ORG_PALETTE_HEX.platform;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1f23">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6ea">
<div style="background:${color};color:#ffffff;padding:16px 24px;font-weight:600;font-size:16px">${escapeHtml(org.name)}</div>
<div style="padding:24px;font-size:15px;line-height:1.5">
<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
${lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join('\n')}
<p style="margin:20px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open the portal</a></p>
</div>
<div style="padding:12px 24px;font-size:12px;color:#6b6b76;border-top:1px solid #eeeef1">${escapeHtml(footer)}</div>
</div></body></html>`;

  return { subject, text, html };
}

/** Cloudflare's reason, without any address it may have quoted. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[^\s<>()"']+@[^\s<>()"']+/g, '[address]').slice(0, 300);
}

/**
 * Sends one action's emails, after the response. Never throws, never delays
 * the action, and does nothing at all while the organization's flag is off.
 * `org` may be just an id (the sweep), in which case it is read here.
 */
export function notify(mailer: Mailer, org: NotifyingOrg | OrgId, event: NotificationEvent): void {
  if (typeof org !== 'string' && !org.email_notifications) return;
  mailer.waitUntil(
    deliver(mailer.env, org, event).catch((error) => {
      console.error('Notification failed', event.kind, reasonOf(error));
    }),
  );
}

async function deliver(env: Env, orgOrId: NotifyingOrg | OrgId, event: NotificationEvent): Promise<void> {
  const org: NotifyingOrg | null =
    typeof orgOrId === 'string'
      ? await getOrganizationById(env.DB, orgOrId).then((found) =>
          found ? { ...found, id: orgIdFromRow(found.id) } : null,
        )
      : orgOrId;
  if (!org || !org.email_notifications) return;

  const recipients = (await recipientsFor(env.DB, org.id, audienceFor(event))).filter(
    (recipient) => recipient.id !== event.actorId,
  );
  if (recipients.length === 0) return;

  const base = (env.PUBLIC_URL ?? '').replace(/\/+$/, '');
  const link = `${base}${pathFor(event)}?${ORG_QUERY_PARAM}=${encodeURIComponent(org.slug)}`;
  const subjectId = subjectIdOf(event);
  const rows: LogRow[] = [];

  for (const recipient of recipients) {
    const message = compose(event, org, recipient, link);
    let status: NotificationStatus;
    let detail: string | null = null;

    if (!env.EMAIL) {
      status = 'skipped';
      detail = 'No mail binding on this deployment.';
    } else if (!env.EMAIL_FROM) {
      status = 'skipped';
      detail = 'No sender address configured (EMAIL_FROM).';
    } else {
      try {
        await env.EMAIL.send({
          from: { name: org.name, email: env.EMAIL_FROM },
          to: recipient.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        status = 'sent';
      } catch (error) {
        status = 'failed';
        detail = reasonOf(error);
      }
    }

    rows.push({ kind: event.kind, subjectId, recipientId: recipient.id, status, detail });
  }

  await logNotifications(env.DB, org.id, rows);
}
