# Member home: one home per person, built for coming back (Phases 66-69, 2026-11-03)

The owner: "The unauth home page looks good. I want to bring some of those design achievements to the
authenticated home page. Different level tiles can be colored differently. They need some UX overhaul. ... The
goal of previous effort was to improve conversion. The goal of this effort is to improve stickiness. ... help
individual users of each user type find their most common action on the landing page and let them go with that
workflow. The users who landed for quest or assessment should have different workflow expectations."

Approved 2026-11-03 ("The plan is approved. Go for implementation"). Built on the branch `member-home-stickiness`:
after every phase, commit, push the branch and deploy to the test Worker and the test app without asking, then
go on to the next phase. **Production waits for the owner**, who validates the test app first.

Research: `reports/Member home stickiness by cohort.md` and its notes in
`research_notes/Member home stickiness by cohort/` (student, parent, tutor/admin and intent-based homes,
stickiness mechanics and metrics, production usage, the current homes).

## What production shows (2026-11-03, read-only aggregates)

- 3 spaces. One real tutor drives almost everything: a lesson recorded 22 times on 19 days, assessed 17 times,
  plus drafts and schedule fixes.
- Admins set people up, record payments and switch settings.
- Quest has 10 games (the owner testing), Assessment has 1, the Daily has none. Students and parents have not
  really signed in yet.
- So the tutor and admin homes are designed from evidence. The student, parent, Quest and Assessment homes are
  designed from the research, and Phase 69 measures them.

## The ten problems with today's homes

1. **No primary action for the web tutor.** Recording today's lesson takes about 6 taps, and the form defaults to
   16:00-17:00 instead of the schedule. The app's Phase 43 "Record it now" exists only in the app (parity row 58).
2. **Five stitched layouts.** Dashboard, AssessmentHome, PlayHome above the H1, a favorites row and the app's
   SpaceHome. The web and the app order them differently.
3. **The parent's web home leads with money** and never shows the next lesson.
4. **Several roles land on the wrong one** (admin > tutor > parent > student). A parent who also tutors but has no
   pupils lands on an empty tutor dashboard while their child has a lesson today.
5. **A newcomer loses what the guest page promised.**
   - Personal spaces offer Beast Academy only, though Phase 63 (P13) promised NC 2026 too. So "Grade 4 · Quick 5"
     becomes "BA1Q5 · Beta" and the guest's tiles don't carry over.
   - "Show your work" needs a student picked from an empty list.
   - Teens are offered admin actions the API refuses.
6. **Member tiles are flat codes** in identical grey cards. There is no colour, icon, human title or Today's 5
   rings.
7. **Quest is either invisible or doubled:** the Play home, plus a Question Quest redirect, plus the app's "Open
   Quest" card.
8. **The phone's first screen is mostly chrome.** On the admin's home, about 350 px come before any content.
9. **Only a player in the Play home sees the habit layer.** A parent can't see a child's week.
10. **Empty states lead nowhere.** Nothing flags lessons that were scheduled and never recorded.

## Cohorts (role × space × how they arrived)

| # | Cohort | Their question | Next up (the primary action) | Week strip |
| --- | --- | --- | --- | --- |
| C1 | Owner/admin of a tutoring space | "What needs me today?" | Unrecorded lessons, join requests, invitations, today's agenda | lessons this week · to record · waiting on you |
| C2 | Tutor | "Who's next, did I record the last one?" | Lesson just ended → **Record it now**; lesson soon → **Start**; reviews waiting | lessons this week · to record · reviews |
| C3 | Tutoring parent | "When's the next lesson, anything changed?" | Per child: next lesson or its cancellation, latest homework | per child: lessons this month, practice days of 3 |
| C4 | Practice parent (signed up from the guest page) | "Is my child practising, and getting it?" | A child's reviewed assessment; give one; **Play with <child>** | per child: days played of 3 |
| C5 | Tutored student | "What do I have to do?" | Assessment to continue; **Practise before <day>'s lesson**; the Daily | 7 day-dots (target 3), Daily rings |
| C6 | Quest player | "Let me play." | Game invite → Join; **Continue**; **Today's 5** | day-dots, rings, next badge, best |
| C7 | Assessment cohort | Student: "finish it". Giver: "give one, see results" | Continue / see reviewed; **Start an assessment** (≤2 taps) | assessments this month, reviewed |
| C8 | Several roles | "What's urgent across my hats?" | The most time-bound item of any hat wins; one section per hat | one line per hat |
| - | First week (any cohort) | "What can I do here?" | A guest-style checklist, already started (endowed progress) | checklist n of 4 |

## Requirements

- **H1. One member home, built from the same blocks for everyone, in an order set by shared code.** It replaces the
  five layouts on the web (`/`) and in the app (the Home tab). The blocks are:
  - the **band**: the guest band, slimmer — greeting, space and the hat's week strip;
  - **Next up**: one card, the primary action;
  - **quick actions**: at most 3;
  - the **sections**: Quest board, Assessments, Lessons, Children, Needs you, This week.

  The role dashboards stay at `/dashboard` (web) and More → Dashboard (app), with the role switch and "view as".
  Money stays on Finance; the member home carries none.
- **H2. Next up is chosen by a fixed priority, time-bound first** (`chooseNextUp` in shared `home.ts`):
  1. a lesson just ended and not recorded
  2. a lesson now
  3. a change to a child's lesson
  4. a game invite
  5. reviews waiting
  6. an assessment to continue
  7. a reviewed assessment
  8. practise before a lesson
  9. the Daily
  10. welcome back
  11. continue a quest
  12. a child's next lesson
  13. the office's needs
  14. the next lesson
  15. the focus's default

  "Later" skips an item for the day. Everything else on the page stays where it is: the HCI evidence is to copy
  the likely item to the top, never to reorder or hide.
- **H3. Hats exist only with content.** The hats are learner, tutor (a pairing in force), parent (a live child) and
  office (admin). Hats with something today come first (`orderHats`), so a parent who also tutors but has no pupils
  sees their child's lesson, not an empty dashboard.
- **H4. Focus.** The focus decides the order of sections and the default Next up (`deriveHomeFocus`). It is set by,
  first to last:
  1. the person's pin ("Make this my home"), stored in `org_members.home_pin`;
  2. their dominant activity in the last 14 days;
  3. how they arrived (`platform_accounts.arrived_via`, sent by the sign-up sheet: from a guest quest → Quest; from
     the guest Assessment → Assessment; invited as a tutor → Tutoring; as a parent → Family; made a space → Office);
  4. their roles.
- **H5. Coloured level tiles.** One hue per grade, 1-8: eight colour-blind-safe hues as `--grade-N` tokens, the same
  in every palette, light and dark, and regenerated for the app.
  - Beast Academy, AoPS and Kangaroo take their grade's hue, with an "Adv" mark.
  - The mode is shown by its icon (target, timer, pencil).
  - Each tile has a human title ("Quick 5", "5-minute dash", "Show your work"), the level's name, and the code shown
    small.
  - Colour is never the only signal (WCAG 1.4.1). The contrast pairs go in `check-contrast.mjs`, and a new check
    keeps neighbouring grades apart under colour-blind simulation.
  - Members read the real curriculum names; masking stays a guest-page rule. The guest home keeps its mode colours.
- **H6. The guest home's pieces are shared.** `QuestCard`, `TodayCard` (the Daily with five target rings) and the
  grade row move to `features/play/` on both clients and are used by the guest home and the member home alike.
- **H7. A newcomer keeps what the guest page promised.**
  - Personal spaces offer NC 2026 (the default) and Beast Academy, as P13 said, with a backfill block for existing
    personal spaces. The guest's grade then leads, and their tiles carry over as favorites.
  - "Show your work" works for oneself in a personal space.
  - Teens see no action the API refuses (`mayBringPeople`).
- **H8. The habit, made visible and kind.**
  - The weekly streak shows as 7 dots with the 3-day target.
  - "Welcome back" appears after a missed week, and every Monday is a fresh start. There are no loss messages.
  - Badges are information, not payment.
  - Children get no leaderboards, prizes or pushes (UK Children's Code, FTC).
- **H9. The tutor's day, on the web too.** Phase 43's Now card, celebration and brief come to the web, and Record it
  now opens the form prefilled from the schedule. Lessons scheduled in the last 7 days and never recorded are
  flagged under Needs you, for the tutor and for the office.
- **H10. Families.**
  - A parent's child card: next lesson or change, the latest homework, days played this week, and the Daily done
    today.
  - Those last two are counts only; this amends R18 as R29.
  - The parent's actions on it are **Play with <child>** (an existing game favorite with the child invited) and
    **Practise before <day>'s lesson** (for the student).
  - Phase 77 (2026-11-05, `docs/journey-fixes-plan.md` JF15, R35): "each on their own" changes for a child who does
    not sign in. **Play with <child>** is then a game on the parent's own device -- the child a seat, a solo team of
    their own beside the parent's, begun at once with no lobby or code, the parent's session answering for them
    (`playTogetherRequest`, `seat_user_ids`, `as_user_id`), at the child's grade (`HomeChild.grade`), with **Continue
    with <child>** while it runs (`HomeChild.open_game_id`, the reader's own seated game). The child's answers are
    credited to the child (days played, a family game) and never count toward the two-right-answers rule. A child who
    signs in (`HomeChild.signs_in`) keeps the online invite, and its lobby lists who was invited.
- **H11. One read for the home.** `GET /api/home` (`buildMemberHome`) makes one batch per hat present.
  - Expected cost: about 50-350 rows for a learner and 200-500 for a tutor.
  - The office block is memoised 60 s per space.
  - It takes no person; each part is narrowed like its own route (R29) and joins `exposure.spec.ts`.
  - `GET /api/home/tutor` stays, gated to Tutoring, for older apps.
- **H12. Stickiness, measured (Phase 69).** `visit_days` holds one row per person, space and day: the day on the
  space's clock and the first client that day, nothing else.
  - It is written at most once a day per person and space, memoised.
  - A daily cron rollup builds `platform_settings` 'stickiness'.
  - The console's **Stickiness** page shows:
    - weekly actives over monthly actives;
    - days played per week;
    - "met 3 days last week, again this week";
    - retention at weeks 1, 4 and 8, by hat × space kind × arrival;
    - Daily completion;
    - return within 7 days of a missed week.
  - Groups smaller than 5 people are suppressed. The rows are purged with the space or the account (R30).
  - If the privacy notice does not cover it, a new legal version is drafted for the owner's approval before it is
    switched on.

## Decisions (the plan as approved)

1. Tiles are coloured by grade. The guest home keeps its mode colours.
2. Members read real curriculum names; only the guest page masks them.
3. Personal spaces start with NC 2026 (default) and Beast Academy.
4. One merged home for people with several roles.
5. A parent sees a child's days played and Daily done (counts only, R29).
6. Visits are recorded in Phase 69, after checking the privacy notice.
7. The order is 66, 67, 68, 69.

## Phases

- **Phase 66: one home, one Next up.**
  - Shared `home.ts` (`chooseNextUp`, `orderHats`, `homeLayout`, `quickActionsFor`) and `GET /api/home`.
  - The member home on both clients, with Phase 62's Play home as the Quest board for now.
  - The web gets the Now card and the prefilled Record it now.
  - The 7-day "to record" flag; the merged multi-role home; teen-safe quick actions; `QuestLanding` becomes a Next
    up item.
- **Phase 67: coloured tiles and a newcomer's continuity.**
  - The grade tokens and checks; the shared QuestCard, TodayCard and grade row; the Quest board.
  - The Daily as rings; week dots; welcome back; next milestone.
  - Personal spaces with NC 2026 and Beast Academy (plus the backfill); guest tiles carried over; "Show your work"
    for oneself.
- **Phase 68: focus and families.**
  - The pin and arrival columns; the assessment-led workflow.
  - The parent's child strip (R29); Play with <child>; Practise before the lesson.
- **Phase 69: the Stickiness page.** `visit_days`, the cron rollup and the console page on both clients (R30).

Each phase ships web and app together:
- typecheck clean, `npm run smoke` green on both platforms, and the phase's specs and flows green;
- its additive SQL fenced `release=phase-NN` in `docs/database.md`;
- `docs/mobile/parity.md` and `progress.md` updated.

## The technical design (from the design pass, checked against the code)

**Shared**
- `packages/shared/src/home.ts`: the hats and focuses, `NextUpKind` in priority order, `MemberHome`,
  `chooseNextUp`, `deriveHomeFocus`, `orderHats`, `homeLayout`, `quickActionsFor`, and `START_LEAD_MINUTES = 15`
  (one constant for both of the app's modules).
- `habit.ts`: `weekDots`, `welcomeBack`, `nextBadge`.
- `tile-look.ts`: `levelGrade` and `tileLook`, generalising `guestLevelPlace`.
- `spaces.ts`: `mayBringPeople` and `PERSONAL_SPACE_CURRICULA`.

**API**
- `apps/api/src/index.ts`: the Tutoring guard moves from `/home` to `/home/tutor`.
- `repositories/home.ts` `buildMemberHome`:
  - The hats are one statement of EXISTS checks.
  - Each hat is a batch:
    - **learner:** habit days, today's Daily, an assessment in progress, the next lesson;
    - **tutor:** the refactored `buildTutorHome`, with a 7-day lookback and `together` limited to the students
      shown;
    - **parent:** the children's schedules and cancellations, `activity_days` for this week, reviewed assessments;
    - **office:** schedules, sessions since the month start or the last 7 days, open join requests, invited
      members.
- Client-side candidates: the game invite (the existing waiting poll), Continue (the device's last quest), and the
  guest's lead level.

**Web**
- `/` renders `features/home/member-home.tsx`; `/dashboard` keeps the role dashboards.
- `features/home/` holds `api.ts`, `home-band.tsx`, `next-up-card.tsx`, `quick-actions.tsx` and `sections/*`.
- Ports from the app: `NowCard`, `CelebrateCard` and `BriefCards`.
- `SessionFormDialog` gains a `planned` prefill.
- `HaveACode` is exported.
- The onboarding tour's `data-tour` targets that leave `/` are re-pointed.

**App**
- `(tabs)/dashboard/index.tsx` renders `MemberHomeScreen`, which uses the same block names as the web.
- `SpaceHomeScreen` retires.
- The schedule card `TodayCard` is renamed `ScheduleTodayCard`, so the name is free for the rings card.

**Schema blocks** (in `docs/database.md`)
- `phase-66`: partial indexes for invited members and assessments waiting for review.
- `phase-67`: NC 2026 for existing personal spaces.
- `phase-68`: `org_members.home_pin` and `platform_accounts.arrived_via`.
- `phase-69`: `visit_days` with its triggers, plus `activity_days_day_idx`.
