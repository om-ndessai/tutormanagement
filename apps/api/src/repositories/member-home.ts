import {
  HOME_FOCUS_ACTIVITY_DAYS,
  UNRECORDED_LOOKBACK_DAYS,
  addDays,
  childGrade,
  deriveHomeFocus,
  homeFocusOptions,
  weekOf,
  cancellationKey,
  expandUpcoming,
  featureOn,
  parseClockTime,
  partOfDay,
  upcomingTakenKey,
  weekdayOf,
  zonedClockParts,
  type Arrival,
  type HomeChild,
  type HomeFocus,
  type HomeHat,
  type HomeLearner,
  type HomeLesson,
  type HomeOffice,
  type HomeTutor,
  type MemberHome,
  type ScheduledSession,
  type TutorHomeLesson,
  type User,
} from '@tmi/shared';

import type { OrgContext, OrgId } from '../lib/org.js';
import { pairingInForce } from '../lib/scope.js';
import { buildTutorHome, placeFor, tutorSchedules } from './home.js';
import { nextQuestReview } from './quest.js';
import { getPlatformAccount } from './people.js';
import { hasFollowableStudent } from './progress.js';
import { listCancellationsForSchedules } from './schedule-cancellations.js';
import { listSchedules } from './schedules.js';
import { getVisibleSession } from './sessions.js';
import { clock, daysBetween, occurrences, unrecordedOf, type Occurrence } from './lessons-owed.js';
import { myDraftsByLesson } from './session-drafts.js';

// The member home (Phase 66, docs/member-home-plan.md H1-H4, H9, H11): one read
// for the band, Next up and every hat's section. Each part is narrowed like its
// own route (R29): the tutor's own pairings (R19), the parent's own live
// children, the learner's own lessons and assessments, the office's counts.
// Nothing returned carries money.

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Monday of the week `day` falls in. */
function mondayOf(day: string): string {
  return addDays(day, -((weekdayOf(day) + 6) % 7));
}

/** Minutes from now (on the space's clock) until a lesson starts; negative once under way. */
function startsIn(today: string, now: number, occursOn: string, startTime: string): number {
  return daysBetween(today, occursOn) * 1440 + (parseClockTime(startTime) ?? 0) - now;
}

function homeLesson(schedule: ScheduledSession, occursOn: string, today: string, now: number): HomeLesson {
  const start = parseClockTime(schedule.start_time) ?? 0;
  return {
    schedule_id: schedule.id,
    occurs_on: occursOn,
    start_time: clock(start),
    end_time: clock(start + schedule.duration_minutes),
    mode: schedule.mode,
    student_user_id: schedule.student_user_id,
    student_name: schedule.student_name,
    tutor_user_id: schedule.tutor_user_id,
    tutor_name: schedule.tutor_name,
    starts_in: startsIn(today, now, occursOn, schedule.start_time),
    // Phase 74 (JF17): where, by name only (R16, R29).
    place: (() => {
      const place = placeFor(schedule.locations ?? [], schedule.mode);
      return place ? { name: place.name, kind: place.kind } : null;
    })(),
  };
}

// The occurrences and the "to record" rule are lessons-owed.ts's, shared with GET /api/sessions/to-record (Phase 75).
function lessonCounts(list: Occurrence[], cancelled: ReadonlySet<string>, today: string) {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const kept = list.filter((o) => !cancelled.has(cancellationKey(o.schedule.id, o.date)));
  return {
    lessons_today: kept.filter((o) => o.date === today).length,
    lessons_this_week: kept.filter((o) => o.date >= monday && o.date <= sunday).length,
  };
}

// --- The tutor (R19: their own pairings) -------------------------------------

async function tutorBlock(db: D1Database, org: OrgContext, viewer: User, nowIso: string): Promise<HomeTutor> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const from = addDays(today, -UNRECORDED_LOOKBACK_DAYS);
  const monday = mondayOf(today);
  const schedules = await tutorSchedules(db, org.id, viewer);

  const [nowCard, recorded, running, cancellations, assessments, quest, drafts] = await Promise.all([
    buildTutorHome(db, { id: org.id, time_zone: org.time_zone }, viewer, nowIso, schedules),
    db
      .prepare('SELECT student_user_id, occurred_on FROM sessions WHERE organization_id = ? AND tutor_user_id = ? AND occurred_on >= ?')
      .bind(org.id, viewer.id, from)
      .all<{ student_user_id: string; occurred_on: string }>(),
    db
      .prepare('SELECT student_user_id FROM active_sessions WHERE organization_id = ? AND tutor_user_id = ?')
      .bind(org.id, viewer.id)
      .all<{ student_user_id: string }>(),
    listCancellationsForSchedules(db, org.id, schedules.map((s) => s.id), { from: from < monday ? from : monday }),
    featureOn(org, 'assessment')
      ? db
          .prepare(
            `SELECT COUNT(*) AS n FROM canvas_assessments c
             WHERE c.organization_id = ? AND c.status = 'submitted' AND c.reviewed_at IS NULL
               AND EXISTS (SELECT 1 FROM assignments a WHERE a.organization_id = c.organization_id
                             AND a.student_user_id = c.student_user_id AND a.tutor_user_id = ? AND ${pairingInForce('a')})`,
          )
          .bind(org.id, viewer.id)
          .first<{ n: number }>()
      : Promise.resolve(null),
    featureOn(org, 'quest') ? nextQuestReview(db, org.id, { id: viewer.id, admin: false }) : Promise.resolve(null),
    // Phase 75 (JF19): the reader's own drafts of these lessons (R10), so Record continues one.
    myDraftsByLesson(db, org.id, viewer.id, from),
  ]);
  const draftOf = (o: { student_user_id: string; occurs_on: string }) =>
    drafts.get(upcomingTakenKey(viewer.id, o.student_user_id, o.occurs_on)) ?? null;

  const taken = new Set((recorded.results ?? []).map((r) => `${r.student_user_id}|${r.occurred_on}`));
  const live = new Set((running.results ?? []).map((r) => r.student_user_id));
  const cancelled = new Set(cancellations.map((c) => cancellationKey(c.schedule_id, c.occurs_on)));
  const all = occurrences(schedules, from < monday ? from : monday, addDays(monday, 6), today, now);
  const missing = unrecordedOf(
    all,
    (o) => taken.has(`${o.schedule.student_user_id}|${o.date}`),
    cancelled,
    (o) => live.has(o.schedule.student_user_id) && o.date === today,
  );

  const homeworkFor = new Map(nowCard.unrecorded.map((u) => [`${u.schedule_id}|${u.occurs_on}`, u.homework_last]));
  const toRecord = missing.slice(0, 5).map((o) => {
    const lesson = nowCard.unrecorded.find((u) => u.schedule_id === o.schedule.id && u.occurs_on === o.date);
    const base: TutorHomeLesson = lesson ?? {
      schedule_id: o.schedule.id,
      occurs_on: o.date,
      start_time: clock(parseClockTime(o.schedule.start_time) ?? 0),
      end_time: clock((parseClockTime(o.schedule.start_time) ?? 0) + o.schedule.duration_minutes),
      mode: o.schedule.mode,
      student_user_id: o.schedule.student_user_id,
      student_name: o.schedule.student_name,
      place: null,
      lessons_together: 0,
      together_since: null,
    };
    return { ...base, homework_last: homeworkFor.get(`${o.schedule.id}|${o.date}`) ?? null, draft: draftOf(base) };
  });

  return {
    now: { ...nowCard, unrecorded: nowCard.unrecorded.map((lesson) => ({ ...lesson, draft: draftOf(lesson) })) },
    next_starts_in: nowCard.next ? startsIn(today, now, nowCard.next.occurs_on, nowCard.next.start_time) : null,
    ...lessonCounts(all, cancelled, today),
    to_record: toRecord,
    to_record_count: missing.length,
    reviews: { assessments: assessments?.n ?? 0, quest: quest?.waiting ?? 0 },
  };
}

// --- The office (admins of a space that is not personal) ----------------------

const officeMemo = new Map<string, { at: number; value: HomeOffice }>();
const OFFICE_TTL_MS = 60_000;

interface OfficeScheduleRow {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  mode: ScheduledSession['mode'];
  starts_on: string;
  ends_on: string | null;
}

async function officeBlock(db: D1Database, org: OrgContext, nowIso: string): Promise<HomeOffice> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const cached = officeMemo.get(org.id);
  if (cached && Date.now() - cached.at < OFFICE_TTL_MS) return cached.value;

  const from = addDays(today, -UNRECORDED_LOOKBACK_DAYS);
  const monday = mondayOf(today);
  const lookFrom = from < monday ? from : monday;
  const tutoring = featureOn(org, 'tutoring');

  const [schedules, recorded, running, cancelled, requests, invited, openAssessments] = await Promise.all([
    tutoring
      ? db
          .prepare(
            `SELECT ss.id, ss.tutor_user_id, t.full_name AS tutor_name, ss.student_user_id, st.full_name AS student_name,
                    ss.day_of_week, ss.start_time, ss.duration_minutes, ss.mode, ss.starts_on, ss.ends_on
             FROM scheduled_sessions ss
             JOIN users t ON t.id = ss.tutor_user_id
             JOIN users st ON st.id = ss.student_user_id
             WHERE ss.organization_id = ? AND ss.is_active = 1 AND (ss.ends_on IS NULL OR ss.ends_on >= ?)`,
          )
          .bind(org.id, lookFrom)
          .all<OfficeScheduleRow>()
      : Promise.resolve({ results: [] as OfficeScheduleRow[] }),
    tutoring
      ? db
          .prepare('SELECT tutor_user_id, student_user_id, occurred_on FROM sessions WHERE organization_id = ? AND occurred_on >= ?')
          .bind(org.id, lookFrom)
          .all<{ tutor_user_id: string; student_user_id: string; occurred_on: string }>()
      : Promise.resolve({ results: [] }),
    tutoring
      ? db
          .prepare('SELECT tutor_user_id, student_user_id FROM active_sessions WHERE organization_id = ?')
          .bind(org.id)
          .all<{ tutor_user_id: string; student_user_id: string }>()
      : Promise.resolve({ results: [] }),
    tutoring
      ? db
          .prepare(
            `SELECT c.schedule_id, c.occurs_on FROM schedule_cancellations c
             JOIN scheduled_sessions ss ON ss.id = c.schedule_id
             WHERE ss.organization_id = ? AND c.occurs_on >= ?`,
          )
          .bind(org.id, lookFrom)
          .all<{ schedule_id: string; occurs_on: string }>()
      : Promise.resolve({ results: [] }),
    db
      .prepare('SELECT COUNT(*) AS n FROM join_requests WHERE organization_id = ? AND outcome IS NULL')
      .bind(org.id)
      .first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM org_members WHERE organization_id = ? AND status = 'invited' AND removed_at IS NULL")
      .bind(org.id)
      .first<{ n: number }>(),
    // Phase 74 (JF6): assessments submitted and not yet reviewed -- a count, where Assessment is on.
    featureOn(org, 'assessment')
      ? db
          .prepare("SELECT COUNT(*) AS n FROM canvas_assessments WHERE organization_id = ? AND status = 'submitted' AND reviewed_at IS NULL")
          .bind(org.id)
          .first<{ n: number }>()
      : Promise.resolve(null),
  ]);

  const series = (schedules.results ?? []).map(
    (r): ScheduledSession => ({ ...r, location: null, notes: null, is_active: true, locations: [], created_at: '', updated_at: '' }),
  );
  const taken = new Set((recorded.results ?? []).map((r) => upcomingTakenKey(r.tutor_user_id, r.student_user_id, r.occurred_on)));
  const live = new Set((running.results ?? []).map((r) => `${r.tutor_user_id}|${r.student_user_id}`));
  const cancelledSet = new Set((cancelled.results ?? []).map((c) => cancellationKey(c.schedule_id, c.occurs_on)));
  const all = occurrences(series, lookFrom, addDays(monday, 6), today, now);
  const missing = unrecordedOf(
    all,
    (o) => taken.has(upcomingTakenKey(o.schedule.tutor_user_id, o.schedule.student_user_id, o.date)),
    cancelledSet,
    (o) => o.date === today && live.has(`${o.schedule.tutor_user_id}|${o.schedule.student_user_id}`),
  );

  const value: HomeOffice = {
    to_record_count: missing.length,
    to_record: missing.slice(0, 3).map((o) => ({
      occurs_on: o.date,
      start_time: clock(parseClockTime(o.schedule.start_time) ?? 0),
      student_name: o.schedule.student_name,
      tutor_name: o.schedule.tutor_name,
    })),
    join_requests: requests?.n ?? 0,
    invitations: invited?.n ?? 0,
    ...lessonCounts(all, cancelledSet, today),
    ...(openAssessments ? { assessments_open: openAssessments.n } : {}),
  };
  officeMemo.set(org.id, { at: Date.now(), value });
  return value;
}

// --- The parent (their own live children here) --------------------------------

async function parentBlock(
  db: D1Database,
  org: OrgContext,
  viewer: User,
  children: { id: string; full_name: string; has_email: number }[],
  nowIso: string,
): Promise<{ children: HomeChild[] }> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const tutoring = featureOn(org, 'tutoring');
  const ids = new Set(children.map((c) => c.id));
  const monthStart = `${today.slice(0, 7)}-01`;

  const schedules = tutoring
    ? (await listSchedules(db, org.id, viewer, { include_inactive: false })).filter((s) => ids.has(s.student_user_id))
    : [];
  const [recorded, cancellations, lastRows, monthRows] = tutoring
    ? await Promise.all([
        db
          .prepare(
            `SELECT tutor_user_id, student_user_id, occurred_on FROM sessions
             WHERE organization_id = ? AND occurred_on >= ? AND student_user_id IN (SELECT value FROM json_each(?))`,
          )
          .bind(org.id, today, JSON.stringify([...ids]))
          .all<{ tutor_user_id: string; student_user_id: string; occurred_on: string }>(),
        listCancellationsForSchedules(db, org.id, schedules.map((s) => s.id), { from: today }),
        db
          .prepare(
            `SELECT s.id, s.student_user_id, s.occurred_on FROM sessions s
             WHERE s.organization_id = ? AND s.student_user_id IN (SELECT value FROM json_each(?))
               AND s.occurred_on = (SELECT MAX(x.occurred_on) FROM sessions x
                                    WHERE x.organization_id = s.organization_id AND x.student_user_id = s.student_user_id)`,
          )
          .bind(org.id, JSON.stringify([...ids]))
          .all<{ id: string; student_user_id: string; occurred_on: string }>(),
        db
          .prepare(
            `SELECT student_user_id, COUNT(*) AS n FROM sessions
             WHERE organization_id = ? AND occurred_on >= ? AND student_user_id IN (SELECT value FROM json_each(?))
             GROUP BY student_user_id`,
          )
          .bind(org.id, monthStart, JSON.stringify([...ids]))
          .all<{ student_user_id: string; n: number }>(),
      ])
    : [{ results: [] }, [], { results: [] }, { results: [] }];

  // Phase 68 (H10, R29): where Quest is on, this week's days played and today's Daily -- counts only --
  // and the level each child played last, for "Play with <child>". Phase 77 (JF15): in the same read as that level,
  // what decides the grade they play at with a parent (`childGrade`), and the newest running game the READER seated
  // them in, for "Continue with Ben" -- never another guardian's.
  const questOn = featureOn(org, 'quest');
  const childIds = JSON.stringify([...ids]);
  const [playedRows, dailyRows, levelRows] = questOn
    ? await Promise.all([
        db
          .prepare(
            `SELECT user_id, COUNT(*) AS n FROM activity_days
             WHERE organization_id = ? AND day >= ? AND (answers + game_answers + reviews) > 0
               AND user_id IN (SELECT value FROM json_each(?))
             GROUP BY user_id`,
          )
          .bind(org.id, weekOf(today), childIds)
          .all<{ user_id: string; n: number }>(),
        db
          .prepare(
            `SELECT DISTINCT user_id FROM daily_results
             WHERE organization_id = ? AND day = ? AND user_id IN (SELECT value FROM json_each(?))`,
          )
          .bind(org.id, today, childIds)
          .all<{ user_id: string }>(),
        db
          .prepare(
            `SELECT k.value AS user_id,
                    (SELECT m.quest_grade FROM org_members m WHERE m.organization_id = ?1 AND m.user_id = k.value) AS picked,
                    (SELECT s.quest_level_id FROM student_profiles s WHERE s.organization_id = ?1 AND s.user_id = k.value) AS recorded,
                    (SELECT s.current_math_course FROM student_profiles s WHERE s.organization_id = ?1 AND s.user_id = k.value) AS course,
                    (SELECT g.level_id FROM quest_game_players p
                       JOIN quest_games g ON g.organization_id = p.organization_id AND g.id = p.game_id
                      WHERE p.organization_id = ?1 AND p.user_id = k.value ORDER BY g.created_at DESC LIMIT 1) AS level_id,
                    (SELECT g.created_at FROM quest_game_players p
                       JOIN quest_games g ON g.organization_id = p.organization_id AND g.id = p.game_id
                      WHERE p.organization_id = ?1 AND p.user_id = k.value ORDER BY g.created_at DESC LIMIT 1) AS game_at,
                    (SELECT d.level_id FROM daily_results d
                      WHERE d.organization_id = ?1 AND d.user_id = k.value ORDER BY d.created_at DESC LIMIT 1) AS daily_level_id,
                    (SELECT d.created_at FROM daily_results d
                      WHERE d.organization_id = ?1 AND d.user_id = k.value ORDER BY d.created_at DESC LIMIT 1) AS daily_at,
                    (SELECT p.game_id FROM quest_game_players p
                       JOIN quest_games g ON g.organization_id = p.organization_id AND g.id = p.game_id
                      WHERE p.organization_id = ?1 AND p.user_id = k.value AND p.seated_by_user_id = ?2
                        AND g.status = 'running' AND g.started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 hours')
                      ORDER BY g.created_at DESC LIMIT 1) AS open_game_id
             FROM json_each(?3) AS k`,
          )
          .bind(org.id, viewer.id, childIds)
          .all<{
            user_id: string;
            picked: number | null;
            recorded: string | null;
            course: string | null;
            level_id: string | null;
            game_at: string | null;
            daily_level_id: string | null;
            daily_at: string | null;
            open_game_id: string | null;
          }>(),
      ])
    : [null, null, null];
  const childFacts = new Map((levelRows?.results ?? []).map((row) => [row.user_id, row]));

  const taken = new Set((recorded.results ?? []).map((r) => upcomingTakenKey(r.tutor_user_id, r.student_user_id, r.occurred_on)));
  const out: HomeChild[] = [];
  for (const child of children) {
    const mine = schedules.filter((s) => s.student_user_id === child.id);
    const cancelledSet = new Set(
      cancellations.filter((c) => mine.some((s) => s.id === c.schedule_id)).map((c) => cancellationKey(c.schedule_id, c.occurs_on)),
    );
    const upcoming = expandUpcoming(mine, nowIso, { offset: 0, limit: 6, taken, timeZone: org.time_zone }).items;
    const next = upcoming.find((u) => !cancelledSet.has(cancellationKey(u.schedule_id, u.occurs_on))) ?? null;
    const firstCancelled =
      upcoming.find((u) => cancelledSet.has(cancellationKey(u.schedule_id, u.occurs_on)) && u.occurs_on <= addDays(today, 7)) ?? null;
    const nextSchedule = next ? mine.find((s) => s.id === next.schedule_id) ?? null : null;
    const cancelledSchedule = firstCancelled ? mine.find((s) => s.id === firstCancelled.schedule_id) ?? null : null;

    // The homework set at their last lesson, as this parent may read it (the lesson's audience).
    const last = (lastRows.results ?? []).find((r) => r.student_user_id === child.id) ?? null;
    const lesson = last ? await getVisibleSession(db, org.id, viewer, last.id) : null;

    out.push({
      student_user_id: child.id,
      first_name: firstName(child.full_name),
      next_lesson: next && nextSchedule ? homeLesson(nextSchedule, next.occurs_on, today, now) : null,
      cancelled:
        firstCancelled && cancelledSchedule
          ? { occurs_on: firstCancelled.occurs_on, start_time: firstCancelled.start_time, tutor_name: firstName(cancelledSchedule.tutor_name) }
          : null,
      homework: lesson?.write_up?.homework_assigned ?? null,
      last_lesson_on: last?.occurred_on ?? null,
      lessons_this_month: (monthRows.results ?? []).find((r) => r.student_user_id === child.id)?.n ?? 0,
      days_played_this_week: playedRows ? ((playedRows.results ?? []).find((r) => r.user_id === child.id)?.n ?? 0) : null,
      daily_done_today: dailyRows ? (dailyRows.results ?? []).some((r) => r.user_id === child.id) : null,
      play_level_id: levelRows ? (childFacts.get(child.id)?.level_id ?? null) : null,
      // Phase 77 (JF15): a child who signs in is invited online; one who does not plays on the parent's device.
      signs_in: child.has_email === 1,
      grade: (() => {
        const facts = childFacts.get(child.id);
        if (!facts) return null;
        const played = (facts.daily_at ?? '') > (facts.game_at ?? '') ? facts.daily_level_id : facts.level_id;
        return childGrade({ picked: facts.picked, recorded: facts.recorded, course: facts.course, played });
      })(),
      open_game_id: childFacts.get(child.id)?.open_game_id ?? null,
    });
  }
  return { children: out };
}

// --- The learner (their own) -----------------------------------------------------

async function learnerBlock(db: D1Database, org: OrgContext, viewer: User, nowIso: string): Promise<HomeLearner> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const tutoring = featureOn(org, 'tutoring');
  const assessing = featureOn(org, 'assessment');

  const [schedules, recorded, inProgress, reviewed] = await Promise.all([
    tutoring && viewer.roles.includes('student')
      ? listSchedules(db, org.id, viewer, { include_inactive: false, student_user_id: viewer.id })
      : Promise.resolve([] as ScheduledSession[]),
    tutoring && viewer.roles.includes('student')
      ? db
          .prepare('SELECT tutor_user_id, student_user_id, occurred_on FROM sessions WHERE organization_id = ? AND student_user_id = ? AND occurred_on >= ?')
          .bind(org.id, viewer.id, today)
          .all<{ tutor_user_id: string; student_user_id: string; occurred_on: string }>()
      : Promise.resolve({ results: [] as { tutor_user_id: string; student_user_id: string; occurred_on: string }[] }),
    assessing
      ? db
          .prepare(
            `SELECT id, level_id, started_at FROM canvas_assessments
             WHERE organization_id = ? AND student_user_id = ? AND status = 'in_progress'
             ORDER BY started_at DESC LIMIT 1`,
          )
          .bind(org.id, viewer.id)
          .first<{ id: string; level_id: string; started_at: string }>()
      : Promise.resolve(null),
    assessing
      ? db
          .prepare(
            `SELECT id, level_id, reviewed_at FROM canvas_assessments
             WHERE organization_id = ? AND student_user_id = ? AND reviewed_at IS NOT NULL AND reviewed_at >= ?
             ORDER BY reviewed_at DESC LIMIT 1`,
          )
          .bind(org.id, viewer.id, addDays(today, -14))
          .first<{ id: string; level_id: string; reviewed_at: string }>()
      : Promise.resolve(null),
  ]);

  let nextLesson: HomeLesson | null = null;
  if (schedules.length > 0) {
    const taken = new Set((recorded.results ?? []).map((r) => upcomingTakenKey(r.tutor_user_id, r.student_user_id, r.occurred_on)));
    const cancellations = await listCancellationsForSchedules(db, org.id, schedules.map((s) => s.id), { from: today });
    const cancelled = new Set(cancellations.map((c) => cancellationKey(c.schedule_id, c.occurs_on)));
    const next =
      expandUpcoming(schedules, nowIso, { offset: 0, limit: 6, taken, timeZone: org.time_zone }).items.find(
        (u) => !cancelled.has(cancellationKey(u.schedule_id, u.occurs_on)),
      ) ?? null;
    const schedule = next ? schedules.find((s) => s.id === next.schedule_id) ?? null : null;
    if (next && schedule) nextLesson = homeLesson(schedule, next.occurs_on, today, now);
  }

  return { next_lesson: nextLesson, assessment_in_progress: inProgress ?? null, assessment_reviewed: reviewed ?? null };
}

// --- The whole home ---------------------------------------------------------------

export async function buildMemberHome(
  db: D1Database,
  org: OrgContext,
  viewer: User,
  nowIso = new Date().toISOString(),
): Promise<MemberHome> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const tutoring = featureOn(org, 'tutoring');
  const plays = featureOn(org, 'quest') || featureOn(org, 'assessment');

  // Which hats: one statement (a pairing in force as the tutor; live children here) and the account's band.
  const [facts, children, account] = await Promise.all([
    db
      .prepare(
        `SELECT EXISTS (SELECT 1 FROM assignments a WHERE a.organization_id = ? AND a.tutor_user_id = ? AND ${pairingInForce('a')}) AS tutors`,
      )
      .bind(org.id, viewer.id)
      .first<{ tutors: number }>(),
    db
      .prepare(
        `SELECT u.id, u.full_name, u.email IS NOT NULL AS has_email FROM guardianships g
         JOIN org_members m ON m.organization_id = g.organization_id AND m.user_id = g.dependent_user_id AND m.removed_at IS NULL
         JOIN users u ON u.id = g.dependent_user_id AND u.deleted_at IS NULL
         WHERE g.organization_id = ? AND g.guardian_user_id = ?
         ORDER BY u.full_name`,
      )
      .bind(org.id, viewer.id)
      .all<{ id: string; full_name: string; has_email: number }>(),
    getPlatformAccount(db, viewer.id),
  ]);

  // Phase 68 (H4): the pin, how they arrived, and what they did on how many days of the last two weeks.
  const since = addDays(today, -HOME_FOCUS_ACTIVITY_DAYS);
  const [focusFacts, mayAssess] = await Promise.all([
    db
      .prepare(
        `SELECT
           (SELECT home_pin FROM org_members WHERE organization_id = ?1 AND user_id = ?2) AS pin,
           (SELECT arrived_via FROM platform_accounts WHERE user_id = ?2) AS arrived_via,
           (SELECT COUNT(*) FROM activity_days
             WHERE organization_id = ?1 AND user_id = ?2 AND day >= ?3 AND (answers + game_answers) > 0) AS quest,
           (SELECT COUNT(DISTINCT substr(started_at, 1, 10)) FROM canvas_assessments
             WHERE organization_id = ?1 AND started_by_user_id = ?2 AND started_at >= ?3) AS assessment,
           (SELECT COUNT(DISTINCT occurred_on) FROM sessions
             WHERE organization_id = ?1 AND tutor_user_id = ?2 AND occurred_on >= ?3) AS tutoring`,
      )
      .bind(org.id, viewer.id, since)
      .first<{ pin: HomeFocus | null; arrived_via: Arrival | null; quest: number; assessment: number; tutoring: number }>(),
    // Someone to start an assessment for (UI audit JF1): oneself in a personal space, else a student they follow.
    // Read before the focus (Phase 79, M6): a member -- no role, nobody to follow -- in a shared space never gets an
    // assessment-led home or an assessment first step.
    featureOn(org, 'assessment')
      ? org.personal
        ? Promise.resolve(true)
        : hasFollowableStudent(db, org.id, viewer)
      : Promise.resolve(false),
  ]);

  const kids = children.results ?? [];
  const roles = viewer.roles;
  const hats: HomeHat[] = [];
  if (tutoring && facts?.tutors) hats.push('tutor');
  if (roles.includes('admin') && !org.personal) hats.push('office');
  if (kids.length > 0) hats.push('parent');
  if (roles.includes('student') || (!tutoring && plays)) hats.push('learner');
  // Nobody is left with an empty home: with no hat that has content, the one the roles imply, empty.
  if (hats.length === 0) {
    if (tutoring && roles.includes('tutor')) hats.push('tutor');
    else if (roles.includes('parent')) hats.push('parent');
    else if (roles.includes('admin')) hats.push('office');
    else hats.push('learner');
  }
  // Where there is no Tutoring (owner, 2026-11-05; JF6): what the reader came for leads -- a parent's child first, then
  // the office of a space they help run -- and playing follows; with neither, playing leads (the space is for practice).
  if (!tutoring) {
    const lead: HomeHat | undefined = (['parent', 'office', 'learner'] as const).find((hat) => hats.includes(hat));
    if (lead) hats.unshift(...hats.splice(hats.indexOf(lead), 1));
  }

  const focusOptions = homeFocusOptions(hats, { quest: featureOn(org, 'quest'), assessment: featureOn(org, 'assessment') && mayAssess });
  const pin = focusFacts?.pin && focusOptions.includes(focusFacts.pin) ? focusFacts.pin : null;
  const focus = deriveHomeFocus({
    pin,
    activity: { quest: focusFacts?.quest ?? 0, assessment: focusFacts?.assessment ?? 0, tutoring: focusFacts?.tutoring ?? 0 },
    arrived_via: focusFacts?.arrived_via ?? null,
    hats,
    options: focusOptions,
  });

  const [tutor, office, parent, learner] = await Promise.all([
    hats.includes('tutor') ? tutorBlock(db, org, viewer, nowIso) : Promise.resolve(null),
    hats.includes('office') ? officeBlock(db, org, nowIso) : Promise.resolve(null),
    hats.includes('parent') ? parentBlock(db, org, viewer, kids, nowIso) : Promise.resolve(null),
    hats.includes('learner') ? learnerBlock(db, org, viewer, nowIso) : Promise.resolve(null),
  ]);

  return {
    day: today,
    part_of_day: partOfDay(now),
    first_name: firstName(viewer.full_name),
    hats,
    personal: org.personal,
    tutor,
    office,
    parent,
    learner,
    may_bring_people: account?.age_band !== '13-17',
    may_assess: mayAssess,
    focus,
    pin,
    focus_options: focusOptions,
  };
}

/** Phase 68 (H4): the person's own "Make this my home" in this space (null for automatic). */
export async function setHomePin(db: D1Database, org: OrgId, userId: string, focus: HomeFocus | null): Promise<void> {
  await db
    .prepare(`UPDATE org_members SET home_pin = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE organization_id = ? AND user_id = ?`)
    .bind(focus, org, userId)
    .run();
}

/** For tests: forget the office memo. */
export function clearOfficeMemo(): void {
  officeMemo.clear();
}

