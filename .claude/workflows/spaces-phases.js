export const meta = {
  name: 'spaces-phases',
  description: 'Build and verify Phases 59-61 (spaces) on web and app against docs/spaces-plan.md S1-S13, locally',
  whenToUse: 'After the owner approves docs/spaces-plan.md. args: { phases?: [59,60,61], skipBuild?: bool, rounds?: 3 }',
  phases: [
    { title: 'Build', detail: 'one phase at a time: API+shared+web, then the app' },
    { title: 'Write tests', detail: 'one agent per requirement, own files' },
    { title: 'Run', detail: 'serial run on one local Worker, simulator and emulator' },
    { title: 'Fix', detail: 'one failing requirement at a time, then re-run' },
    { title: 'Break it', detail: 'two adversarial agents per requirement' },
    { title: 'Gate', detail: 'full suite, smoke, compat, typecheck, coverage of S1-S13' },
  ],
}

// Everything here is local: the local Worker and seeded D1, the iOS simulator and the Android emulator.
// Nothing deploys, nothing touches tutoring-db or the demo, nothing commits.
const LOCAL_ONLY = `Rules for this task: work only locally (npm run dev, the local seeded D1, the iOS simulator, the
Android emulator). Never run a --remote wrangler command, npm run deploy, deploy:test, db:reset:test or npm run e2e,
and never commit or push. Never untag or loosen an existing test to get to green. The plan is docs/spaces-plan.md;
read the requirement's section there before starting.`

const PLAN_PHASES = {
  59: { title: 'one word, spaces', reqs: ['S1', 'S2', 'S3'] },
  60: { title: 'arriving and choosing', reqs: ['S4', 'S5', 'S6', 'S7', 'S8', 'S9'] },
  61: { title: 'new spaces and newcomers', reqs: ['S10', 'S11', 'S12', 'S13'] },
}

const REQS = [
  { id: 'S1', phase: 59, name: '"Organization" leaves every screen', web: 'e2e/tests/spaces-words.spec.ts', flow: 'spaces/words.yaml' },
  { id: 'S2', phase: 59, name: "A space's payer details are its own", web: 'e2e/tests/tutor-spaces.spec.ts, e2e/tests/platform.spec.ts', flow: 'spaces/console-payment.yaml' },
  { id: 'S3', phase: 59, name: "Feature sets are the space's", web: 'e2e/tests/features.spec.ts', flow: 'platform/ (re-worded)' },
  { id: 'S4', phase: 60, name: 'Land in the last space chosen', web: 'e2e/tests/spaces-landing.spec.ts', flow: 'spaces/landing.yaml' },
  { id: 'S5', phase: 60, name: 'The selector', web: 'e2e/tests/spaces-landing.spec.ts (describe "selector")', flow: 'spaces/selector.yaml' },
  { id: 'S6', phase: 60, name: 'An invitation is accepted by hand, then entered', web: 'e2e/tests/spaces-invitations.spec.ts', flow: 'spaces/invitation.yaml' },
  { id: 'S7', phase: 60, name: "The Spaces page, the person's own console", web: 'e2e/tests/spaces-page.spec.ts', flow: 'spaces/spaces-page.yaml' },
  { id: 'S8', phase: 60, name: 'Leaving a space, from anywhere', web: 'e2e/tests/spaces-leave.spec.ts', flow: 'spaces/leave.yaml' },
  { id: 'S9', phase: 60, name: 'What Phase 60 does not change (join requests, per-tab spaces)', web: 'e2e/tests/spaces.spec.ts, e2e/tests/organizations.spec.ts', flow: 'spaces/join.yaml' },
  { id: 'S10', phase: 61, name: 'A new space has Assessment and Quest on', web: 'e2e/tests/spaces-defaults.spec.ts', flow: 'spaces/new-space-quest.yaml' },
  { id: 'S11', phase: 61, name: 'The first sign-in: join or start', web: 'e2e/tests/spaces-welcome.spec.ts', flow: 'spaces/sign-up.yaml, spaces/join.yaml' },
  { id: 'S12', phase: 61, name: 'Start a space, then invite people', web: 'e2e/tests/spaces-invite.spec.ts', flow: 'spaces/invite.yaml' },
  { id: 'S13', phase: 61, name: 'Exposure and older clients', web: 'e2e/tests/exposure-spaces.spec.ts, e2e/tests/compat-clients.spec.ts', flow: 'n/a' },
]

const BUILD = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    summary: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'string' }, description: 'commands run and their result' },
    open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['done', 'summary', 'checks', 'open_issues'],
}

const WRITTEN = {
  type: 'object',
  properties: {
    requirement: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    cases: { type: 'array', items: { type: 'string' }, description: 'one line per acceptance check covered' },
    not_covered: { type: 'array', items: { type: 'string' } },
  },
  required: ['requirement', 'files', 'cases', 'not_covered'],
}

const RUN = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          platform: { type: 'string', enum: ['web', 'ios', 'android', 'jest', 'typecheck'] },
          passed: { type: 'boolean' },
          failures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                test: { type: 'string' },
                kind: { type: 'string', enum: ['test', 'product', 'environment'] },
                detail: { type: 'string' },
              },
              required: ['test', 'kind', 'detail'],
            },
          },
        },
        required: ['requirement', 'platform', 'passed', 'failures'],
      },
    },
  },
  required: ['results'],
}

const DEFECTS = {
  type: 'object',
  properties: {
    defects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scenario: { type: 'string', description: 'who, which client, which steps' },
          expected: { type: 'string' },
          evidence: { type: 'string', description: 'file:line of the code that gets it wrong' },
          proposed_test: { type: 'string', description: 'where the failing test goes and what it asserts' },
        },
        required: ['scenario', 'expected', 'evidence', 'proposed_test'],
      },
    },
  },
  required: ['defects'],
}

const GATE = {
  type: 'object',
  properties: {
    green: { type: 'boolean' },
    suites: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, result: { type: 'string' } },
        required: ['name', 'result'],
      },
    },
    uncovered: { type: 'array', items: { type: 'string' }, description: 'acceptance checks with no passing test' },
    report: { type: 'string' },
  },
  required: ['green', 'suites', 'uncovered', 'report'],
}

const wanted = (args && args.phases) || [59, 60, 61]
const rounds = (args && args.rounds) || 3
const reqs = REQS.filter((r) => wanted.includes(r.phase))
const describe = (r) => `${r.id} (Phase ${r.phase}): ${r.name}. Web tests: ${r.web}. App flows: apps/mobile/.maestro/flows/${r.flow}.`

// 1. Build. Phases are sequential because they touch the same files; within a phase the app half follows
//    the web half, since its api.ts copies the web's.
const builds = []
if (!(args && args.skipBuild)) {
  phase('Build')
  for (const p of wanted) {
    const spec = PLAN_PHASES[p]
    const server = await agent(
      `${LOCAL_ONLY}\n\nBuild Phase ${p} (${spec.title}), requirements ${spec.reqs.join(', ')}, for the API, packages/shared and the web
app, exactly as docs/spaces-plan.md describes. Follow CLAUDE.md's rules (audit, exposure, envelope, validation in shared, no schema
change). Update the docs the plan names (data-exposure.md, data-model.md where meaning changes, CLAUDE.md's paragraphs that describe the
changed behaviour). Finish with: npm run typecheck green; npm run db:reset; the feature's existing specs that the plan lists as changed,
updated and green against npm run dev (E2E_BASE_URL=http://localhost:5173 npx playwright test <spec> from e2e/). Leave the app
(apps/mobile) to the next agent, but list in open_issues anything it must copy (routes, payload fields, strings).`,
      { label: `build:${p}:server`, phase: 'Build', schema: BUILD },
    )
    builds.push({ phase: p, part: 'server', ...server })
    const app = await agent(
      `${LOCAL_ONLY}\n\nBuild the app half of Phase ${p} (${spec.title}), requirements ${spec.reqs.join(', ')}, in apps/mobile, to parity
with the web half just built (its notes: ${JSON.stringify(server && server.open_issues)}). Use the mobile-developer skill's conventions;
update docs/mobile/parity.md, progress.md and build-log.md. Finish with the app's typecheck and Jest green and the changed Maestro flows
green on iOS and Android (npm run e2e:mobile -- both <flows>). Uninstall com.aimtrue.app.e2e from the simulator and emulator first if
present, and kill a stale Metro on :8081.`,
      { label: `build:${p}:app`, phase: 'Build', schema: BUILD, agentType: 'mobile-developer' },
    )
    builds.push({ phase: p, part: 'app', ...app })
  }
}

// 2. Write tests: each requirement into its own files, so these agents never edit the same file.
phase('Write tests')
const written = await parallel(
  reqs.map((r) => () =>
    agent(
      `${LOCAL_ONLY}\n\nWrite the tests for ${describe(r)}
Cover every acceptance check listed under that requirement in docs/spaces-plan.md, on the web (Playwright, using e2e/support helpers
and the visible() rule for two layouts) and in the app (Maestro, tagged as the plan says; Jest where the plan says). Write only into the
files named for this requirement; if a named file already exists and belongs to another requirement too, add a describe block of your
own and touch nothing else. Do not run the suites (another agent runs everything serially on one Worker); do run npm run typecheck.
Make each test build its own people and spaces where it changes state, so the order of runs does not matter.`,
      { label: `tests:${r.id}`, phase: 'Write tests', schema: WRITTEN },
    ),
  ),
)
const notCovered = written.filter(Boolean).flatMap((w) => w.not_covered.map((n) => `${w.requirement}: ${n}`))
if (notCovered.length) log(`Not covered by the writers: ${notCovered.length} checks (carried to the gate)`)

const runAll = (label, only) =>
  agent(
    `${LOCAL_ONLY}\n\nRun the tests for these requirements, one after another, on ONE local Worker: ${only.map(describe).join('\n')}
Order: npm run typecheck; npm run db:reset; npm run dev in the background; each requirement's web specs; the app's Jest; then each
requirement's Maestro flows on iOS, then on Android (uninstall com.aimtrue.app.e2e first if present; one stale Metro on :8081 is
killed first). For each failure decide its kind: "test" (the test is wrong about the plan or a selector), "product" (the code does not
do what docs/spaces-plan.md says), or "environment" (simulator, port, flake: re-run once before calling it that). Report every
requirement and platform, passing ones too. Stop the dev server at the end.`,
    { label, phase: 'Run', schema: RUN },
  )

const failing = (run) => {
  const by = {}
  for (const res of (run && run.results) || []) {
    for (const f of res.failures) {
      if (f.kind === 'environment') continue
      by[res.requirement] = by[res.requirement] || []
      by[res.requirement].push({ platform: res.platform, ...f })
    }
  }
  return by
}

// 3-4. Run, then fix one requirement at a time (they share code), until green or out of rounds.
phase('Run')
let run = await runAll('run:1', reqs)
for (let round = 1; round <= rounds; round++) {
  const by = failing(run)
  const ids = Object.keys(by)
  if (!ids.length) break
  log(`Round ${round}: ${ids.length} requirement(s) failing: ${ids.join(', ')}`)
  for (const id of ids) {
    const r = REQS.find((x) => x.id === id) || { id, phase: 0, name: id, web: '', flow: '' }
    await agent(
      `${LOCAL_ONLY}\n\nFix ${describe(r)}
Failures: ${JSON.stringify(by[id])}
For a "product" failure, fix the code (web, API, shared or the app, keeping parity). For a "test" failure, fix the test only where it
contradicts docs/spaces-plan.md, never to hide a product fault. Re-run just this requirement's failing tests to confirm, then stop the
dev server. Report what you changed in a few lines.`,
      { label: `fix:${id}:${round}`, phase: 'Fix' },
    )
  }
  run = await runAll(`run:${round + 1}`, reqs.filter((r) => ids.includes(r.id)))
}
const stillFailing = Object.keys(failing(run))
if (stillFailing.length) log(`Still failing after ${rounds} rounds: ${stillFailing.join(', ')}`)

// 5. Break it: two different lenses per requirement, read-only, each proposing a failing test with evidence.
phase('Break it')
const LENSES = [
  'personas and clients: every role (admin, tutor, parent, student, a person in two spaces, a platform admin, a newcomer, a 13-17), the web and the app, and an app built before these phases',
  'edges and exposure: removed, suspended or archived spaces, a stale last choice, two tabs, links naming another space, the last admin, sign-up closed, each fake provider, and anything a reader could see that R1-R21 in docs/data-exposure.md forbid',
]
const attacks = await parallel(
  reqs.flatMap((r) =>
    LENSES.map((lens, i) => () =>
      agent(
        `${LOCAL_ONLY}\n\nTry to break ${describe(r)} by reading the code as built (do not run servers or suites). Lens: ${lens}.
Report only defects you can point at in the code (file:line) where it contradicts docs/spaces-plan.md or CLAUDE.md, each with the
failing test that would prove it. Default to reporting nothing over reporting a guess.`,
        { label: `break:${r.id}:${i + 1}`, phase: 'Break it', schema: DEFECTS },
      ).then((d) => ({ req: r, defects: (d && d.defects) || [] })),
    ),
  ),
)
const defects = attacks.filter(Boolean).filter((a) => a.defects.length)
if (defects.length) {
  log(`Break it: ${defects.reduce((n, a) => n + a.defects.length, 0)} proposed defects`)
  // One agent at a time: each writes the proposed tests, runs them, and fixes what is confirmed.
  for (const a of defects) {
    await agent(
      `${LOCAL_ONLY}\n\nProposed defects for ${describe(a.req)}: ${JSON.stringify(a.defects)}
For each: write the proposed test in this requirement's files, run it locally. If it fails for the reason given, fix the product
(keeping web and app in parity) and run it again; if it passes, keep the test anyway and say the defect was not confirmed. Stop the
dev server at the end. Report confirmed / not confirmed per defect.`,
      { label: `confirm:${a.req.id}`, phase: 'Break it' },
    )
  }
}

// 6. Gate: the whole local release gate, and coverage of every acceptance check.
phase('Gate')
const gate = await agent(
  `${LOCAL_ONLY}\n\nThe release gate for Phases ${wanted.join(', ')}, all local:
1. npm run typecheck (with the new ui-words guard);
2. npm run db:reset, npm run dev, then E2E_BASE_URL=http://localhost:5173 npm run e2e:test (the full web suite);
3. npm run smoke -- mobile (iOS and Android);
4. npm run test:compat against the last release-* tag;
5. the app's Jest.
Then read docs/spaces-plan.md and, for every acceptance check under ${reqs.map((r) => r.id).join(', ')}, name the passing test that
covers it; list any with none in "uncovered" (known gaps from the writers: ${JSON.stringify(notCovered)}). Say which platforms ran; if a
simulator or the emulator could not run, say so rather than calling it passed.`,
  { label: 'gate', phase: 'Gate', schema: GATE },
)

return { builds, written: written.filter(Boolean), stillFailing, defects: defects.length, gate }
