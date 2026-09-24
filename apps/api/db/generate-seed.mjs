#!/usr/bin/env node
/**
 * Generates db/seed.sql at the scale docs/plan.md asks for: 2 admins,
 * 10 tutors, 30 parents, 50 students, plus the assignments, lessons, payments
 * and schedules that hang off them.
 *
 * Why generated rather than hand-written: a thousand rows of SQL cannot be
 * kept internally consistent by hand. Every student needs a guardian, every
 * session needs an assignment that authorises it, and every amount has to
 * equal rate x minutes / 60. Those invariants live here as code, so the seed
 * cannot drift into a state the API would have rejected.
 *
 * Deterministic on purpose: a fixed PRNG seed and derived ids mean the file
 * only changes when this script does, so a diff is reviewable and the
 * end-to-end tests see the same roster every run.
 *
 *   node db/generate-seed.mjs        # rewrites db/seed.sql
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- deterministic randomness ----------------------------------------------
let state = 0x2f6e2b1;
/** mulberry32: small, fast, and identical on every machine. */
function rnd() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/** Ids are derived from an index so they are stable across regenerations. */
const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'NULL' : String(v));

/** Batched so no single statement grows unreasonably large for D1. */
function insert(table, columns, rows, size = 40) {
  if (rows.length === 0) return '';
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    out.push(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n` +
        chunk.map((r) => `  (${r.join(', ')})`).join(',\n') +
        ';',
    );
  }
  return out.join('\n\n');
}

// --- the named cast ---------------------------------------------------------
// Kept exactly as it was, including every relationship between these people:
// the end-to-end suite asserts on them by name, and they cover the awkward
// combinations the plan calls out (an admin who tutors, a parent who tutors,
// a senior student who tutors younger children while being taught himself).
const U = (k) => id('00000000', k);

const CAST = {
  priya: U(1), dana: U(2), alex: U(3), maria: U(4), johan: U(5),
  sanjay: U(6), anita: U(7), sofia: U(8), ben: U(9), tom: U(10), grace: U(11),
};

const castUsers = [
  [q(CAST.priya), q('priya.raghavan@gmail.com'), q('Priya Raghavan'), q('(919) 555-0142'), q('active')],
  [q(CAST.dana), q('dana.whitfield@gmail.com'), q('Dana Whitfield'), q('(919) 555-0177'), q('invited')],
  [q(CAST.alex), q('alex.chen.math@gmail.com'), q('Alex Chen'), q('(984) 555-0113'), q('active')],
  [q(CAST.maria), q('maria.okafor@gmail.com'), q('Maria Okafor'), q('(919) 555-0155'), q('active')],
  [q(CAST.johan), q('j.lindqvist@gmail.com'), q('Johan Lindqvist'), 'NULL', q('suspended')],
  [q(CAST.sanjay), q('sanjay.patel.nc@gmail.com'), q('Sanjay Patel'), q('(919) 555-0198'), q('active')],
  [q(CAST.anita), q('anita.patel.nc@gmail.com'), q('Anita Patel'), q('(919) 555-0199'), q('active')],
  [q(CAST.sofia), q('sofia.okafor@gmail.com'), q('Sofia Okafor'), 'NULL', q('active')],
  // No address: a ten-year-old who never signs in. His parents read his
  // dashboard from their own logins.
  [q(CAST.ben), 'NULL', q('Ben Whitfield'), 'NULL', q('active')],
  [q(CAST.tom), q('tom.whitfield@gmail.com'), q('Tom Whitfield'), q('(919) 555-0121'), q('active')],
  [q(CAST.grace), q('grace.lee.nc@gmail.com'), q('Grace Lee'), q('(984) 555-0166'), q('active')],
];

const castRoles = [
  [CAST.priya, 'admin'], [CAST.priya, 'tutor'],
  [CAST.dana, 'admin'], [CAST.dana, 'parent'],
  [CAST.alex, 'tutor'],
  [CAST.maria, 'tutor'], [CAST.maria, 'parent'],
  [CAST.johan, 'tutor'],
  [CAST.sanjay, 'tutor'], [CAST.sanjay, 'student'],
  [CAST.anita, 'parent'],
  [CAST.sofia, 'student'],
  [CAST.ben, 'student'],
  [CAST.tom, 'parent'],
  [CAST.grace, 'parent'],
].map(([u, r]) => [q(u), q(r)]);

// --- name pools -------------------------------------------------------------
const FIRST = ['Amara','Beatriz','Caleb','Daniela','Elena','Farid','Grace','Hugo','Imani','Jonas',
  'Kiran','Lucia','Mateo','Nadia','Omar','Priya','Quinn','Rosa','Samir','Tomas','Uma','Vikram',
  'Wren','Ximena','Yusuf','Zara','Adeline','Bilal','Chloe','Dmitri','Esme','Felix','Georgia',
  'Hana','Idris','Jade','Kofi','Leila','Milo','Noor','Otto','Petra','Rafael','Sana','Theo',
  'Ursula','Viggo','Wanda','Yara','Zane'];
const LAST = ['Abara','Bennett','Castillo','Delgado','Eriksen','Fontaine','Gallagher','Haddad',
  'Iversen','Jensen','Kowalski','Lindgren','Moreau','Nakamura','Oyelaran','Pereira','Quintero',
  'Rossi','Silva','Tanaka','Ueda','Vargas','Whitaker','Xu','Yilmaz','Zambrano'];

const SCHOOLS = ['Culbreth Middle','Ephesus Elementary','East Chapel Hill High','Smith Middle',
  'Carrboro High','Glenwood Elementary','McDougle Middle','Chapel Hill High','Seawell Elementary',
  'Phillips Middle'];
const AREAS = ['Chapel Hill','Carrboro','Durham','Cary','Hillsborough','Morrisville','Apex'];
const COURSES = ['Grade 4 Mathematics','Grade 5 Mathematics','Grade 6 Mathematics',
  'Grade 7 Mathematics','Pre-Algebra','Algebra I','Geometry','Algebra II','Pre-Calculus',
  'AP Calculus AB','AP Calculus BC','AP Statistics'];
const GOALS = ['Move up to the accelerated track next year.','Confidence with fractions and word problems.',
  'Score 5 on the AP exam.','Bring the end-of-year grade up a full letter.','Stop freezing on timed tests.',
  'Get ready for the placement test in spring.','Keep up with the accelerated class.',
  'Master multi-step word problems.'];
const EDUCATION = ['PhD, Mathematics','MS, Applied Mathematics','MSc, Statistics','BS, Mathematics',
  'BS, Physics','MEd, Mathematics Education','Grade 12 - AP Calculus BC','Grade 11 - Pre-Calculus'];
const NOTES = ['Covered the week’s homework and two past-paper questions.',
  'Worked through fractions; needed scaffolding but got there.',
  'Word problems. Much better at extracting the operation from the sentence.',
  'Timed drill, then reviewed the mistakes together.',
  'Introduced the new unit. Set practice problems 1-12.',
  'Reviewed the test. Errors were arithmetic rather than method.',
  'Good session — worked independently for most of it.',
  'Slower going today; revisited last week’s material.'];

// --- generated people -------------------------------------------------------
const users = [...castUsers];
const roles = [...castRoles];
const usedEmails = new Set(castUsers.map((r) => r[1]));

let seq = 0;
function makePerson(prefix) {
  seq += 1;
  const first = pick(FIRST);
  const last = pick(LAST);
  const name = `${first} ${last}`;
  // Sequence-suffixed so two people with the same drawn name never collide on
  // the unique email index.
  const email = `${first}.${last}${seq}@gmail.com`.toLowerCase();
  if (usedEmails.has(q(email))) throw new Error(`duplicate email ${email}`);
  usedEmails.add(q(email));

  return { id: id(prefix, seq), name, email, phone: `(919) 555-${String(1000 + seq).slice(-4)}` };
}

// 5 more tutors -> 10 with the cast's five.
const genTutors = Array.from({ length: 5 }, () => makePerson('11111111'));
// 25 more parents -> 30.
const genParents = Array.from({ length: 25 }, () => makePerson('22222222'));
// 47 more students -> 50.
const genStudents = Array.from({ length: 47 }, () => makePerson('33333333'));

for (const person of [...genTutors, ...genParents]) {
  users.push([q(person.id), q(person.email), q(person.name), q(person.phone), q('active')]);
}

// Most students are children with no address of their own: they never sign in,
// and their parents read their dashboard from their own login. A few older ones
// have one, so both paths are covered by the fixtures.
for (const person of genStudents) {
  const email = rnd() < 0.25 ? q(person.email) : 'NULL';
  users.push([q(person.id), email, q(person.name), q(person.phone), q('active')]);
}
for (const t of genTutors) roles.push([q(t.id), q('tutor')]);
for (const p of genParents) roles.push([q(p.id), q('parent')]);
for (const s of genStudents) roles.push([q(s.id), q('student')]);

// --- profiles ---------------------------------------------------------------
const tutorProfiles = [
  [q(CAST.priya), q('PhD, Mathematics'), q('UNC Chapel Hill'), q('Chapel Hill'), q('Limited hours during term planning weeks.'), 1, 9000, 8000],
  [q(CAST.alex), q('MS, Applied Mathematics'), q('NC State'), q('Cary'), q('Prefers back-to-back sessions.'), 1, 7500, 6500],
  [q(CAST.maria), q('BS, Statistics'), q('Duke'), q('Durham'), q('In person only during school holidays.'), 0, 6000, 'NULL'],
  [q(CAST.johan), q('MSc, Mathematics'), q('Lund University'), q('Chapel Hill'), 'NULL', 1, 7000, 6000],
  [q(CAST.sanjay), q('Grade 12 - AP Calculus BC'), q('East Chapel Hill High'), q('Chapel Hill'), q('Only after 5pm on weekdays.'), 1, 3500, 3000],
];
for (const t of genTutors) {
  const inPerson = between(45, 95) * 100;
  tutorProfiles.push([
    q(t.id), q(pick(EDUCATION)), q(pick(SCHOOLS)), q(pick(AREAS)),
    rnd() < 0.4 ? q('Term-time only.') : 'NULL',
    rnd() < 0.7 ? 1 : 0,
    inPerson,
    // Virtual is usually a little cheaper, and sometimes not offered.
    rnd() < 0.8 ? inPerson - between(5, 15) * 100 : 'NULL',
  ]);
}

// The longest lesson each tutor will teach. Appended last so the rate columns
// the assignment step reads by index keep their positions.
const TUTOR_MAX = { [CAST.priya]: 180, [CAST.alex]: 180, [CAST.maria]: 120, [CAST.johan]: 180, [CAST.sanjay]: 120 };
for (const row of tutorProfiles) {
  const id = row[0].slice(1, -1);
  row.push(TUTOR_MAX[id] ?? pick([120, 180, 240, 'NULL']));
}

// The level each tutor's advance is kept above. Most of the cast is on one, so
// the dashboards have something to show; Johan is not, which is the case where
// no top-up is ever due.
const TUTOR_TOPUP = {
  [CAST.priya]: 30000, [CAST.dana]: 'NULL', [CAST.alex]: 20000,
  [CAST.maria]: 15000, [CAST.johan]: 'NULL', [CAST.sanjay]: 5000,
};
// Keyed for the payment step below, which has to pay an advance tutor AHEAD of
// what they have earned rather than behind it.
const topupByTutor = new Map();
for (const row of tutorProfiles) {
  const id = row[0].slice(1, -1);
  const topup = TUTOR_TOPUP[id] ?? pick([10000, 15000, 20000, 'NULL']);
  row.push(topup);
  topupByTutor.set(id, topup === 'NULL' ? null : topup);
}

// Whether the office has each tutor's SSN -- the fact only, never the number.
// Alex and Johan have not handed theirs over, so both dashboards have the
// "action needed" case to show.
const SSN_ON_FILE = {
  [CAST.priya]: q('2026-01-12'), [CAST.dana]: q('2026-01-19'), [CAST.alex]: 'NULL',
  [CAST.maria]: q('2026-02-02'), [CAST.johan]: 'NULL', [CAST.sanjay]: q('2026-01-30'),
};
for (const row of tutorProfiles) {
  const id = row[0].slice(1, -1);
  row.push(SSN_ON_FILE[id] ?? (rnd() < 0.8 ? q('2026-01-15') : 'NULL'));
}

// Each tutor's mailing address, for their 1099. Johan has not given one, so
// the year-end panel has the "no full address" case to show. The streets are
// invented; the ZIPs are real ones for each town so the format is honest.
const ZIP_BY_AREA = {
  'Chapel Hill': '27514', Carrboro: '27510', Durham: '27705', Cary: '27513',
  Hillsborough: '27278', Morrisville: '27560', Apex: '27502',
};
const STREETS = ['Maple Street', 'Oak Avenue', 'Laurel Hill Road', 'Weaver Dairy Road', 'Kildaire Farm Road', 'Hope Valley Road', 'Old Chapel Hill Road', 'Glenwood Avenue'];
const TUTOR_ADDRESS = {
  [CAST.priya]: ['214 Laurel Hill Road', 'NULL', 'Chapel Hill', '27514'],
  [CAST.alex]: ['88 Kildaire Farm Road', 'Apt 12', 'Cary', '27513'],
  [CAST.maria]: ['1507 Hope Valley Road', 'NULL', 'Durham', '27705'],
  [CAST.johan]: null,
  [CAST.sanjay]: ['39 Weaver Dairy Road', 'NULL', 'Chapel Hill', '27514'],
};
// Derived from the row's position, not drawn from rnd(): an extra draw here
// would shift every random value generated after it, reshuffling the bulk data.
tutorProfiles.forEach((row, position) => {
  const id = row[0].slice(1, -1);
  const area = row[3].slice(1, -1);
  const known = id in TUTOR_ADDRESS ? TUTOR_ADDRESS[id] : undefined;
  const address =
    known === undefined
      ? position % 7 === 0 || !ZIP_BY_AREA[area]
        ? null
        : [`${100 + ((position * 37) % 2900)} ${STREETS[position % STREETS.length]}`, 'NULL', area, ZIP_BY_AREA[area]]
      : known;

  if (!address) {
    row.push('NULL', 'NULL', 'NULL', 'NULL', 'NULL');
  } else {
    const [line1, line2, city, zip] = address;
    row.push(q(line1), line2 === 'NULL' ? 'NULL' : q(line2), q(city), q('NC'), q(zip));
  }
});

// What the institute CHARGES each family, per hour. Always above what the
// tutor is paid for the same lesson -- the difference is the margin, and the
// whole reason these are separate from the tutor's rates.
const studentCharge = {
  [CAST.sanjay]: { in: 12000, virt: 10500 }, // Priya is paid 9000 / 8000.
  [CAST.sofia]: { in: 10000, virt: 8500 }, //  Alex is paid 7500 / 6500.
  [CAST.ben]: { in: 9500, virt: 8000 }, //    Alex 7000, Sanjay 3500 / 3000.
};

const studentProfiles = [
  [q(CAST.sanjay), q('East Chapel Hill High'), q('AP Calculus BC'), q('Score 5 on the AP exam.'), 1],
  [q(CAST.sofia), q('Culbreth Middle'), q('Grade 7 Mathematics'), q('Move up to the accelerated track next year.'), 1],
  [q(CAST.ben), q('Ephesus Elementary'), q('Grade 5 Mathematics'), q('Confidence with fractions and word problems.'), 0],
];
for (const s of genStudents) {
  studentProfiles.push([q(s.id), q(pick(SCHOOLS)), q(pick(COURSES)), q(pick(GOALS)), rnd() < 0.6 ? 1 : 0]);
}

// --- guardianships ----------------------------------------------------------
// Every student gets at least one parent, which the API requires and the seed
// must therefore honour.
const guardianships = [
  [q(CAST.maria), q(CAST.sofia), q('mother'), 1],
  [q(CAST.dana), q(CAST.ben), q('mother'), 1],
  [q(CAST.tom), q(CAST.ben), q('father'), 0],
  [q(CAST.anita), q(CAST.sanjay), q('mother'), 1],
];
genStudents.forEach((student, index) => {
  const primary = genParents[index % genParents.length];
  guardianships.push([q(primary.id), q(student.id), q(pick(['mother', 'father', 'guardian'])), 1]);

  // Roughly a third of families have a second contact.
  if (rnd() < 0.35) {
    const second = genParents[(index + 7) % genParents.length];
    if (second.id !== primary.id) {
      guardianships.push([q(second.id), q(student.id), q(pick(['mother', 'father', 'other'])), 0]);
    }
  }
});

// --- payment handles --------------------------------------------------------
const handles = [
  [q(CAST.alex), q('zelle'), q('alex.chen.math@gmail.com')],
  [q(CAST.alex), q('venmo'), q('@alex-chen-math')],
  [q(CAST.maria), q('zelle'), q('(919) 555-0155')],
  [q(CAST.sanjay), q('venmo'), q('@sanjay-patel-nc')],
  [q(CAST.anita), q('zelle'), q('anita.patel.nc@gmail.com')],
  [q(CAST.tom), q('venmo'), q('@tom-whitfield')],
  [q(CAST.grace), q('zelle'), q('(984) 555-0166')],
];
for (const t of genTutors) {
  handles.push([q(t.id), q(rnd() < 0.5 ? 'zelle' : 'venmo'), q(t.email)]);
}
for (const p of genParents) {
  if (rnd() < 0.7) handles.push([q(p.id), q(rnd() < 0.6 ? 'zelle' : 'venmo'), q(p.email)]);
}

// --- availability -----------------------------------------------------------
const slots = [
  [q(CAST.priya), 3, 14], [q(CAST.priya), 3, 15],
  [q(CAST.alex), 2, 16], [q(CAST.alex), 2, 17], [q(CAST.alex), 4, 16],
  [q(CAST.alex), 4, 17], [q(CAST.alex), 6, 10], [q(CAST.alex), 6, 11],
  [q(CAST.maria), 6, 10],
  [q(CAST.sanjay), 1, 17], [q(CAST.sanjay), 3, 17],
  [q(CAST.sofia), 2, 16], [q(CAST.sofia), 4, 16],
  [q(CAST.ben), 6, 10],
];
const seenSlot = new Set(slots.map((s) => s.join('|')));
function addSlots(personId, count, hours) {
  for (let i = 0; i < count; i += 1) {
    const day = between(1, 6);
    const hour = pick(hours);
    const key = `${q(personId)}|${day}|${hour}`;
    if (seenSlot.has(key)) continue;
    seenSlot.add(key);
    slots.push([q(personId), day, hour]);
  }
}
// Tutors offer after-school and weekend hours; students pick fewer.
for (const t of genTutors) addSlots(t.id, between(4, 7), [15, 16, 17, 18, 19, 10, 11]);
for (const s of genStudents) addSlots(s.id, between(2, 4), [16, 17, 18, 10, 11]);

// --- assignments ------------------------------------------------------------
// The cast's pairings are fixed: the suite asserts who can see whom, and a
// stray generated assignment would quietly change those answers.
const assignments = [
  { id: id('a0000000', 1), tutor: CAST.alex, student: CAST.sofia, inPerson: null, virtual: null, rate: { in: 7500, virt: 6500 }, notes: 'Weekly, building towards the accelerated track.' },
  { id: id('a0000000', 2), tutor: CAST.alex, student: CAST.ben, inPerson: 7000, virtual: null, rate: { in: 7000, virt: 6500 }, notes: 'Sibling-style discount agreed with the Whitfields.' },
  { id: id('a0000000', 3), tutor: CAST.sanjay, student: CAST.ben, inPerson: null, virtual: null, rate: { in: 3500, virt: 3000 }, notes: null },
  { id: id('a0000000', 4), tutor: CAST.priya, student: CAST.sanjay, inPerson: null, virtual: null, rate: { in: 9000, virt: 8000 }, notes: 'AP Calculus BC exam prep.' },
];

// Generated students are taught by generated tutors only, keeping the two
// groups' visibility graphs from overlapping.
const tutorRates = new Map(
  tutorProfiles.map((row) => [row[0], { in: Number(row[6]) || null, virt: row[7] === 'NULL' ? null : Number(row[7]) }]),
);
genStudents.forEach((student, index) => {
  const tutor = genTutors[index % genTutors.length];
  const base = tutorRates.get(q(tutor.id));
  const override = rnd() < 0.2 ? Math.max(3000, (base.in ?? 7000) - between(3, 10) * 100) : null;

  assignments.push({
    id: id('a1111111', index + 1),
    tutor: tutor.id,
    student: student.id,
    inPerson: override,
    virtual: null,
    rate: { in: override ?? base.in, virt: base.virt },
    notes: rnd() < 0.25 ? 'Weekly slot.' : null,
  });
});

// Generated students are priced off the rate their tutor is paid, marked up
// 20-40% and rounded to the nearest $5. Derived from the tutor's BASE rate, so
// a per-pairing discount reduces the cost and widens the margin rather than
// pushing the price below it.
const round5 = (cents) => Math.round(cents / 500) * 500;

for (const a of assignments.slice(4)) {
  const markup = 1.2 + rnd() * 0.2;
  const base = tutorRates.get(q(a.tutor));

  studentCharge[a.student] = {
    in: round5((base.in ?? 7000) * markup),
    virt: base.virt === null ? null : round5(base.virt * markup),
  };
}

// Now that every student has a price, append it to their profile row.
for (const row of studentProfiles) {
  const price = studentCharge[row[0].slice(1, -1)];
  row.push(price?.in ?? 'NULL', price?.virt ?? 'NULL');
}

// The longest a student sits, appended after their prices for the same reason.
// A nine-year-old's hour and a senior's two hours are both real: the SHORTER of
// this and the tutor's limit is what ends a running lesson.
const STUDENT_MAX = { [CAST.sanjay]: 120, [CAST.sofia]: 90, [CAST.ben]: 60 };
for (const row of studentProfiles) {
  const id = row[0].slice(1, -1);
  row.push(STUDENT_MAX[id] ?? pick([60, 90, 120, 'NULL']));
}

// --- sessions ---------------------------------------------------------------
const DAY_MS = 86400000;
const TODAY = Date.parse('2026-09-20T00:00:00Z');
const isoDay = (offsetDays) => new Date(TODAY - offsetDays * DAY_MS).toISOString().slice(0, 10);
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Columns: ... mode, tutor_rate, tutor_amount, charge_rate, charge_amount.
// Each amount is its rate x minutes / 60, and the charge always exceeds the
// pay -- the same invariants the API enforces.
const sessions = [
  [q(id('50000000', 1)), q(CAST.alex), q(CAST.sofia), q('2026-09-08'), q('16:00'), q('17:00'), 60, q('in_person'), 7500, 7500, 10000, 10000, q('Reviewed equivalent fractions. Confident on halves and quarters, shaky on thirds. Homework: worksheet 3a.'), q(CAST.alex)],
  [q(id('50000000', 2)), q(CAST.alex), q(CAST.sofia), q('2026-09-15'), q('16:00'), q('17:30'), 90, q('virtual'), 6500, 9750, 8500, 12750, q('Word problems. Much better at extracting the operation from the sentence. Goal check: on track for accelerated track.'), q(CAST.alex)],
  [q(id('50000000', 3)), q(CAST.alex), q(CAST.ben), q('2026-09-12'), q('10:00'), q('11:00'), 60, q('in_person'), 7000, 7000, 9500, 9500, q('Long division. Needed scaffolding but got there. Set 10 practice problems.'), q(CAST.alex)],
  [q(id('50000000', 4)), q(CAST.sanjay), q(CAST.ben), q('2026-09-13'), q('17:00'), q('18:00'), 60, q('virtual'), 3000, 3000, 8000, 8000, q('Times tables drill, 6s through 9s. Fast recall improving.'), q(CAST.sanjay)],
  [q(id('50000000', 5)), q(CAST.priya), q(CAST.sanjay), q('2026-09-10'), q('14:00'), q('15:30'), 90, q('in_person'), 9000, 13500, 12000, 18000, q('Related rates. Worked three past-paper questions. Assessment: exam-ready on this topic.'), q(CAST.priya)],
];

let sessionSeq = 0;
const earned = new Map();
const charged = new Map();

for (const a of assignments.slice(4)) {
  // Six weeks of history, not every week attended.
  for (let week = 0; week < 6; week += 1) {
    if (rnd() < 0.25) continue;

    const price = studentCharge[a.student];
    const virtual = a.rate.virt !== null && price?.virt != null && rnd() < 0.35;

    const rate = virtual ? a.rate.virt : a.rate.in;
    const chargeRate = virtual ? price?.virt : price?.in;
    if (!rate || !chargeRate) continue;

    const minutes = pick([45, 60, 60, 60, 75, 90]);
    const startMin = pick([15, 16, 17, 18, 10]) * 60;
    const amount = Math.round((rate * minutes) / 60);
    const chargeAmount = Math.round((chargeRate * minutes) / 60);

    sessionSeq += 1;
    sessions.push([
      q(id('51111111', sessionSeq)), q(a.tutor), q(a.student),
      q(isoDay(week * 7 + between(0, 3))),
      q(clock(startMin)), q(clock(startMin + minutes)), minutes,
      q(virtual ? 'virtual' : 'in_person'), rate, amount, chargeRate, chargeAmount,
      q(pick(NOTES)), q(a.tutor),
    ]);

    // The tutor is owed what they earned; the family owes what it was charged.
    earned.set(a.tutor, (earned.get(a.tutor) ?? 0) + amount);
    charged.set(a.student, (charged.get(a.student) ?? 0) + chargeAmount);
  }
}

// --- payments ---------------------------------------------------------------
const payments = [
  [q(id('60000000', 1)), q('from_parent'), q(CAST.maria), q(CAST.sofia), 7500, q('zelle'), q('2026-09-09T18:30:00.000Z'), 'NULL', q('For the 8 Sept lesson.'), q(CAST.priya)],
  [q(id('60000000', 2)), q('from_parent'), q(CAST.tom), q(CAST.ben), 7000, q('venmo'), q('2026-09-13T09:05:00.000Z'), 'NULL', 'NULL', q(CAST.priya)],
  [q(id('60000000', 3)), q('from_parent'), q(CAST.anita), q(CAST.sanjay), 10000, q('check'), q('2026-09-11T12:00:00.000Z'), q('1042'), q('Part payment.'), q(CAST.priya)],
  [q(id('60000000', 4)), q('to_tutor'), q(CAST.alex), 'NULL', 15000, q('zelle'), q('2026-09-16T10:00:00.000Z'), 'NULL', q('September, first half.'), q(CAST.priya)],
];

let paySeq = 0;
const guardianOf = new Map();
for (const g of guardianships) {
  const dependent = g[1];
  if (Number(g[3]) === 1) guardianOf.set(dependent, g[0]);
}

// Families have paid most, but not all, of what they owe.
for (const [studentId, total] of charged) {
  const payer = guardianOf.get(q(studentId));
  if (!payer || total === 0) continue;

  const paid = Math.round(total * pick([0.4, 0.6, 0.8, 1, 1])) ;
  if (paid <= 0) continue;

  paySeq += 1;
  payments.push([
    q(id('61111111', paySeq)), q('from_parent'), payer, q(studentId), paid,
    q(pick(['zelle', 'venmo', 'cash', 'check'])),
    q(new Date(TODAY - between(1, 20) * DAY_MS).toISOString()),
    'NULL', 'NULL', q(CAST.priya),
  ]);
}

// How each tutor has been paid, which depends on the arrangement they are on.
//
// A tutor with a top-up level is paid BEFORE they teach, so their payments add
// up to more than they have earned and the difference is the advance they are
// holding. Most are left comfortably above their level and a few below it, so
// the admin dashboard has both states to show. A tutor without a level is paid
// for work already done, which leaves them owed money instead.
//
// Tutors on an advance who have not taught yet still appear here: being paid
// up front is the whole point, so their advance is the money they hold.
const paidTutors = new Set([...earned.keys(), ...[...topupByTutor.entries()]
  .filter(([, topup]) => topup !== null)
  .map(([tutorId]) => tutorId)]);

for (const tutorId of paidTutors) {
  const total = earned.get(tutorId) ?? 0;
  const topup = topupByTutor.get(tutorId) ?? null;

  // 1.3 and 1.05 leave them above their level; 0.4 leaves them below it, and
  // that tutor is the one the office needs to act on.
  const paid =
    topup === null
      ? Math.round(total * pick([0.5, 0.7, 0.9]))
      : total + Math.round(topup * pick([1.3, 1.05, 1.3, 0.4]));

  if (paid <= 0) continue;

  paySeq += 1;
  payments.push([
    q(id('61111111', paySeq + 500)), q('to_tutor'), q(tutorId), 'NULL', paid,
    q(pick(['zelle', 'venmo'])),
    q(new Date(TODAY - between(1, 14) * DAY_MS).toISOString()),
    'NULL',
    q(topup === null ? 'Part payment for the term so far.' : 'Advance for the term.'),
    q(CAST.priya),
  ]);
}

// --- schedules --------------------------------------------------------------
const schedules = [
  [q(id('70000000', 1)), q(CAST.alex), q(CAST.sofia), 2, q('16:00'), 60, q('in_person'), q('2026-09-01'), q('2026-12-18'), q('Institute, room 2'), q('Weekly slot for Sofia.')],
  [q(id('70000000', 2)), q(CAST.alex), q(CAST.ben), 6, q('10:00'), 60, q('in_person'), q('2026-09-05'), 'NULL', q('Institute, room 1'), 'NULL'],
  [q(id('70000000', 3)), q(CAST.priya), q(CAST.sanjay), 4, q('17:00'), 90, q('virtual'), q('2026-09-03'), 'NULL', q('https://meet.example.com/ap-calc'), q('AP Calculus BC exam prep.')],
];

let schedSeq = 0;
for (const a of assignments.slice(4)) {
  // Around half of the pairings have a standing slot.
  if (rnd() < 0.5) continue;
  schedSeq += 1;

  const virtual = a.rate.virt !== null && rnd() < 0.3;
  schedules.push([
    q(id('71111111', schedSeq)), q(a.tutor), q(a.student),
    between(1, 6), q(clock(pick([15, 16, 17, 18]) * 60)), pick([45, 60, 60, 90]),
    q(virtual ? 'virtual' : 'in_person'),
    q('2026-09-01'), rnd() < 0.5 ? q('2026-12-18') : 'NULL',
    q(virtual ? 'https://meet.example.com/tmi' : `Institute, room ${between(1, 4)}`),
    'NULL',
  ]);
}

// --- emit -------------------------------------------------------------------
const counts = {
  admins: roles.filter((r) => r[1] === q('admin')).length,
  tutors: roles.filter((r) => r[1] === q('tutor')).length,
  parents: roles.filter((r) => r[1] === q('parent')).length,
  students: roles.filter((r) => r[1] === q('student')).length,
};

// --- comments ---------------------------------------------------------------
// Phase 12. Written only by people who can actually see the thing commented
// on, so the seed cannot demonstrate a visibility the API would refuse:
//   - a comment on a PERSON reaches admins, its author, that person and their
//     parents;
//   - a comment on a lesson, pairing or slot reaches everyone it concerns.
// Timestamps are explicit so the newest-first view has something to order.
const comments = [
  // On people.
  [q(id('c0000000', 1)), q(CAST.alex), q(CAST.ben), 'NULL', 'NULL', 'NULL',
   q('Ben asked to switch to Saturday mornings from November. Flagging so the office can check the room.'), q('2026-09-14T15:04:00.000Z')],
  [q(id('c0000000', 2)), q(CAST.priya), q(CAST.sanjay), 'NULL', 'NULL', 'NULL',
   q('Sanjay is taking on younger students this term as well as studying. Keep an eye on his total hours.'), q('2026-09-16T12:20:00.000Z')],
  [q(id('c0000000', 3)), q(CAST.anita), q(CAST.sanjay), 'NULL', 'NULL', 'NULL',
   q('He is away the last week of October — family trip.'), q('2026-09-17T09:12:00.000Z')],

  // On a lesson.
  [q(id('c0000000', 4)), q(CAST.maria), 'NULL', q(id('50000000', 2)), 'NULL', 'NULL',
   q('Sofia came out of this one delighted with herself. Thank you.'), q('2026-09-15T19:30:00.000Z')],
  [q(id('c0000000', 5)), q(CAST.alex), 'NULL', q(id('50000000', 2)), 'NULL', 'NULL',
   q('Worth repeating the sentence-to-operation drill next week while it is fresh.'), q('2026-09-16T08:02:00.000Z')],

  // On a pairing.
  [q(id('c0000000', 6)), q(CAST.priya), 'NULL', 'NULL', q(id('a0000000', 3)), 'NULL',
   q('Agreed with both families that Sanjay teaches Ben at the junior rate while he is still at school.'), q('2026-09-11T10:45:00.000Z')],

  // On a standing slot.
  [q(id('c0000000', 7)), q(CAST.alex), 'NULL', 'NULL', 'NULL', q(id('70000000', 1)),
   q('Room 2 is double-booked on the 24th; we will use room 1 that week only.'), q('2026-09-18T14:00:00.000Z')],
];


// --- cancelled lessons (Phase 24) --------------------------------------------
// One date of a standing schedule called off, by somebody that schedule
// concerns, in the capacity the API would record. Plain literals, drawing on
// neither random stream. Each is checked below to be a date the series falls
// on and one no lesson was recorded for -- the API refuses anything else, and
// the seed must not show what the API would not allow.
const scheduleCancellations = [
  // Alex/Sofia (Tuesdays): her mother, ahead of time.
  [q(id('70000000', 1)), q('2026-11-24'), q('Thanksgiving week — we are travelling.'), q(CAST.maria), q('parent'), q('2026-09-18T20:15:00.000Z')],
  // Alex/Ben (Saturdays): the tutor, marking a past one. Inside Ben's plan, so
  // it shows in his progress -- which Sanjay, who also teaches Ben but not on
  // this schedule, reads without the note.
  [q(id('70000000', 2)), q('2026-09-19'), q('Tutor unwell.'), q(CAST.alex), q('tutor'), q('2026-09-19T07:30:00.000Z')],
  // Priya/Sanjay (Thursdays): his mother, matching her comment about the trip.
  [q(id('70000000', 3)), q('2026-10-29'), q('Away the last week of October — family trip.'), q(CAST.anita), q('parent'), q('2026-09-17T09:15:00.000Z')],
];

for (const [scheduleId, date] of scheduleCancellations) {
  const schedule = schedules.find((row) => row[0] === scheduleId);
  const day = new Date(`${date.slice(1, -1)}T00:00:00Z`).getUTCDay();
  if (!schedule || schedule[3] !== day) throw new Error(`Seed cancellation ${date} is not a date its schedule falls on.`);
  if (sessions.some((row) => row[1] === schedule[1] && row[2] === schedule[2] && row[3] === date)) {
    throw new Error(`Seed cancellation ${date} has a lesson recorded on it.`);
  }
}

// --- lesson write-ups and assessments (Phase 23) ----------------------------
// Only on the named cast's lessons, and each assessment is by somebody that
// lesson concerns -- its tutor, the student, or the student's parent -- so the
// seed cannot show an assessment the API would refuse to take. Plain literals,
// drawing on neither random stream, so every row above stays as it was.
const writeUps = [
  // Alex with Sofia, 8 Sept: the first lesson, so nothing to review yet.
  [q(id('50000000', 1)), q('Equivalent fractions with fraction strips, then a first look at thirds.'),
   'NULL', 'NULL', q('none_set'), q('Worksheet 3a: equivalent fractions, all twelve.')],
  // Alex with Sofia, 15 Sept: reviews the 8th and its homework.
  [q(id('50000000', 2)), q('Word problems: turning the sentence into an operation.'),
   q('Recapped equivalent fractions. Thirds are much steadier than last week.'),
   q('Worksheet 3a finished; two slips on sixths, corrected together.'), q('done'),
   q('Five word problems from the green book, pages 22 and 23.')],
  // Priya with Sanjay, 10 Sept.
  [q(id('50000000', 5)), q('Related rates: past-paper practice under time.'),
   q('Implicit differentiation from last time is solid.'),
   q('About half of the implicit differentiation set was attempted.'), q('partial'),
   q('Finish the implicit differentiation set.')],
];

const sessionAssessments = [
  [q(id('50000000', 1)), q(CAST.sofia), q('student'), 3, q('Thirds are still confusing.'), q('2026-09-08T19:00:00.000Z')],
  [q(id('50000000', 2)), q(CAST.alex), q('tutor'), 4, q('Engaged throughout, and starting to check her own answers.'), q('2026-09-15T18:00:00.000Z')],
  [q(id('50000000', 2)), q(CAST.maria), q('parent'), 5, q('She came home and explained the problems to me.'), q('2026-09-15T20:10:00.000Z')],
  [q(id('50000000', 5)), q(CAST.priya), q('tutor'), 4, q('Exam-ready on this topic.'), q('2026-09-10T16:00:00.000Z')],
  [q(id('50000000', 5)), q(CAST.anita), q('parent'), 4, 'NULL', q('2026-09-11T08:30:00.000Z')],
].map((row) => [...row, row[row.length - 1]]);

// --- the student's reflection on a lesson (Phase 25) -------------------------
// Typed by the student where they can sign in, and by the tutor for Ben, who
// cannot -- the three ways a reflection is entered, minus the parent, which
// the suite exercises itself. Sofia's 8 Sept lesson keeps its Phase 23
// student assessment instead: those given before reflections still show.
// Columns: learned_new, difficulty, understanding, pace (difficulty and pace
// centred on 3), homework notes, comment, who typed it, as whom.
const sessionReflections = [
  [q(id('50000000', 2)), 4, 3, 4, 4, q('Problem 5 took me ages.'), 'NULL', q(CAST.sofia), q('student'), q('2026-09-15T20:30:00.000Z')],
  [q(id('50000000', 3)), 3, 4, 3, 2, q('Wants more practice on long division.'), 'NULL', q(CAST.alex), q('tutor'), q('2026-09-12T11:05:00.000Z')],
  [q(id('50000000', 5)), 4, 4, 5, 3, 'NULL', q('Related rates finally make sense.'), q(CAST.sanjay), q('student'), q('2026-09-10T19:40:00.000Z')],
].map((row) => [...row, row[row.length - 1]]);

// --- progress (Phase 16) ----------------------------------------------------
// Assessments, learning plans and lesson scores. Drawn from a SEPARATE random
// stream, and emitted after everything else, so adding them left every row
// above byte-for-byte what it was.
//
// Invariants kept here, as the API keeps them: one active plan per student,
// every plan starts before its goal date, every topic id is in the catalog,
// and a lesson is only scored for a student who has a plan. Scores drift
// upwards over a student's lessons -- tutoring working -- with the odd slip,
// so the charts have both shapes to show.
let progressState = 0x51a7e;
function prnd() {
  progressState |= 0;
  progressState = (progressState + 0x6d2b79f5) | 0;
  let t = Math.imul(progressState ^ (progressState >>> 15), 1 | progressState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ppick = (list) => list[Math.floor(prnd() * list.length)];
const pbetween = (lo, hi) => lo + Math.floor(prnd() * (hi - lo + 1));

/** Chapter counts per level, matching the catalog in db/schema.sql. */
const LEVEL_TOPICS = { BA1: 12, BA2: 12, BA3: 12, BA4: 12, BA5: 12, PRE: 15, ALG: 22, GEO: 19 };
const LADDER = ['BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO'];
const topic = (level, number) => `${level}.${String(number).padStart(2, '0')}`;

const assessments = [];
const assessmentRatings = [];
const plans = [];
const planTopics = [];
const sessionProgress = [];
const sessionRatings = [];

/**
 * One student's whole arc: an assessment, a plan built from the topics it
 * found weakest, and each lesson since scored against that plan.
 */
function progressFor(studentId, spec) {
  const assessmentId = spec.assessmentId;
  assessments.push([
    q(assessmentId), q(studentId), q(CAST.priya), q(spec.assessedOn), q(spec.schoolCourse),
    q(spec.recommended), q(spec.summary),
  ]);

  const baseline = new Map(spec.ratings);
  for (const [topicId, rating] of spec.ratings) {
    assessmentRatings.push([q(assessmentId), q(topicId), rating]);
  }

  if (!spec.plan) return;

  const planId = spec.plan.id;
  plans.push([
    q(planId), q(studentId), q(assessmentId), q(spec.plan.goal), q(spec.plan.target),
    q(spec.plan.startsOn), q(spec.plan.targetOn), spec.plan.perWeek, spec.plan.minutes,
    q(spec.plan.recommendation), q('active'), q(CAST.priya),
  ]);
  spec.plan.topics.forEach((topicId, position) => {
    planTopics.push([q(planId), q(topicId), position]);
  });

  // Walk the lessons in date order, nudging each plan topic's score upwards.
  const current = new Map(spec.plan.topics.map((t) => [t, baseline.get(t) ?? 1]));
  const lessons = sessions
    .filter((row) => row[2] === q(studentId) && row[3] >= q(spec.plan.startsOn))
    .sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0));

  lessons.forEach((row, index) => {
    // Most lessons get scored; a hurried few do not.
    if (index > 0 && prnd() < 0.15) return;

    const sessionId = row[0].slice(1, -1);
    // Work through the plan roughly in order, two or three topics a lesson.
    const focus = spec.plan.topics.slice(
      Math.min(index, spec.plan.topics.length - 1),
      Math.min(index, spec.plan.topics.length - 1) + pbetween(2, 3),
    );

    for (const topicId of focus) {
      const before = current.get(topicId) ?? 1;
      const step = prnd() < spec.pace ? 1 : prnd() < 0.15 ? -1 : 0;
      const after = Math.max(1, Math.min(5, before + step));
      current.set(topicId, after);
      sessionRatings.push([q(sessionId), q(topicId), after]);
    }

    const goal = Math.max(1, Math.min(5, Math.round(spec.pace * 5 + (prnd() - 0.5) * 2)));
    sessionProgress.push([q(sessionId), q(planId), goal]);
  });
}

// The named cast, written by hand so the suite can assert on them.
progressFor(CAST.sofia, {
  assessmentId: id('d0000000', 1),
  assessedOn: '2026-08-25',
  schoolCourse: 'Grade 5 math (school), finished BA3 at home',
  recommended: 'BA4',
  summary:
    'Sofia reads problems carefully and enjoys puzzles. Place value and multiplication are ' +
    'secure. Fractions are the gap: she can name halves and quarters but cannot compare ' +
    'unlike fractions or add them. Division with remainders is slow. Recommend starting in ' +
    'Beast Academy 4 and pulling the Level 3 fractions chapter forward before 4C.',
  ratings: [
    ['BA3.04', 5], ['BA3.07', 4], ['BA3.08', 3], ['BA3.10', 1], ['BA3.11', 3],
    ['BA4.02', 3], ['BA4.05', 2], ['BA4.08', 1], ['BA4.11', 1],
  ],
  pace: 0.75,
  plan: {
    id: id('e0000000', 1),
    goal: 'Ready for AoPS Prealgebra by the start of next school year',
    target: 'PRE',
    startsOn: '2026-09-01',
    targetOn: '2027-06-15',
    perWeek: 2,
    minutes: 60,
    recommendation:
      'Twice a week for an hour. Fractions first (BA3.10, then 4C and 4D), then the rest of ' +
      'Level 4 and the Level 5 chapters that Prealgebra leans on hardest.',
    topics: ['BA3.10', 'BA4.05', 'BA4.08', 'BA4.10', 'BA4.11', 'BA5.02', 'BA5.03', 'BA5.06', 'BA5.08'],
  },
});

progressFor(CAST.ben, {
  assessmentId: id('d0000000', 2),
  assessedOn: '2026-08-28',
  schoolCourse: 'Grade 4 math',
  recommended: 'BA3',
  summary:
    'Ben is quick with addition and subtraction but multiplication facts past 5 are not ' +
    'automatic, and long division has no model behind it yet. Start in Beast Academy 3B.',
  ratings: [['BA3.01', 4], ['BA3.04', 2], ['BA3.05', 2], ['BA3.08', 1], ['BA3.10', 2]],
  pace: 0.5,
  plan: {
    id: id('e0000000', 2),
    goal: 'Multiplication and division solid before Beast Academy 4',
    target: 'BA4',
    startsOn: '2026-09-01',
    targetOn: '2027-01-31',
    perWeek: 1,
    minutes: 60,
    recommendation: 'Once a week. Level 3B and 3C in order, with fractions last.',
    topics: ['BA3.04', 'BA3.05', 'BA3.06', 'BA3.08', 'BA3.10'],
  },
});

// Sanjay is assessed but has no plan yet: the "assessed, awaiting a plan" state.
progressFor(CAST.sanjay, {
  assessmentId: id('d0000000', 3),
  assessedOn: '2026-09-02',
  schoolCourse: 'AP Calculus BC',
  recommended: 'GEO',
  summary:
    'Strong algebra. Wants competition geometry alongside school calculus; circle theorems ' +
    'and power of a point are new to him.',
  ratings: [['GEO.11', 3], ['GEO.12', 2], ['GEO.13', 1]],
  pace: 0.8,
  plan: null,
});

// Everyone generated: most have been assessed and given a plan, a few have
// not been seen yet, which is the ordinary state of a new enrolment.
const castStudents = new Set([CAST.sofia, CAST.ben, CAST.sanjay].map(q));
const generatedStudents = [...new Set(sessions.map((row) => row[2]))].filter(
  (student) => !castStudents.has(student),
);

let progressSeq = 0;
for (const quoted of generatedStudents) {
  if (prnd() < 0.2) continue;
  progressSeq += 1;

  const studentId = quoted.slice(1, -1);
  const levelIndex = pbetween(1, 5);
  const level = LADDER[levelIndex];
  const lower = LADDER[levelIndex - 1];
  const next = LADDER[Math.min(levelIndex + 1, LADDER.length - 1)];

  const pool = [
    ...Array.from({ length: 3 }, () => topic(lower, pbetween(1, LEVEL_TOPICS[lower]))),
    ...Array.from({ length: 6 }, () => topic(level, pbetween(1, LEVEL_TOPICS[level]))),
  ];
  const topics = [...new Set(pool)];
  const ratings = topics.map((t) => [t, pbetween(1, 3)]);
  const hasPlan = prnd() < 0.85;

  progressFor(studentId, {
    assessmentId: id('d1111111', progressSeq),
    assessedOn: isoDay(pbetween(45, 60)),
    schoolCourse: ppick(COURSES),
    recommended: level,
    summary: `Placed at ${level}. Some gaps from ${lower} to close first.`,
    ratings,
    pace: ppick([0.35, 0.55, 0.7, 0.85]),
    plan: hasPlan
      ? {
          id: id('e1111111', progressSeq),
          goal: `Ready for ${next === 'PRE' ? 'AoPS Prealgebra' : next === 'ALG' ? 'Introduction to Algebra' : `Beast Academy ${next.slice(2)}`} by June`,
          target: next,
          startsOn: isoDay(pbetween(42, 44)),
          targetOn: ppick(['2027-01-31', '2027-03-31', '2027-06-15']),
          perWeek: ppick([1, 1, 2]),
          minutes: ppick([45, 60, 60, 90]),
          recommendation: null,
          topics,
        }
      : null,
  });
}

// A student's goal is one fact: once a plan is active, the profile carries the
// plan's goal, exactly as the API keeps them (goalSyncFromProfile /
// planGoalSyncStatement). Students without a plan keep their own.
for (const plan of plans) {
  if (plan[10] !== q('active')) continue;
  const profile = studentProfiles.find((row) => row[0] === plan[1]);
  if (profile) profile[3] = plan[3];
}

const sql = `-- ===========================================================================
--  Test and development seed  --  GENERATED FILE, DO NOT EDIT BY HAND
-- ===========================================================================
--  Regenerate with:  node db/generate-seed.mjs
--
--  Scale is what docs/plan.md asks of the test environment:
--    ${counts.admins} admins, ${counts.tutors} tutors, ${counts.parents} parents, ${counts.students} students
--    (${users.length} people in total -- the totals overlap because a person may hold
--     several roles, which is the whole point of the model)
--
--  The named cast at the top is fixed, including every relationship between
--  its members: the end-to-end suite asserts on them by name, and they cover
--  the combinations the plan calls out -- an admin who tutors, a parent who
--  tutors, a senior student who tutors younger children while being taught
--  himself. Generated people are only ever paired with each other, so adding
--  bulk cannot quietly change who can see whom.
--
--  Safe to re-run: it clears every table first. Never point it at production.
-- ===========================================================================

DELETE FROM session_reflections;
DELETE FROM schedule_cancellations;
DELETE FROM session_assessments;
DELETE FROM session_write_ups;
DELETE FROM session_drafts;
DELETE FROM session_topic_ratings;
DELETE FROM session_progress;
DELETE FROM learning_plan_topics;
DELETE FROM learning_plans;
DELETE FROM assessment_topic_ratings;
DELETE FROM assessments;
DELETE FROM comments;
DELETE FROM scheduled_sessions;
DELETE FROM active_sessions;
DELETE FROM payments;
DELETE FROM sessions;
DELETE FROM assignments;
DELETE FROM audit_events;
DELETE FROM guardianships;
DELETE FROM availability_slots;
DELETE FROM payment_handles;
DELETE FROM admin_profiles;
DELETE FROM student_profiles;
DELETE FROM tutor_profiles;
DELETE FROM user_roles;
DELETE FROM users;

-- --- people ----------------------------------------------------------------
${insert('users', ['id', 'email', 'full_name', 'phone', 'status'], users)}

-- --- what each of them does ------------------------------------------------
${insert('user_roles', ['user_id', 'role'], roles)}

-- --- admin-only data --------------------------------------------------------
-- The number the institute files its 1099s under. Not a person's, and not an
-- SSN: the API refuses one here as firmly as anywhere else.
${insert('admin_profiles', ['user_id', 'tin'], [
  [q(CAST.priya), q('47-2019388')],
  [q(CAST.dana), 'NULL'],
])}

-- --- tutor-only data -------------------------------------------------------
${insert('tutor_profiles', ['user_id', 'highest_education', 'school', 'area', 'availability_notes', 'virtual_available', 'default_rate_in_person_cents', 'default_rate_virtual_cents', 'max_session_minutes', 'topup_amount_cents', 'ssn_received_on', 'address_line1', 'address_line2', 'city', 'state', 'postal_code'], tutorProfiles)}

-- --- student-only data -----------------------------------------------------
${insert('student_profiles', ['user_id', 'school', 'current_math_course', 'academic_year_goal', 'virtual_available', 'charge_rate_in_person_cents', 'charge_rate_virtual_cents', 'max_session_minutes'], studentProfiles)}

-- --- who is responsible for whom -------------------------------------------
${insert('guardianships', ['guardian_user_id', 'dependent_user_id', 'relationship', 'is_primary'], guardianships)}

-- --- how money moves -------------------------------------------------------
${insert('payment_handles', ['user_id', 'method', 'handle'], handles)}

-- --- when people are free --------------------------------------------------
${insert('availability_slots', ['user_id', 'day_of_week', 'hour'], slots)}

-- --- who teaches whom, and at what price -----------------------------------
${insert('assignments', ['id', 'tutor_user_id', 'student_user_id', 'rate_in_person_cents', 'rate_virtual_cents', 'notes'],
  assignments.map((a) => [q(a.id), q(a.tutor), q(a.student), n(a.inPerson), n(a.virtual), a.notes ? q(a.notes) : 'NULL']))}

-- --- lessons that happened -------------------------------------------------
-- each amount = its rate x duration_minutes / 60, rounded, exactly as the
-- API computes it.
${insert('sessions', ['id', 'tutor_user_id', 'student_user_id', 'occurred_on', 'started_at', 'ended_at', 'duration_minutes', 'mode', 'tutor_rate_cents', 'tutor_amount_cents', 'charge_rate_cents', 'charge_amount_cents', 'notes', 'recorded_by_user_id'], sessions, 30)}

-- --- money that changed hands ----------------------------------------------
${insert('payments', ['id', 'direction', 'party_user_id', 'student_user_id', 'amount_cents', 'method', 'paid_at', 'reference', 'notes', 'recorded_by_user_id'], payments, 30)}

-- --- standing weekly lessons -----------------------------------------------
${insert('scheduled_sessions', ['id', 'tutor_user_id', 'student_user_id', 'day_of_week', 'start_time', 'duration_minutes', 'mode', 'starts_on', 'ends_on', 'location', 'notes'], schedules)}

-- --- single lessons of those called off (Phase 24) -------------------------
${insert('schedule_cancellations', ['schedule_id', 'occurs_on', 'note', 'cancelled_by_user_id', 'cancelled_as', 'created_at'], scheduleCancellations)}

-- --- what people have said about all of it ---------------------------------
${insert('comments', ['id', 'author_user_id', 'target_user_id', 'target_session_id', 'target_assignment_id', 'target_scheduled_session_id', 'body', 'created_at'], comments)}

-- --- where each student started, and where they are going (Phase 16) ------
-- The curriculum catalog itself is part of db/schema.sql, not of this file.
${insert('assessments', ['id', 'student_user_id', 'assessor_user_id', 'assessed_on', 'school_course', 'recommended_level_id', 'summary'], assessments)}

${insert('assessment_topic_ratings', ['assessment_id', 'topic_id', 'rating'], assessmentRatings, 80)}

${insert('learning_plans', ['id', 'student_user_id', 'assessment_id', 'goal', 'target_level_id', 'starts_on', 'target_on', 'sessions_per_week', 'session_minutes', 'recommendation', 'status', 'created_by_user_id'], plans)}

${insert('learning_plan_topics', ['plan_id', 'topic_id', 'position'], planTopics, 80)}

-- --- each lesson, scored against the plan ----------------------------------
${insert('session_progress', ['session_id', 'plan_id', 'goal_rating'], sessionProgress, 80)}

${insert('session_topic_ratings', ['session_id', 'topic_id', 'rating'], sessionRatings, 80)}

-- --- how lessons were written up, and what people thought of them (Phase 23)
${insert('session_write_ups', ['session_id', 'planned', 'previous_review', 'homework_review', 'homework_status', 'homework_assigned'], writeUps)}

${insert('session_assessments', ['session_id', 'author_user_id', 'author_role', 'rating', 'body', 'created_at', 'updated_at'], sessionAssessments)}

-- --- what the students made of their lessons (Phase 25) --------------------
${insert('session_reflections', ['session_id', 'learned_new', 'difficulty', 'understanding', 'pace', 'homework_notes', 'comment', 'entered_by_user_id', 'entered_as', 'created_at', 'updated_at'], sessionReflections)}
`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'seed.sql'), sql);

console.log(
  `seed.sql: ${users.length} users (${counts.admins} admin, ${counts.tutors} tutor, ` +
    `${counts.parents} parent, ${counts.students} student), ${assignments.length} assignments, ` +
    `${sessions.length} sessions, ${payments.length} payments, ${schedules.length} schedules, ` +
    `${comments.length} comments, ${assessments.length} assessments, ${plans.length} plans, ` +
    `${sessionProgress.length} scored lessons, ${writeUps.length} write-ups, ` +
    `${sessionAssessments.length} lesson assessments, ` +
    `${scheduleCancellations.length} cancelled lessons, ${sessionReflections.length} reflections`,
);
