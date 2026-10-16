# Curricula beyond Beast Academy: sources, editions, and an organization's choice

Plan only, written 2026-10-08. Nothing here is built or scheduled until the owner writes it into
`docs/plan.md` as phases. No file in the repository was changed while preparing it.

**Status: parked.** The owner read it on 2026-10-08 ("this looks good") and put it on hold while
another session builds the mobile app in this folder. It lives here, outside the repository, until
that work is done; then it is copied into `docs/` and its phases written into `docs/plan.md`.
Before building, re-check the line references against `main`: they were read on 2026-10-08.

Revised later the same day, after a second review of the parts that follow from "organizations
build their own". What changed is listed at the end.

## Context

Progress tracking (Phase 16) measures every student against one ladder: Beast Academy 1-5, then the
AoPS books. That ladder is the whole catalog (`curriculum_levels`, `curriculum_topics`: 8 levels,
116 topics). Every organization shares it, and nothing in the data says where it came from.

The goal is a catalog that can hold other curricula, starting with North Carolina's math standards;
that labels the existing ladder as Beast Academy; and that lets each organization choose what it
teaches from. The institute keeps Beast Academy only. A new organization starts on Beast Academy.

## Decisions taken

The owner's answers on 2026-10-08:

| Question | Decision |
| --- | --- |
| Curricula per organization | Several, with one default. |
| NC edition | Load both: the 2017 standards in classrooms now, and the 2026 standards adopted on 2026-10-01. |
| What one NC "topic" is | One numbered state standard, grouped by domain. |
| Other curricula | Organizations build their own, in the app. |

Mine, for the owner to strike if wrong:

- The existing ladder becomes one curriculum, **Beast Academy** (`ba`), which keeps the three AoPS
  books as its upper levels. The owner calls the whole ladder Beast Academy, and plans already
  cross from BA5 into Prealgebra.
- An organization's own admins choose, on the Organization page. The platform console does not: a
  new organization starts on Beast Academy and its first admin changes it.
- Wake, Chapel Hill-Carrboro and Orange are **not** separate curricula. They teach the same state
  standards in different packages and orders (see Findings), so at most they become "sequences"
  over the NC catalog, later.
- For the 2026 edition a topic is a numbered *standard* (`3.ANR.3`), with its objectives
  (`3.ANR.3.1` ...) in the description. See open point 1.

What the institute will notice. Phase A: nothing. Phase B, three small things: its admins get a
Curricula card on the Organization page; the plan dialog's example goal stops naming AoPS; and on a
student's page, topics with equal ratings list in ladder order, where today `ALG` sorts ahead of
`BA1`. No curriculum switch appears anywhere while it offers one curriculum.

## Findings

### What the code allows today

The catalog is data and the API checks ids against the database, so most of the portal is already
curriculum-agnostic: `computeProgress`, the chart, cards, spotlight, dashboards, emails, exports
and tour copy never read a level, a stage or an id's shape. What stands in the way:

| Blocker | Where |
| --- | --- |
| `program TEXT NOT NULL CHECK (program IN ('beast_academy','aops'))` refuses any other row | `apps/api/db/schema.sql:1117` |
| `stage INTEGER NOT NULL UNIQUE` is one ladder across the whole table | `schema.sql:1122` |
| Id shapes `/^[A-Z]{2,3}\d?$/` and `/^[A-Z]{2,3}\d?\.\d{2}$/` reject an NC code before the database is asked | `packages/shared/src/progress.ts:62-66` |
| The catalog read and the id check take no organization | `apps/api/src/repositories/progress.ts:42,72` |
| The UI takes a topic's level from `split('.')[0]`, which for `NC.5.NF.1` is `NC`, no level at all | `topic-pickers.tsx:72,154`, `assessment-dialog.tsx:181` |
| The UI prints raw ids, which will not do for a UUID or a prefixed id | `rating.tsx:219`, `topic-pickers.tsx:41,99`, `session-form-dialog.tsx:994` |
| Ids pinned in the seed generator and one spec | `db/generate-seed.mjs:686-689`, `e2e/tests/progress.spec.ts:19-27` |

Production cannot rebuild `curriculum_levels` (`docs/database.md:296`: never drop or rebuild a
table others reference), and there is no purely additive route to a second curriculum: ratings
reference `curriculum_topics`, whose rows need a level, whose `program` CHECK refuses it. Tested
in a throwaway in-memory SQLite 3.54 with foreign keys on and child rows present:

- `ALTER TABLE curriculum_levels DROP COLUMN program` succeeds and takes its CHECK with it; child
  rows are untouched and `PRAGMA foreign_key_check` is clean. It is not a table rebuild: rows are
  rewritten in place, with no implicit delete, so no cascade can fire.
- `DROP COLUMN stage` is refused (a UNIQUE column), so `stage` stays.
- `ADD COLUMN curriculum_id TEXT REFERENCES curricula (id)` works only with a NULL default.
- An upsert that omits a NOT NULL column fails before its `ON CONFLICT` is reached, so a catalog
  file without `program` cannot run until the column is gone.
- UNIQUE is checked row by row: shifting or swapping `stage` values in one `UPDATE` fails, and so
  does a catalog upsert that inserts a level in the middle of the order.

`docs/database.md:86` says SQLite "cannot drop or retype a column in place". That is out of date
and should be corrected with these limits. None of this is proven on D1 itself yet: see Phase B.

One latent hazard turned up on the way. Posting a draft creates the billed session, then checks
the draft's topic ids, then deletes the draft (`apps/api/src/routes/sessions.ts:491-518`). A
refusal at the check would leave a session beside its draft, and a retry would bill twice. Nothing
can trigger it today, because the catalog never shrinks. Phase A moves the check above the insert.

### North Carolina

| | In classrooms through 2027-28 | Adopted 2026-10-01, taught from 2028-29 |
| --- | --- | --- |
| Adopted | K-8 June 2017; NC Math 1-3 June 2016; NC Math 4, Precalculus, Discrete Math 2019 | State Board, 1 October 2026, without opposition |
| Code | `NC.3.OA.1`, `NC.M1.A-SSE.1a` | `3.ANR.3.1`, `8.ANFR.5.2`, `NCM1.ANFR.3.8` (course . domain . standard . objective) |
| K-8 domains | OA, NBT, NF, MD, G (K-5); RP, NS, EE, G, SP (6-7); NS, EE, F, G, SP (8) | Algebraic and Numerical Reasoning; Spatial, Geometric and Measurement Reasoning; Reasoning with Data; plus Ratio and Proportional Reasoning in grades 6-7 |
| Size, K-8 | About 210 standards: 17-24 a grade in K-5, then 31, 23 and 24 in grades 6, 7, 8 | 123 standards holding 573 objectives: 11-17 standards a grade |
| Size, high school | Math 1: 40 numbered standards; Math 2: 46; Math 3 and 4 not counted yet | Math 1 and Math 2: 17 standards each (84 and 81 objectives). Three electives: 10, 13 and 9 standards |
| High school | Math 1, 2, 3 required, plus a fourth course | Math 1 and 2 required and rewritten; Math 3 and 4 replaced by two electives. The state wrote standards for three: Applied Logic and Reasoning, Applied Statistics and Data Science, Mathematical and Statistical Modeling. AP and IB courses also count |

- NCDPI says the current standards "remain in effect" through the installation period (the rest of
  2026-27 and all of 2027-28). EOG and EOC tests follow them until then.
- NCDPI publishes a crosswalk from the 2017 standards to the 2026 ones: some map one to one, some
  one to many, some moved a grade (`NC.K.G.5` to grade 1), some were removed, and many 2026 items
  are new. It pairs a 2017 *standard* with a 2026 *objective*.
- State law (G.S. 115C-81.36) places a student who scores at the top level on an EOG in the
  advanced course next year, and a top-scoring 7th grader in a high-school math course in 8th.
  This is why every district below has an accelerated track that ends in NC Math 1 by grade 8.
- The 2026 figures are counted from the text of the adopted document: 14 courses, 189 standards,
  866 objectives. The 2017 figures for K-5 and Math 1-2 are counted from the codes the crosswalk
  cites, so a standard it never mentions would be missing; grades 6-8 are from Chapel
  Hill-Carrboro's full listing. Recount from NCDPI's own 2017 documents when the catalog is
  written.

### Wake County, Chapel Hill-Carrboro, Orange County

All three teach the state standards. None adds or removes content. They differ in how the middle
grades are packaged, in what order units are taught, and in placement rules.

| | Standard track | Accelerated track | Textbook, which sets unit order |
| --- | --- | --- | --- |
| Wake (WCPSS) | Math 6, Math 7, Math 8, then NC Math 1 in grade 9 | Math 6 PLUS, Math 7 PLUS, NC Math 1 in grade 8. The 2020-21 guidelines also list a compacted 6 PLUS/7 PLUS in grade 6, leading to NC Math 1 in grade 7; it is not on today's course site | Unit names match Illustrative Mathematics 6-8 and MVP Math 1-3; K-5 units are the district's own |
| Chapel Hill-Carrboro (CHCCS) | Math 6, Math 7, Math 8 | Advanced Math 6, Advanced Math 7, Math 1 in grade 8 (Math 2 in grade 8 for a student who took Math 1 in grade 7) | Open Up Resources (Illustrative Mathematics) 6-8; Open Up (MVP) for Math 1-3 |
| Orange County Schools | The state's grade courses | Math 1 is taught in middle school; Math 2 through NC Virtual; single-subject acceleration on request. No pathway chart found | A K-8 adoption (enVision+) is referred to on a district page I could not open |

How the two documented accelerated tracks split grade 7:

| Course | Covers |
| --- | --- |
| WCPSS Math 6 PLUS | All of grade 6, plus the grade 7 units on scale drawings, proportional relationships, percentages and rational-number arithmetic |
| WCPSS Math 7 PLUS | The rest of grade 7 (circles, expressions and equations, angles and prisms, probability) and all of grade 8 |
| CHCCS Advanced Math 6 | All of grade 6, plus `NC.7.RP.1-3`, `NC.7.NS.1-3`, `NC.7.G.4` |
| CHCCS Advanced Math 7 | `NC.7.EE.1-4`, `NC.7.G.1, 2, 5, 6`, `NC.7.SP.1-8`, and all of grade 8 |

The two differ in one place: Wake teaches scale drawings (`7.G.1`) a year before circles
(`7.G.4`), and Chapel Hill-Carrboro the reverse. In both, the accelerated student sits the EOG of
their own grade and covers three years of standards in two.

What this means for the model:

- One NC catalog serves all three counties. A student in "Math 7 PLUS" has a plan drawn from grade
  7 and grade 8 standards, which plans already allow ("pick them from any level").
- The district course stays where it is, in the free-text "Current math course / grade".
- A district course is a named, ordered subset of standards. That is worth modelling later as a
  *sequence* a plan can start from, and only for the two districts that publish the split.
- Orange County Schools' split should be asked of the district before a sequence is written for it.

## The model

```
curricula ──┬── curriculum_levels ── curriculum_topics ── (ratings, plan topics: unchanged)
            └── organization_curricula ── organizations
```

```sql
CREATE TABLE curricula (
  -- The platform's: a slug ('ba', 'nc-2017', 'nc-2026'). An organization's own: a UUID.
  id              TEXT PRIMARY KEY,
  -- NULL: the platform's, shared by every organization that offers it.
  -- Set: that organization's own, and nobody else's (R13). No row has one before Phase D.
  organization_id TEXT REFERENCES organizations (id),
  name            TEXT NOT NULL,      -- 'Beast Academy', 'NC Math 2017'
  -- Where it comes from. No CHECK: a new source is never a table change.
  source          TEXT,               -- 'Beast Academy and Art of Problem Solving'
  edition         TEXT,               -- '2017', '2026'; NULL when the source has none
  description     TEXT,
  source_url      TEXT,
  sort            INTEGER NOT NULL DEFAULT 0,   -- display order only
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE organization_curricula (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  curriculum_id   TEXT NOT NULL REFERENCES curricula (id),
  is_default      INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  -- Hidden from pickers; everything written against it still reads. Never deleted.
  retired_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, curriculum_id),
  CHECK (is_default = 0 OR retired_at IS NULL)
);
CREATE UNIQUE INDEX organization_curricula_one_default
  ON organization_curricula (organization_id) WHERE is_default = 1;

-- A row may name the platform's curriculum or this organization's own, never another's.
CREATE TRIGGER organization_curricula_same_organization
BEFORE INSERT ON organization_curricula
WHEN NOT EXISTS (SELECT 1 FROM curricula c WHERE c.id = NEW.curriculum_id
                 AND (c.organization_id IS NULL OR c.organization_id = NEW.organization_id))
BEGIN SELECT RAISE(ABORT, 'organization_mismatch'); END;
-- plus organization_curricula_organization_fixed and curricula_organization_fixed,
-- in the shape every organization table already has
```

| Table | Phase A | Phase B | Phase D |
| --- | --- | --- | --- |
| `curriculum_levels` | + `curriculum_id`, + `code`, index on `(curriculum_id, stage)` | drop `program` | + `position`, + `retired_at` |
| `curriculum_topics` | + `code` | + `description` | + `position`, + `retired_at` |

`organization_curricula` is the one choke point: every catalog read and every id check goes
through it, and the trigger keeps another organization's curriculum off it. The same ownership
test is repeated in the SQL, because production's triggers are carried over by hand.

### Rules

1. **Ids are keys; codes are what people read.** Platform rows keep reviewed human ids, unique
   across the whole catalog: `BA3.10`, `NC17.5.NF.1`, `NC26.3.ANR.3`. `code` holds what is shown:
   the official `NC.5.NF.1` and `3.ANR.3`. It is NULL where the id already is the code, as for
   Beast Academy, and the API answers `COALESCE(code, id)`. An organization's own rows get UUIDs
   and the admin's code; a human id there would let one organization discover another's by
   collision. Existing ids never change, so no rating moves.
2. **A topic's level comes from its row, never from the id's text.**
3. **An organization's list is the boundary; retirement is tidiness.** A write may name any level
   or topic of a curriculum the organization has a row for, retired or not. Anything else is "Not
   in the curriculum", one identical answer whether the id is unlisted, another organization's or
   invented. Retiring only hides a curriculum from pickers. This matters because every edit
   resends its whole set of ids: a server-side refusal of retired ids would fail every save of an
   old plan and every lesson scored against one.
4. **Rows on the list are never deleted.** Removing a curriculum retires it, so history written
   against it keeps its names at no extra query.
5. **Every organization has exactly one default.** The index allows at most one; the API ensures
   one exists. It joins the rules "the database cannot express" in `docs/data-model.md`, with an
   audit query beside "students missing a parent".
6. **Plans, assessments and ratings get no new column.** A plan's topics may mix the curricula an
   organization offers, as they mix levels today.
7. **Platform curricula are never written by the application**, as the catalog is not today. Their
   `stage` values sit in disjoint thousands (Beast Academy 1-8, `nc-2017` from 1001, `nc-2026` from
   2001) and never change once shipped: a new level takes the next free number.
8. **The shared id shape may only ever widen.** A stored draft whose topic id stops matching it
   silently loses its ratings on read (`repositories/session-drafts.ts:79-92`).

## Phases

Numbers are the owner's to assign; 33 is the next free one.

### Phase A. Curricula, with Beast Academy alone (additive, no visible change)

Everything is scoped to an organization's list, and the list holds one curriculum. `program` stays
in the database, unread, so the release is the usual additive one.

- **Schema** (`apps/api/db/schema.sql`): the two tables and three triggers above in a marked block
  before `-- BEGIN PHASE 16 TABLES`; both tables added to the drop list (lines 38-72);
  `curriculum_levels` gains `curriculum_id TEXT NOT NULL REFERENCES curricula (id)` and `code TEXT`
  as its last columns, where `ALTER` puts them; `curriculum_topics` gains `code TEXT`; the index;
  the catalog block upserts `curricula` (`ba`) first and names `curriculum_id` on each level.
- **Shared** (`packages/shared/src/progress.ts`): delete `CURRICULUM_PROGRAMS` and its labels
  (nothing reads them); `DEFAULT_CURRICULUM_ID = 'ba'`; `curriculum_id` and `code` on
  `CurriculumLevel`, `code` on `CurriculumTopic`; `stage` leaves the API type. One id shape for
  levels, topics and curricula, `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/`, wrapped in the existing
  `refuseSsn` (`packages/shared/src/tax.ts:44`): the wider shape would otherwise let `123-45-6789`
  through and the 422 would echo it back. Landing the shape now means any mobile build cut after
  this phase can score NC topics.
- **API**:
  - `listCurriculum(db, org)` and `findUnknownCurriculumIds(db, org, kind, ids)`
    (`repositories/progress.ts:42,72`) join `organization_curricula` on the organization and repeat
    the ownership test; the second takes `'level' | 'topic'` and two fixed statements in place of
    an interpolated table name. Order: retired last, the default first, then `sort`, `stage`,
    `number`.
  - `assertCatalogIds` (`routes/progress.ts:69`, four call sites) and `assertProgressTopics`
    (`routes/sessions.ts:127`, five) pass `c.get('org').id`.
  - Posting a draft checks its topics before `createSession` (`routes/sessions.ts:491-511`).
  - `createOrganization` (`repositories/organizations.ts:364`) becomes a batch that also inserts
    the default row. It is the only creation path, so it covers the sign-in-off "Local
    Organization" too (`middleware/auth.ts:121`).
  - `scripts/check-org-scope.mjs:25`: add all four tables to `ORG_TABLES`. `curriculum_levels` and
    `curriculum_topics` are the ones a future unjoined query would leak from.
  - No new route, no new mutation, no new audit action.
- **Web**: print `code` where an id is printed today (`rating.tsx:219`, `topic-pickers.tsx:41,99`);
  take the level from a topic-to-level map (`topic-pickers.tsx:72,154`,
  `assessment-dialog.tsx:181`); `useTopicIndex` gives each topic its catalog position and
  `plan-dialog.tsx:122` sorts by it. For Beast Academy every one of these gives the same result
  as today.
- **Seed and tests**: `generate-seed.mjs` deletes `organization_curricula` before `organizations`
  and writes one default row for each. `progress.spec.ts:15-28` keeps its exact Beast Academy
  assertions, now the guard that the institute's catalog is unchanged, and adds the same list for
  organization B. `platform.spec.ts`: a newly created organization reads the eight levels.
  `/api/curriculum` joins both exposure crawls (`exposure-organizations.spec.ts:43`).

Production, before the deploy; the running Worker keeps working throughout:

```sql
-- the PHASE NN TABLES block, verbatim from schema.sql, then:
INSERT INTO curricula (id, name, source, sort)
  VALUES ('ba', 'Beast Academy', 'Beast Academy and Art of Problem Solving', 1)
  ON CONFLICT (id) DO UPDATE SET name = excluded.name, source = excluded.source, sort = excluded.sort;
ALTER TABLE curriculum_levels ADD COLUMN curriculum_id TEXT REFERENCES curricula (id);
ALTER TABLE curriculum_levels ADD COLUMN code TEXT;
ALTER TABLE curriculum_topics ADD COLUMN code TEXT;
UPDATE curriculum_levels SET curriculum_id = 'ba' WHERE curriculum_id IS NULL;
CREATE INDEX curriculum_levels_curriculum_idx ON curriculum_levels (curriculum_id, stage);
INSERT INTO organization_curricula (organization_id, curriculum_id, is_default)
  SELECT id, 'ba', 1 FROM organizations WHERE true
  ON CONFLICT (organization_id, curriculum_id) DO NOTHING;

-- read-only checks: 0, nothing, nothing
SELECT COUNT(*) FROM curriculum_levels WHERE curriculum_id IS NULL;
SELECT o.slug FROM organizations o WHERE NOT EXISTS
  (SELECT 1 FROM organization_curricula oc WHERE oc.organization_id = o.id AND oc.is_default = 1);
PRAGMA foreign_key_check;
```

`curriculum_id` is nullable in production and NOT NULL in a rebuilt database, as `ALTER` allows. A
level with none is invisible to every organization, so it fails safe, and the first check finds it.

### Phase B. North Carolina Math, both editions, and choosing

- **Catalog as generated data**, the first step. At about 700 rows the catalog no longer belongs
  hand-written inside `schema.sql`. Source files `apps/api/db/catalog/{ba,nc-2017,nc-2026}.json`
  and a generator `db/generate-catalog.mjs` produce `db/catalog.sql`: upserts of platform rows
  only, one statement per level, because D1 caps a statement's size. Three paths build a database
  and each must run it after `schema.sql`: `db:rebuild`, `db:rebuild:test`
  (`apps/api/package.json:15,20`) and `scripts/e2e.sh:84`. The generator refuses a dropped id, a
  changed `stage`, a stage outside its thousand or a repeated code, which turns "never delete a
  topic" from a comment into a check; `npm run typecheck` runs it in check mode. First check: the
  generated Beast Academy rows equal today's 124, by a dump compared before and after.
- **`nc-2017`**: levels `NC17.K`, `NC17.1` ... `NC17.8`, `NC17.M1` ... `NC17.M4`, `NC17.PC`. One
  topic per numbered standard, shown by its official code; lettered parts fold into the
  description. `unit` is the domain. Roughly 400 topics.
- **`nc-2026`**: levels `NC26.K` ... `NC26.8`, `NC26.M1`, `NC26.M2`, and the electives `NC26.ALR`,
  `NC26.ASDS`, `NC26.MSM`. 189 topics, one per standard, objectives in the description. The source
  file keeps each objective as its own item, so they could become rows later without re-entry.
- **Names.** A Beast Academy chapter has a title; a state standard has only a statement. Each NC
  topic needs a short name written for it, about 600 in all, drafted from the statement and
  reviewed by the owner.
- **Choosing**: `GET /api/curricula` (this organization's list, any member), and
  `GET` / `PUT /api/organization/curricula` (`requireAdmin`, in `routes/organization.ts`): every
  curriculum the organization may offer with its flags and counts, and
  `{ offered, default_curriculum_id }`. The write is one batch modelled on
  `setDefaultOrganization` (`repositories/organizations.ts:188`): clear the default, retire the
  absent, upsert the offered, set the default.
- **Audit**: `curriculum.offering_updated`, a finished sentence built from the before/after
  difference, no line when nothing changed. Deliberately not `organization.*`: the platform
  console lists every `organization.%` action across organizations
  (`repositories/organizations.ts:546`), and from Phase D this sentence can name an organization's
  own curriculum, which the console must never show (R14).
- **Web**: a Curricula card on the Organization page, on the pattern of `EmailNotificationsCard`
  (`organization-settings-page.tsx:180`): one row per curriculum with an Offered switch and a
  default radio. In the pickers: topics grouped under their `unit`; the description as a second
  line; a curriculum switch only when two or more are offered; retired levels hidden unless
  already selected. `student-progress-page.tsx:582` breaks ties by catalog position. The plan
  dialog's placeholder stops naming AoPS. Saving the choice invalidates `['curriculum']`; other
  open tabs see it on reload.
- **Seed**: organization B (`riverside`) offers `nc-2017` as default and `nc-2026`, with Beast
  Academy retired. Its BA4 assessment stays and its BA5 plan is closed, as history; it gains an NC
  assessment, an active NC plan and one scored lesson. Organization A stays on Beast Academy alone.
- **Tests** (a new `curricula.spec.ts`):
  - B reads NC first, then retired Beast Academy, with its flags.
  - A's admin and tutor are refused an NC id on an assessment, a plan, a lesson and a draft.
  - B's closed plan still names "Beast Academy Level 5".
  - A draft that rates an `nc-2026` topic still posts, once, after that curriculum is retired.
  - The `PUT` is 403 for a non-admin and 422 for an unknown id, an empty list, or a default that
    is not offered.
  - Changes to an offering run in a throwaway organization made through the console, so A's
    exact-list assertion never sees a retired row.
  - `/api/curricula` joins both crawls, and the NC names join A's forbidden words
    (`exposure-organizations.spec.ts:121`).
  - The Organization page and the pickers pass `responsive.spec.ts` at 390px and 360px.

Production, in the usual order: backup, this block, the catalog, the checks, then the deploy. The
Phase A Worker never reads `program`, so it keeps working through the drop:

```bash
cd apps/api
npx wrangler d1 execute tutoring-db --remote --command="SELECT sqlite_version()"
npx wrangler d1 execute tutoring-db --remote --command="SELECT (SELECT COUNT(*) FROM assessment_topic_ratings), (SELECT COUNT(*) FROM learning_plan_topics), (SELECT COUNT(*) FROM session_topic_ratings), (SELECT COUNT(*) FROM curriculum_topics)"
# The one non-additive statement. Not a table rebuild: no implicit delete, so no cascade.
npx wrangler d1 execute tutoring-db --remote --command="ALTER TABLE curriculum_levels DROP COLUMN program"
npx wrangler d1 execute tutoring-db --remote --command="ALTER TABLE curriculum_topics ADD COLUMN description TEXT"
npx wrangler d1 execute tutoring-db --remote --file=./db/catalog.sql
```

Then: the same counts (the first three unchanged, topics 116 plus the NC rows); levels per
curriculum (`ba` 8, `nc-2026` 14, `nc-2017` as authored); `PRAGMA foreign_key_check` empty;
per-level topic counts against the official documents. NC rows are inert until an organization
offers them.

Before that, in this order:

1. A production export restored into a local D1; the Phase A block, then this one; the new Worker
   started against it reads the eight levels as a `tmi` member; the suite.
2. In `tutoring-test-db`, throwaway tables created with the old DDL and child rows, to prove
   `DROP COLUMN` on D1 itself and not only on local SQLite. Deleted afterwards. (Rebuilding that
   database from `schema.sql` would not exercise the block: it would already have the new shape.)
3. A Time Travel bookmark noted beside the export.

If D1 refuses the drop, stop: the fallback is the one `docs/database.md:298` names for an
unavoidable rebuild, and that is the owner's decision. Rolling back the Worker is safe to the
Phase A build; anything older needs `program` put back with an `ADD COLUMN` and an `UPDATE`.

### Phase C. From the 2017 edition to the 2026 one

- `curriculum_topic_links (from_topic_id, to_topic_id, relation, note)`: reference data from
  NCDPI's crosswalk, generated with the catalog.
- A topic shows its counterpart in the other edition.
- "Start a plan on the 2026 edition" proposes the linked topics of an existing plan. Each latest
  rating is offered as a starting point for a new assessment, never copied as a score.
- Wanted before fall 2028; nothing needs it sooner.

### Phase D. An organization's own curriculum

The largest phase. The catalog stops being purely shared reference data.

- **Model**: rows of `curricula` with `organization_id` set; their levels and topics get UUID ids
  and the admin's own codes, unique within the curriculum by index.
- **Order**: a new, non-unique `position` on levels and topics, and every read orders by it.
  `stage` and `number` cannot lose their UNIQUE, so for an organization's rows they freeze as
  meaningless unique numbers (the highest plus one) and reordering never touches them. Platform
  rows get `position` from the generator.
- **Hiding**: `retired_at` on levels and topics, because a rated topic can be hidden but never
  deleted.
- **Routes** (`requireAdmin`; every lookup through "this organization's own curriculum", 404
  otherwise): create and rename a curriculum; add, edit, reorder and retire levels and topics; add
  many from pasted lines.
- **Validation** in `packages/shared` through `optionalText`, so the SSN guard applies.
- **Audit**: `curriculum.created`, `curriculum.updated`, `curriculum.level_added` and so on, in the
  organization's own log, and so outside the console's.
- **Exposure**: a new rule in `docs/data-exposure.md`, checked by both crawls, which already
  recognise foreign UUIDs: an organization's own curriculum reaches that organization only, and
  the platform console never lists one (R14). Five triggers, on `assessments`, `learning_plans`
  and the three rating tables, refuse a reference into another organization's curriculum. They
  test ownership, not the offering list, as `comments_target_same_organization` does
  (`schema.sql:1518`).
- **UI**: an editor reached from the Curricula card.

### Later, unscheduled

- **Sequences**: named, ordered lists of existing topics that a plan can start from. The
  platform's for WCPSS Math 6 PLUS and 7 PLUS and CHCCS Advanced Math 6 and 7; an organization's
  own for its house courses.
- A platform admin choosing an organization's curricula. If ever built, it reads and writes
  platform rows only: a full replacement from the console would retire the organization's own
  curricula, which the console must never list.
- **Mobile**: `apps/mobile` ports `useCurriculum` and `TopicName` and validates ids on the device.
  Its `TopicName` prints the id (`apps/mobile/src/features/progress/rating.tsx:243`) and must move
  to `code` when it next takes the web's changes. `docs/mobile/parity.md` gains the Curricula card
  and a note that a build must postdate Phase A before an organization moves to NC.
- Roadmap items L4 (placement test), L9 (heatmap) and L13 (prerequisites) each become "per
  curriculum".

### Docs to change with Phases A and B

`CLAUDE.md` (the phase list; "one curriculum ladder" becomes the rules above; the four tables in
the scoping paragraph), `docs/data-model.md:411-437`, `docs/multi-organization.md:161,325`,
`docs/database.md` (both blocks, line 86, and a note beside lines 282-300 that dropping an
unreferenced column is not a rebuild), `docs/data-exposure.md` (R13's enforcement and crawl list,
R14), `docs/testing.md`, and a line in `docs/migration-tmi.md` that its `migrate.sql` predates the
curricula row.

## Verification

- `npm run typecheck`, which runs `check-org-scope` and, from Phase B, the catalog check.
- `npm run db:reset`, `npm run dev`, then `E2E_BASE_URL=http://localhost:5173 npm run e2e:test`.
- By hand as organization A, the institute's shape: the assessment dialog, the plan dialog, the
  session form and a student's progress page look as they do today, with no curriculum switch.
- By hand as organization B after Phase B: build a plan from grade 7 and grade 8 standards, score
  two in a lesson, watch the chart move; retire a curriculum and confirm an old plan still names
  its topics and still saves.
- With sign-in on, no cookie: `GET /api/curricula` and both `/api/organization/curricula` routes
  answer 401. As a tutor the `PUT` answers 403.
- After each schema change: the "students missing a parent" query and the new "organization
  without a default curriculum" query.
- Measure the `/api/curriculum` response for an organization offering both NC editions. Split the
  descriptions into their own read only if it is large.

## Risks

- **`DROP COLUMN` on D1 is unproven.** It needs SQLite 3.35 or later; print the version first.
- **Catalog accuracy**: about 600 hand-checked rows across two editions.
- **Never cache `/api/curriculum` over HTTP without `Vary: X-Organization`.** The organization
  travels in a header and the URL is the same for everyone.
- **Row reads.** An organization on both NC editions reads about 600 catalog rows per app load
  where one on Beast Academy reads 124, and the exposure crawl now reads the catalog per persona.
  Small beside the suite's 2.3 million, but it is the local suite that should carry it.

## Open points for the owner

1. **Size of a 2026 topic.** The state's crosswalk pairs a 2017 standard with a 2026 *objective*,
   so a 2026 "standard" is nearer a 2017 cluster. Objectives instead would be 866 rows against
   189, or 48 to 97 a grade: too many to rate in a lesson. Recommended: standards, with the source
   files keeping objectives separate in case that changes.
2. **Which high-school courses.** Planned: NC Math 1-4 and Precalculus for 2017; Math 1, Math 2 and
   the three state-written electives for 2026. AP courses belong to the College Board and would be
   a curriculum of their own.
3. **The 600 short names, and the official wording.** Who writes the names, and whether the
   statements are stored in full or only linked. Storing them deserves a check of NCDPI's terms.
4. **Permanent ids.** `nc-2017`, `nc-2026`, `NC17.3`, `NC17.M1`, `NC17.3.OA.1`, `NC26.3.ANR.3`. Both
   editions are prefixed so that `NC.` does not come to mean 2017 for good; the official code is
   what people see. Like `BA3.10`, an id cannot change once anything is rated.
5. **The first non-additive statement on `tutoring-db`.** `DROP COLUMN program` removes a column
   holding two values across eight rows; the Beast Academy / AoPS distinction survives only in the
   level names. It must be named in Phase B and approved there, as the release rule requires.
6. **For Phase D: who reads an organization's own curriculum.** Every member, parents included, can
   read the platform's today, because a plan's topic names come from it. The same would apply.
7. **Orange County Schools' middle-school split** is not published where I could read it.
8. `docs/funding-plan.md:273-283` says curriculum "can wait" and lists an editable curriculum as
   out of scope for its period. This plan supersedes that if adopted.

## What the second review changed

- The audit action for an organization's choice is `curriculum.offering_updated`, not
  `organization.curricula_updated`, to keep it out of the platform console's log (R14).
- `curricula.organization_id` and the trigger that keeps another organization's curriculum off a
  list are in the first phase, not the last, so the boundary exists before any row can cross it.
  All four catalog tables join the scope check.
- `code` moves to Phase A, so the screens stop printing ids while ids and codes are still equal.
- Stage "blocks owned by a curriculum" are gone. Platform stages are fixed numbers in disjoint
  thousands; an organization's own rows will be ordered by a new non-unique `position`.
- Both NC editions get prefixed ids (`NC17.`, `NC26.`).
- The console route for choosing curricula is dropped from these phases.

## Sources

- NCDPI, Office of Teaching and Learning (adoption, installation period, links to the 2026
  standards and the crosswalk): https://www.dpi.nc.gov/districts-schools/classroom-resources/office-teaching-and-learning
- 2026 NC K-12 Math Standards: https://docs.google.com/document/d/1LxwEUZkpFTH77pZ0GQgazvAZQNllNx-YJcsp-K3siKw/
- Crosswalk, current to 2026: https://docs.google.com/document/d/1l4n9AUiQ_esl7-mv8vvEH7cc1yskbpk7EZDIDzFsIuE/
- WRAL, 1 October 2026: https://www.wral.com/news/education/changes-to-nc-school-math-requirements-standards-vote-october-2026/
- G.S. 115C-81.36: https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_115C/GS_115C-81.36.pdf
- WCPSS K-12 Mathematics, middle school courses and units: https://sites.google.com/wcpss.net/k-12mathematics/middle-school-math-courses
- WCPSS middle school math (placement guidelines, typical sequences): https://www.wcpss.net/msmath
- CHCCS Secondary Math (Courses and Curriculum; Math Pathways and Placement): https://www.chccs.org/academics/middle-and-high-school/secondarymath
- Orange County Schools course guide, math: https://www.orangecountyfirst.com/families-and-students/course-registration-information/ocs-course-guide/hs-course-options/math
