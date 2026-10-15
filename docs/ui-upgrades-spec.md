# UI upgrades: warmth and short tasks

Spec, 2026-10-14, on branch `ui-enhancements`. It turns
[mobile/ux-redesign-proposal.md](mobile/ux-redesign-proposal.md) (the audit and the options) into
work. The owner chose every recommendation, and added one requirement: **adding a student starts
with the parent**.

## Decisions (owner, 2026-10-14)

| Decision | Chosen |
| --- | --- |
| Platform palette | **C, Sunlit Slate**: the logo's slate `#30577D` as primary, amber `#F6B740` as the warm accent, coral `#E8765A` for celebrations, on cream |
| Web portal | warms up with the app (one stylesheet feeds both) |
| Headings | **Nunito** (rounded); body stays the system font in the app and Inter on the web |
| Create button | in the middle of the app's tab bar |
| First flows | Add a student, Record a lesson, the student's reflection |
| Student, parent first | the family step comes first, and a new parent is added inside the flow |

## How the work is delivered

- **Branch** `ui-enhancements`. One commit per phase, pushed to the branch.
- **After each phase**: typecheck, the affected web specs and Maestro flows, then
  `npm run deploy:test` so the open demo (`tutoring-test`) shows the portal's progress.
- **Only after the last phase**: the full local web suite, `npm run smoke` on web, iOS and Android,
  merge into `main`, deploy both production Workers, and install the app on the owner's phones.
- No schema change is planned. If one becomes necessary it follows `docs/database.md`.
- Every existing rule holds: no money under Tutoring, nothing personal on a system surface, nothing
  across organizations, validation in `packages/shared`, the guardian rule (a student is created
  with a guardian in ONE request), audit events unchanged.

## Phase U1: the warm foundation (web and app)

**Colour.** One warm neutral layer is laid over every palette in `apps/web/src/index.css`, after
the palette blocks, so it wins for all of them (`:root[data-palette]` and
`.dark:root[data-palette]`):

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | cream (about `#FAF6EF`) | warm near-black (about `#181513`) |
| `--card`, `--popover` | `#FFFDF9`-ish | `#24201C`-ish |
| `--foreground` | warm ink `#26221E`-ish | `#F3EDE6`-ish |
| `--muted`, `--secondary` | warm 100 | warm 800 |
| `--muted-foreground` | warm 600 (≥ 4.5:1 on cream) | warm 300 |
| `--border` | warm 200 (dividers, soft) | translucent white, as today |
| `--input` | warm 500 outline (≥ 3:1 for a control's edge) | translucent white, a little stronger |
| `--sidebar*` neutrals | warm | warm |

New tokens, on every palette: `--highlight` (amber, with `--highlight-foreground` ink),
`--highlight-soft` (amber tint), `--celebrate` (coral), `--info` (blue), each with a dark value.
Brand ramps, `--primary`, `--accent` and the rating scale stay per palette. The **platform palette
is Sunlit Slate**: its brand ramp is already the logo slate; the foundation adds the cream ground
and the amber.

`apps/mobile/scripts/generate-palettes.mjs` learns the two foundation selectors, so the app's
generated tokens follow the same cascade.

**Type.** Headings in Nunito: on the web `--font-display` (replacing Poppins) through the existing
Google Fonts link; in the app `@expo-google-fonts/nunito` (installed with `npx expo install`),
loaded before the splash hides, mapped onto Paper's display, headline and title styles. No text
under 12pt in the app (the audit found 33 places at 10–11pt); uppercase micro-labels become
sentence case.

**Done when:** both clients typecheck; `responsive.spec.ts` and the web smoke pass; the app's jest
and the `smoke` flows pass; screenshots of Home in light and dark on both clients look right; the
contrast figures above are met (checked by a small script against the generated hex values).

**Status: done 2026-10-14.** Every palette passes `apps/mobile/scripts/check-contrast.mjs` (now
part of the app's typecheck). Paper's `outline` is the 3:1 control edge; cards use the new
`OutlinedCard` with the soft divider.

## Phase U2: the app's surface kit and create button

- **`StepFlow`** (`src/components/step-flow.tsx`): a full-screen modal route with "Step n of N", a
  segmented progress bar, a title, the step's body (never scrolls at default text size; scrolls
  only with large text), and a footer pinned above the home indicator with Back / Next (or Skip
  for an optional step). It keeps a draft in component state across steps, uses the existing
  unsaved-changes guard, and moves focus to the step title for screen readers.
- **`QuickSheet`**: a form sheet whose primary action is pinned at the bottom, for one decision or
  up to three inputs.
- **`SearchPicker`**: a list with search on top, large rows, a tick on the chosen one.
- **Create button**: a "+" in the middle of the tab bar opening an action sheet of the reader's own
  actions (Record a lesson, Start a lesson, Schedule a lesson, Add a student, Add a tutor, Record a
  payment), each shown only when the reader may do it. The top-right "+" buttons on Sessions,
  People, Billing and Schedule go; their empty states keep an inline button.

**Done when:** the shell flows (navigation, search) and every flow that tapped a top-right "+" are
updated and green on iOS and Android.

**Status: done 2026-10-15.** The system tab bar holds five items at most (Android throws past five,
iOS folds a sixth into its own More), so the app now draws its bar (`AppTabBar` over
`expo-router/js-tabs`): Home, Sessions, Schedule, **+**, Progress, More. That costs iOS 26's Liquid
Glass bar and its scroll-to-top on a second tap. The sheet also offers **Add someone else** (a
parent, an admin, several roles) to admins, since the People header "+" was the only general add.
A QuickSheet is a root ScrollView in a `fitToContents` form sheet (the only layout
react-native-screens resizes). Dev previews: `aimtrue://dev/kit`, `aimtrue://dev/kit-sheet`.
Details in `docs/mobile/build-log.md` #47.

## Phase U3: add a student (parent first) and add a tutor

**Student, app.** A step flow, opened from the create button and from People:

1. **Family**: search existing parents (cards with their children); choose one and the
   relationship (Mother, Father, Guardian, Other), mark the primary contact. **"New parent"** opens
   a quick sheet (name, email, phone, payment handles optional) that creates the parent on Save,
   exactly as today's nested "New parent…" form does (`guardian-bridge.ts`: the parent is its own
   `POST /users`, then chosen here). The student and their guardians are still sent in ONE request
   at the end, so the guardian rule is unchanged. More than one guardian is allowed.
2. **Student**: name; email only "if they will sign in themselves".
3. **School and goal** (skippable): school, current course or grade, the year's goal.
4. **When can they learn?** (skippable): a week of Morning / After school / Evening toggles, with
   "Fine-tune hours" opening today's exact hour grid. The bands map to hour blocks
   (Morning 7–12, After school 15–18, Evening 18–21).
5. **Lessons and price**: in person and/or online, longest lesson, the family's rates (admin).
6. **Review**, with an Edit link per step, then **Add**. Errors from the server go to the step
   that owns the field, and the flow jumps there.

After adding, the existing next steps (assess, plan, pair) are offered.

**Student, web.** In the Add user dialog, when the role is Student, the **Parents / guardians
section moves to the top**, with "New parent…" beside the search, so a family that is not in the
portal yet is added first, in the same dialog. The welcome wizard already goes family first.

**Tutor, app.** Step flow: Basics → Teaching (school, area, online, longest lesson) → Availability
→ Pay (rate, top-up) → Review. Mailing address and "SSN on file" leave creation: a **"Finish tax
setup"** card on the tutor's record, for admins, until both are set.

**Editing** a person stays the full form for now (U5 brings section editing).

**Status: done 2026-10-15.** Web: a new student's dialog opens with roles, then the family, with
"New parent…" creating the parent in place (`user-form.spec.ts`). App: `/add-student` and
`/add-tutor` step flows, a `/new-parent` quick sheet, the Finish tax setup card (a `tutor-tax`
section of the person form). Changes from the plan, all in `docs/mobile/build-log.md` #48:
- Steps were split to keep about three inputs each: the student's price is its own step (7 with
  Review), and the tutor gains a Background step (6).
- The flows rise as pushed cards (`STEP_FLOW_OPTIONS`), not `fullScreenModal`: on the iOS 27
  simulator a form sheet over a full-screen modal is missing from the accessibility tree. The
  welcome wizard now presents the same way.
- "In person" is assumed (the data has no flag for it); only "online too" is asked.
- A parent row's children come from the balances list (the parent rows carry none).

**Open before U7:** on iOS, `people/tutor-view` (red since 2026-10-14, before U3) and
`shell/surface-kit` (red on the U2 commit too, though green when U2 was built) fail; both are
green on Android. *Closed in U4: Maestro's reports were written inside Metro's watched folder
(`docs/mobile/build-log.md` #49); both green on iOS.*

**Done when:** new Maestro flows (student with an existing parent, student with a new parent,
tutor) pass on both platforms; the people flows pass; a web spec covers parent-first ordering and
a new parent added in the dialog; `exposure.spec.ts` is untouched and green.

## Phase U4: record a lesson and the student's reflection

- **Record a lesson**: from Next up, a quick sheet already filled with the student, today, the
  scheduled times and place: "It ran as planned" records it; "Different times" opens the time
  fields. From the create button, a step flow: Student → When → write-up. The **write-up** becomes
  four optional cards (Planned, Covered, Homework, Progress) with dictation, kept as a draft by the
  existing autosave. No money anywhere under Tutoring.
- **Reflection**: one question per card, answers as five faces with words ("Not really", "A
  little", "Some", "A lot", "Loads!"; difficulty and pace use "Much too easy" … "Much too hard"
  and "Much too slow" … "Much too fast", centred on "About right"), progress dots, then the
  homework note, then a thank-you. Stored values are unchanged (1–5).

**Done when:** the record, autosave, next-up and reflection flows are updated and green on both
platforms; jest covers the face-to-value mapping.

**Status: done 2026-10-15 (app).** Next up's Record is a fitted quick sheet ("It ran as planned",
"Different times", then "Write up the lesson"); the create button, Sessions' Tutoring button, the
quick action and a draft's Continue open the step flow Student → When → Planned → Covered → Homework
→ Progress. The previous-session review sits on Planned, last time's homework status and review on
Homework, and the writer's own assessment on Progress. Finance and editing a lesson keep the record
sheet. The reflection's words are now the shared labels (`REFLECTION_QUESTIONS`), so the app's
faces, the lesson's detail and the web say the same thing: "Not really" … "Loads!" for learning
and understanding, "Much too easy" … "About right" … "Much too hard", and "Much too slow" …
"About right" … "Much too fast". Details in `docs/mobile/build-log.md` #49.

## Phase U5: schedule, payment, assessment, section editing

- **Schedule a lesson**: Who → When (days, time, length) → Where (location cards, at most one in
  person and one online) → Review written as a sentence.
- **Record a payment**: a quick sheet: amount, who (filled from the screen it came from), method;
  date and reference under "More details". Finance only.
- **Assessment**: planned topics first; a five-step pill per topic that shows its word when chosen;
  levels collapsed until opened.
- **Section editing**: a person's record shows sections (Contact, School and goal, Availability,
  Lessons and price, Pay and tax, Family); Edit on one opens only that section (the form's existing
  `sections` support).

**Status: done 2026-10-15 (app).** Schedule a lesson is a step flow (`/schedule-lesson`) from the
create button, Schedule's button and the carousel's "Nothing scheduled"; its Review reads "Every
Monday, 4:00–5:00 PM, at Institute, room 2, starting Oct 19." (`scheduleSentence`, with jest
tests). Editing a schedule stays the sheet. Record a payment is a fitted quick sheet: the amount
large, who filled from a Billing row or a person's record (its menu) with Change, method chips, and
the date, time, reference and notes under More details. The assessment lists the plan's topics
first, then every level closed until opened, each topic with a five-step pill that shows its word
(`TOPIC_RATING_LABELS`). A person's record is in sections, each with its own Edit opening only that
section of the person form; "Edit everything" moved into the record's menu; Finish tax setup stays.
Changes from the plan, all in `docs/mobile/build-log.md` #50:
- A fifth step, **From when?** (start, an end, a note), keeps about three inputs per step.
- The lesson's mode follows its place; "Usually" is asked only when one of each is chosen. The
  free-text room note is no longer asked when scheduling (the edit sheet keeps it).
- The payment sheet's person list starts closed, so the sheet fits and its action stays in reach.
- A tutor's sections are **Background** and **Teaching** where a student's are School and goal and
  Lessons and price; a parent's ids are **Payment**.

## Phase U6: the homes

- Every role: a greeting ("Good afternoon, Priya") and **Today** first, then a compact row of
  figures in sentence case. Role chips move into the account sheet.
- Parents and students: child-centred cards (next lesson, this month's progress) and a small
  celebration in coral when a topic is mastered, stilled by reduce motion.
- Tutors: Next up, then "Finish write-up" for a draft left from today.

## Phase U7: release

Full local web suite, `npm run smoke` (web, iOS, Android), every Maestro folder on both platforms,
merge `ui-enhancements` into `main`, `npm run deploy` (both production Workers) with the usual
backup, and the personal build installed on the owner's iPhones.
