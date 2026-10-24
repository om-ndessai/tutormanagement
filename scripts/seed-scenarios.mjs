#!/usr/bin/env node
/**
 * The newer features' seed, written through the API (Phase 49).
 *
 * `db/seed.sql` holds the people, pairings, lessons and money. The features since Phase 38 are
 * shaped by code that SQL would only copy: an Assessment's PDF is built by the Worker (lib/pdf.ts),
 * Quest marks answers and keeps a points ledger, and a Quest Game lives in a Durable Object. So
 * this script makes them through the real routes, as the people concerned, with sign-in off
 * (X-Dev-User), and the seed can never drift from what the code writes.
 *
 * It acts only on the generated BULK families (an address ending in a number, such as
 * jordan.reyes12@gmail.com), never on the named cast the end-to-end suite asserts on. And it uses
 * Beast Academy Level 1 for Quest, which no test reads by count, so the Phase 49 rule that two right
 * answers approve a question changes nothing a test counts.
 *
 *   npm run seed:scenarios                         the local Worker (http://localhost:8787)
 *   npm run seed:scenarios -- --base=<url> --demo  the demo; leaves Assessment and Quest switched on
 *
 * Without --demo the organization's switches are put back as they were, so a fresh local database
 * still starts with both off, as the suite expects.
 */
const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:8787').replace(/\/$/, '');
const DEMO = args.includes('--demo');
const ORG = 'chmi';
const ADMIN = 'priya.raghavan@gmail.com';
const PLATFORM = 'ndessai@gmail.com';
const BULK = /\d@gmail\.com$/;
const QUEST_LEVEL = 'BA1';
const ASSESSMENT_LEVEL = 'NC26.4';

async function call(who, method, path, body, org = ORG) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'X-Dev-User': who,
      ...(org ? { 'X-Organization': org } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} as ${who}: ${response.status} ${json?.error?.message ?? text.slice(0, 200)}`);
  }
  return json?.data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Stable order, so a reseed makes the same choices. */
const byEmail = (a, b) => (a.email < b.email ? -1 : 1);

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`No Worker answers at ${BASE}. Start it with npm run dev:api.`);
  const config = await (await fetch(`${BASE}/api/auth/config`)).json();
  if (config.data.auth_enabled) throw new Error('Sign-in is on at that address; scenarios act through X-Dev-User. Refusing.');

  const before = await call(ADMIN, 'GET', '/organization/settings');
  await call(ADMIN, 'PATCH', '/organization/settings', {
    canvas_assessments: true,
    gamify_question_quest: true,
    canvas_assessments_unreviewed: false,
  });
  const made = { assessments: 0, reviewed: 0, answers: 0, reviews: 0, games: 0 };
  try {
    // The bulk pairings whose student signs in (has an address) and whose tutor does too.
    const pairings = (await call(ADMIN, 'GET', '/assignments'))
      .filter((a) => a.is_active)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    const students = (await call(ADMIN, 'GET', '/users?role=student&limit=100')).filter((u) => u.email && BULK.test(u.email));
    const tutors = (await call(ADMIN, 'GET', '/users?role=tutor&limit=100')).filter((u) => u.email && BULK.test(u.email));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const tutorById = new Map(tutors.map((t) => [t.id, t]));
    const pairs = pairings
      .filter((p) => studentById.has(p.student_user_id) && tutorById.has(p.tutor_user_id))
      .map((p) => ({ tutor: tutorById.get(p.tutor_user_id), student: studentById.get(p.student_user_id) }));
    const seenStudents = new Set();
    const chosen = pairs.filter(({ student }) => (seenStudents.has(student.id) ? false : seenStudents.add(student.id))).slice(0, 4);
    if (chosen.length < 2) throw new Error('The seed has fewer than two bulk pairings with addresses; regenerate it.');

    // 1. Assessments: one submitted and reviewed, one submitted and waiting, one in progress.
    for (const [i, { tutor, student }] of chosen.slice(0, 3).entries()) {
      const started = await call(tutor.email, 'POST', '/canvas-assessments', { student_user_id: student.id, level_id: ASSESSMENT_LEVEL });
      made.assessments += 1;
      if (i === 2) continue; // left in progress
      const taking = await call(tutor.email, 'GET', `/canvas-assessments/${started.id}`);
      const pages = taking.questions.map((q, n) => ({
        question_id: q.id,
        strokes: n % 3 === 2 ? [] : [`4 ${120 + n * 9} 220 ${260 + n * 7} 300 ${380 - n * 5} 260`],
        choice: q.kind === 'choice' ? n % 4 : null,
      }));
      await call(tutor.email, 'POST', `/canvas-assessments/${started.id}/submit`, { pages });
      if (i === 0) {
        const first = taking.questions[0].id;
        await call(tutor.email, 'PUT', `/canvas-assessments/${started.id}/review`, {
          notes: { [first]: 'Show the place values in a column before adding.' },
          comment: 'Good working throughout; check each answer against an estimate.',
          ink: [{ question_id: first, strokes: ['3 90 140 160 170 230 150'] }],
        });
        await call(tutor.email, 'POST', `/canvas-assessments/${started.id}/review/finish`);
        made.reviewed += 1;
      }
    }

    // 2. Question Quest at Beast Academy Level 1: a few answers each, some right, some reviewed.
    const keys = new Map(
      (await call(PLATFORM, 'GET', `/platform/questions?level_id=${QUEST_LEVEL}&status=checked&limit=200`, undefined, null)).map((q) => [
        q.id,
        q.answer,
      ]),
    );
    for (const [i, { tutor, student }] of chosen.entries()) {
      await call(tutor.email, 'PUT', `/quest/students/${student.id}/level`, { level_id: QUEST_LEVEL });
      for (let n = 0; n < 5; n += 1) {
        const state = await call(student.email, 'GET', '/quest/me');
        if (!state.question) break;
        // Right on even turns (and always for the first two students' first answer, which then
        // shows the two-right-answers approval in the console), wrong otherwise.
        const right = n % 2 === 0;
        const answer = right && keys.has(state.question.id) ? keys.get(state.question.id) : 'not this';
        await call(student.email, 'POST', '/quest/answers', { question_id: state.question.id, answer });
        made.answers += 1;
      }
      // The first two tutors work through part of their queue: approve, then flag one.
      if (i < 2) {
        for (let n = 0; n < 2; n += 1) {
          const queue = await call(tutor.email, 'GET', '/quest/review');
          if (!queue.item) break;
          const flag = n === 1 && i === 1;
          await call(
            tutor.email,
            'POST',
            `/quest/review/${queue.item.attempt_id}`,
            flag ? { decision: 'flag', note: 'The wording could be read two ways.' } : { decision: 'approve' },
          );
          made.reviews += 1;
        }
      }
    }

    // 3. Quest Games: a single player's game, and two players in a two-team game, both finished.
    const [one, two] = chosen;
    const playThrough = async (who, id, rightEvery) => {
      for (let n = 0; n < 40; n += 1) {
        const now = await call(who, 'GET', `/quest/games/${id}`);
        if (now.status === 'finished' || !now.me?.question) return;
        const q = now.me.question;
        const body = n % rightEvery === 0 && keys.has(q.id) ? { question_id: q.id, answer: keys.get(q.id) } : { question_id: q.id, skip: true };
        await call(who, 'POST', `/quest/games/${id}/answer`, body);
      }
    };
    const countdown = async (game) => {
      const wait = Date.parse(game.started_at) - Date.parse(game.now);
      if (wait > 0) await sleep(wait + 200);
    };
    const solo = await call(one.student.email, 'POST', '/quest/games', {
      level_id: ASSESSMENT_LEVEL,
      mode: 'count',
      question_count: 4,
      max_team_size: 1,
      players: 'single',
    });
    await countdown(solo);
    await playThrough(one.student.email, solo.id, 2);
    made.games += 1;

    const duel = await call(one.tutor.email, 'POST', '/quest/games', {
      level_id: ASSESSMENT_LEVEL,
      mode: 'count',
      question_count: 3,
      negative_marking: false,
      max_team_size: 1,
    });
    await call(one.student.email, 'POST', `/quest/games/${duel.id}/join`, { as: 'solo' });
    await call(two.student.email, 'POST', `/quest/games/${duel.id}/join`, { as: 'solo' });
    const running = await call(one.tutor.email, 'POST', `/quest/games/${duel.id}/start`);
    await countdown(running);
    await playThrough(one.student.email, duel.id, 1);
    await playThrough(two.student.email, duel.id, 3);
    const after = await call(one.tutor.email, 'GET', `/quest/games/${duel.id}`);
    if (after.status !== 'finished') await call(one.tutor.email, 'POST', `/quest/games/${duel.id}/end`);
    made.games += 1;
  } finally {
    if (!DEMO) {
      await call(ADMIN, 'PATCH', '/organization/settings', {
        canvas_assessments: before.canvas_assessments,
        gamify_question_quest: before.gamify_question_quest,
        canvas_assessments_unreviewed: before.canvas_assessments_unreviewed,
      });
    }
  }
  console.log(
    `seed-scenarios: ${made.assessments} assessments (${made.reviewed} reviewed), ${made.answers} Quest answers, ` +
      `${made.reviews} reviews, ${made.games} games${DEMO ? '; Assessment and Quest left on (demo)' : ''}.`,
  );
}

main().catch((error) => {
  console.error(`seed-scenarios: ${error.message}`);
  process.exit(1);
});
