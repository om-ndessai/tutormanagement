# Current signed-in homes: inventory (2026-11-03)

This inventory was surveyed from the code (web and app) and from SELECT queries on the local D1, with no screenshots. Notes marked "est." on what is above the fold are worked out from the CSS.

## What the local seed actually contains

- **Quest is off in every tutoring space.** chmi and riverside have `gamify_question_quest=0`. assess is not allowed Quest at all (`feature_quest=0`; it is Assessment only). newfield has every feature on but 0 members. So no tutoring persona sees the Play home locally.
- **Only the personal spaces show the Play home.** The `s-*` spaces are left over from e2e runs, e.g. Gale Guest `guest-mw0pxdfi@example.com` in `s-6m5e59s5`, approved adult. Each person there has the `admin` role.
- **The local data is plain seed.** `seed:scenarios` has not been run: 0 assessments, 0 games, 0 activity_days, 0 favorites everywhere.
- **Settings:** `platform_settings.play = {play_home:true, min_depth:50, daily:true}`. Guest play is disabled locally.
- **Today (Tue 2026-11-03):**
  - Alex has Sofia at 16:00 today, and Ben on Saturdays at 10:00.
  - Priya has Sanjay on Thursdays at 17:00.
  - The last lesson recorded anywhere is 2026-09-15, although the schedules ran on since then.
- **Personas, with their roles per space:**
  - Priya `priya.raghavan@gmail.com`: chmi admin+tutor; riverside tutor.
  - Alex `alex.chen.math@gmail.com`: chmi tutor; riverside parent of Lily.
  - Anita `anita.patel.nc@gmail.com`: chmi parent of Sanjay; riverside parent of Sanjay and Arjun.
  - Sofia `sofia.okafor@gmail.com`: chmi student, with a learning plan, so no goal banner.
  - Sanjay: chmi student+tutor (tutors Ben); riverside student.
  - Maria `maria.okafor@gmail.com`: chmi parent (of Sofia) + tutor, with **no pairings**.
  - Rosa: riverside admin.
  - Ines `ines.ferreira.assess@gmail.com`: assess admin+parent.
  - Omar: assess parent.
  - Noor: assess student, **no email, so she cannot sign in**. No student who can sign in exists in a space without Tutoring.

## How the home is chosen

**Web**
- `apps/web/src/App.tsx` index route renders `<QuestLanding/>` and `<DashboardPage/>` inside `AppShell` (`components/layout/app-shell.tsx`).
- `pages/dashboard-page.tsx` decides:
  - **Tutoring not on:** `AssessmentHome` (`features/dashboard/assessment-home.tsx`), with `lead=<PlayHome/>` if Quest is on.
  - **Tutoring on, student role and Quest on:** `PlayHome` above `TutoringDashboard`.
  - **Tutoring on, other roles, Quest on:** the `PlayFavorites compact` row and `WaitingForYou` above `TutoringDashboard`.
  - `TutoringDashboard` holds: `LessonReminderSheet`, then the `PageHeader` ("Dashboard", the brand name, and the Getting started / role Select / admin UserPicker controls), then one of `AdminView`, `TutorView`, `ParentView` or `StudentView` (`features/dashboard/role-dashboards.tsx`).
- **Landing role:** `defaultDashboardRole` (`packages/shared/src/dashboard.ts:207`) picks admin, then tutor, then parent, then student.
- **Quest landing:** `QuestLanding` (`features/quest/quest-page.tsx:203`) sends a student with a question waiting to `/quest/play`, and a tutor with reviews waiting to `/quest/review`, once per tab. It reads `organization.gamify_question_quest` directly rather than through `featureOn`.
- **Signed out:** `features/auth/require-auth.tsx` shows `GuestHome` at `/` when `config.guest` is set.

**App**
- `apps/mobile/src/app/(org)/(tabs)/dashboard/index.tsx` renders `QuestLanding`, then `DashboardScreen` (`features/dashboard/dashboard-screen.tsx`) when Tutoring is on, else `SpaceHomeScreen` (`features/dashboard/space-home-screen.tsx`).
- **Tab bar** (`features/shell/app-tab-bar.tsx`):
  - With Tutoring: Home · Sessions · [+ hump] · Progress · More.
  - Without Tutoring: Home · More.
  - The "+" (`create-actions.ts`) offers Record a lesson, Start a lesson, Schedule a lesson, the Add actions and Record payment; without Tutoring, admins get only Start assessment, Add student and Add person.
  - The "+" never offers Play.

## Per persona

### 1. Admin of a tutoring space (Priya, chmi; Rosa, riverside)

**Web: Tutoring tab** (`AdminView`)
- **Sections in order:**
  - PageHeader. Priya's has three rows of controls at 390, because the role Select (`w-full`) and the UserPicker (`w-full`) wrap: Getting started; role select; "My own dashboard" picker.
  - Tutoring | Finance tabs.
  - **Analytics:** compact StatCards, 2×2 at 390 — Students, Tutors, Parents, Sessions running.
  - **Tutoring Sessions:** `SessionsCarousel` — the last 5 lessons, "now", then the next ones. Cards link to `/sessions?focus` or `/schedule?focus`. **No record or start buttons.**
  - **Progress:** `ProgressSpotlight` of 5 random students.
  - **Recent Activity:** 5 events.
- **Above the fold at 390 (est.):** about 350 px of chrome (56 px header, H1, brand line, three control rows, tabs). Then Analytics and the top of the carousel.
- **Metrics:** counts only, no money.

**Web: Finance tab** (`?tab=finance`)
- 4 money StatCards: Owed to tutors, Owed by families, Billed all time, "Kept by CHMI" with a "Paid out" hint.
- Then TutorPayments, MonthlyFinance, YearEndPanel, the SSN panel, and Families with a balance (top 5).
- A space paid directly (solo) shows instead: Owed to tutors by families, Paid to tutors, Lessons all time, Families and tutors, Monthly.

**Common jobs (web, 390)**
- Today's lessons: there is no "today" summary anywhere. The carousel shows the next lesson; the schedule is ☰ → Schedule, 2 taps.
- People: tap the Students card (1) or ☰ → Users (2).
- Money: the Finance tab (1).

**App**
- **Order:**
  - Greeting ("Good morning, Priya" + CHMI).
  - InvitationBanner.
  - PlayFavorites/Waiting, if Quest is on.
  - **TodayCard** ("N lessons today · Next at 4:00 PM: Sofia with Alex"), which taps through to Schedule.
  - SegmentedTabs Tutoring | Finance.
  - Tutoring tab: **TutorNow** first (Priya tutors Sanjay, so her own pairings: NextCard and BriefCards), then the Sessions carousel, then Progress.
- **Moved off Home:** Analytics and Recent Activity are on More → Dashboard since Phase 43.
- **Finance tab:** `finance-views.tsx` `AdminFinance`, the same content as the web.
- **Header:** the eye icon (view-as), search, account.

### 2. Tutor (Alex, chmi; Kwame, riverside)

**Web** (`TutorView`)
- **Sections in order:** Dashboard H1, Getting started, tabs, then:
  - Analytics: Students, Sessions, Sessions running.
  - Tutoring Sessions carousel, with the next card highlighted: "Sofia · in 6 hr".
  - Student Reflections.
  - Progress spotlight.
  - Recent Activity.
- **Finance tab:**
  - An "Action needed: your SSN" panel, if missing.
  - Earned, Paid to you, Owed to you, and Advance held when on top-up.
  - Monthly.
  - Payments to you.
- **Above the fold (est.):** title, Getting started, tabs, Analytics (2 rows), the carousel, the start of Reflections.
- **Primary action:** none on the home.
- **Taps to record today's lesson (web, 390): about 6** — ☰ → Sessions → "Record a session" → open the pairing select → pick (Alex has 2 pairings) → Record session.
  - The form defaults to today 16:00–17:00 (`session-form-dialog.tsx` ~L213), hard-coded, not taken from the schedule.
  - Start a live lesson is also about 6: ☰ → Sessions → Start session → student → Start.
  - The web has no record-from-schedule action.
- **Unrecorded lessons:** not flagged anywhere. The seed has 7 weeks of unrecorded scheduled lessons.

**App** (`TutorTutoring`, plus `features/home/{tutor-now,now-card,brief-cards}.tsx`, `finish-write-up.tsx`)
- **Order:**
  - TodayCard: "1 lesson today / Next at 4:00 PM with Sofia".
  - Tabs.
  - **Now card:** "Good morning, Alex" / "Sofia's lesson is today at 4:00 PM, in 6 h …", chips for place, homework and next topic, Directions or Open the link, **Start lesson** from 15 min before, else See the plan.
  - After an unrecorded lesson ends, it becomes the green "Yay! You completed one more lesson with Sofia", with confetti and **Record it now**. That opens `/record-as-planned` prefilled from the schedule: **1 tap**, plus submit.
  - Brief cards: Homework from last time, Where, Next on the plan, last notes (hidden until tapped).
  - Sessions carousel; Finish write-up (today's draft); Student Reflections; Progress.
- **Otherwise:** "+" → Record a lesson is 2 taps.
- **Duplication:** TodayCard and the Now card both state the next lesson. The parity tracker records this half as "Web owed" (`docs/mobile/parity.md` row 58).

### 3. Parent (Anita: Sanjay has 2 lessons and a Thursday 17:00 schedule)

**Web** (`ParentView`: no tabs, by design)
- **Sections in order:**
  - Dashboard H1, Getting started.
  - **StatCards: Children, Charged $, Outstanding $** (hint "$X paid"). At 390 they are **one column, non-compact** (`sm:grid-cols-3`): about 280 px for three numbers.
  - "What you owe each tutor", for spaces paid directly.
  - "Your children": one BalanceRow per child ("2 sessions · $X charged", with a $ balance).
  - ReflectionPrompts "Reflect with your children".
  - A StudentProgressCard per child.
  - "Recent sessions", with SessionMoney ("You pay").
  - "Your payments".
- **Above the fold (est.):** the H1 and the three money/count cards, then the start of Your children. **Money is the first content.**
- **Next lesson: not on the home at all.** ☰ → Schedule is 2 taps, and Schedule lists series, not "next".
- Progress: on the home, after scrolling.
- Pay: the Outstanding card → Billing (1 tap). There is no online payment.

**App** (`parent-balance-view.tsx`, `child-card.tsx`)
- **Order:**
  - Greeting.
  - **TodayCard** for the children.
  - FigureRow: Children, Charged, Outstanding — money, but compact and on one row.
  - **ChildCard per child**: "Next lesson …", this month with a meter, the plan line, and a coral celebration for a mastered topic. Tapping it opens progress.
  - Reflections, direct balances, the Balances panel, progress cards, recent sessions, payments.
- **Effect:** the next lesson takes 0 taps on the app, against 2 or more on the web.

### 4. Student in a tutoring space (Sofia, chmi; Quest off locally)

**Web** (`StudentView`)
- **Sections in order:**
  - Dashboard H1, Getting started.
  - Goal banner ("brand-gradient"), only when there is a goal and no plan; Sofia has a plan, so it is hidden.
  - StatCards, **single column at 390**: Sessions, Time tutored, Tutors.
  - ReflectionPrompts "How did your lessons go?".
  - "Your progress" card.
  - "Your tutors".
  - "Your sessions" (no money).
- **Missing from the home:** the next lesson, assessments and Play.
- **Assigned assessment:** ☰ → Assessment → Continue, 3 taps.
- **With Quest on:**
  - `PlayHome` renders **above** the "Dashboard" H1, so the page title sits mid-page.
  - `QuestLanding` first throws the student into Question Quest `/quest/play` once per tab, if a question is waiting. That is a takeover, and it goes to Question Quest, not the Play home.
- **Taps:** with Quest on, a quest, the Daily or Continue is 1 tap.

**App**
- **Order:** Greeting; PlayHome (if Quest is on); TodayCard; FigureRow; ChildCard (self: "Your lessons", next lesson); goal; reflections; progress; tutors; sessions.
- **Effect:** with Quest on, the next lesson is pushed below all the tiles.

### 5. Space without Tutoring (assess: Ines, admin+parent; a student from code)

**Web** (`AssessmentHome`)
- **Sections in order:**
  - PageHeader "Home" + "Ferreira Family Practice: assessments answered by hand, one question a page, with a PDF for whoever reviews them."
  - PlayHome — not in assess, where Quest is not allowed.
  - "N waiting for your review" line.
  - `StartCard` ("Start an assessment": a Student select, a Level select, Start, and a paragraph of fine print).
  - `AssessmentList` ("No assessments yet.", with no call to action).
- **A student there** (`onlyStudent`): the StartCard drops the Student select, leaving Level and Start.
- **Taps:** start an assessment is about 5 (student select ×2, level ×2, Start).
- **Metrics:** none. There is no habit card unless Quest is on.

**App** (`SpaceHomeScreen`, `features/dashboard/assessment-home.tsx`)
- **Order:** Greeting; InvitationBanner; PlayHome (if Quest); AssessmentHome; QuestCard.
  - AssessmentHome:
    - Students / "Your children" / "Your assessments" panel, with per-student Continue and Start buttons, and "No students yet." plus **Add a student** for admins.
    - Waiting for review.
    - Recent, with a Beta pill.
  - QuestCard: "Question Quest — Open Quest", which **duplicates the Play home above it**.
  - An AssessmentOffCard or an empty state when features are off.
- **Effect:** a student continues an assessment in 1 tap on the app.

### 6. Newcomer with only a personal space (Gale Guest, `s-6m5e59s5`; Phase 63)

**How the space is made**
- `routes/auth.ts:920-940` calls `createSpace` with `personal`.
- It is set up with:
  - the curriculum **`ba` (DEFAULT_CURRICULUM_ID, `packages/shared/src/progress.ts:40`)**, i.e. Beast Academy only;
  - Assessment and Quest on, Tutoring off;
  - the maker as **`admin`** — a teen too.

**Web** (AssessmentHome with the PlayHome lead)
- **Sections in order:**
  - "Home" + "Gale's space: assessments answered by hand…".
  - **Play:** H2 + "New Quest" outline button, then:
    - Continue — only after a first quest on this device;
    - `MyProgressCard` (flame ring, "Start a streak", "0 of 3 days this week", "Your first badge is one quest away.");
    - an outline button "Today's Daily · **BA1D**";
    - Favorites and Waiting (empty, hidden);
    - "BEAST ACADEMY" tiles BA1Q5, BA1T10 … BA5T10, then "ART OF PROBLEM SOLVING" PREQ10, ALGQ10, GEOQ10 — all marked **Beta** (0 approved, 96–176 checked);
    - "Have a code?" box.
  - "Start an assessment" card with an **empty Student dropdown**: the admin has no students, and there is no hint.
  - "No assessments yet."
- **Above the fold (est.):** title and description, the Play row, My progress, the Daily button, about 4–5 rows of BA tiles.
- **Taps:** play is 1 tap. "Show your work" for oneself is impossible, because the StartCard needs a student.

**App**
- Greeting; PlayHome; AssessmentHome ("Students — No students yet. Add a student"); QuestCard "Open Quest"; tab bar Home · + · More.

**Break with the guest home**
- A guest who picked "Grade 4" saw "Quick 5 · Grade 4". Their member home shows BA codes.
- `guestLeadLevel` = NC26.4 is not in the list, so the Daily falls back to `list[0]` = BA1.
- Guest-played tiles (G4Q5…) cannot carry over as favorites (`useCarryGuestTiles` drops codes not in the list).
- Member tiles exclude assessment tiles (`members:false` in `quest-tiles.ts:242`).

**Teens**
- No client knows about teens; grep finds no teen or age-band handling in web/ or mobile/src.
- A 13–17 admin is offered Add a student (app) and Start an assessment, which `routes/users.ts:178` refuses.

### 7. Several roles

- **Maria (chmi, parent+tutor, no pairings):**
  - Lands on the **tutor** dashboard, which is all zeros: Students 0, an empty carousel, "No students assigned to you yet." (and on the app, TodayCard "No lessons today").
  - Her child Sofia's 4 PM lesson today is one role switch away: the web header Select, or the app's account-sheet chips.
- **Sanjay (chmi, student+tutor):**
  - Lands on the tutor view.
  - With Quest on, he would get the **full student PlayHome above a tutor dashboard**, because the condition is `roles.includes('student')`.
- **Priya (admin+tutor):**
  - Web: admin view with Getting started, the role Select and the view-as picker.
  - App: admin plus her own Now card.
- **Alex (tutor in chmi, parent in riverside):** what he sees depends on the space switcher, not on role.

## Level tiles, member and guest side by side

**Member, web** (`features/play/play-home.tsx:176-219`)
- Neutral shadcn `Card` with no colour.
- The code is the headline (`font-display text-lg`, e.g. "BA3Q5", "G4T10"), with words underneath in muted xs ("Beast Academy 3 · 5 questions").
- A grey "Beta" badge, a star button, and "Best N" in primary.
- Grouped under uppercase muted headings — NC standards, NC standards (2017), Beast Academy, Art of Problem Solving, Math Kangaroo — in a 2/3/4-column grid.
- No icons, no lock state, no grade picker, no kind or timed colour.

**Member, app** (`features/play/play-home.tsx:200-265`)
- The same, as an OutlinedCard with the code in a **monospace** font, 2 per row on a phone.

**Member Daily**
- Only an outline button, "Today's Daily · G4D" (`habit-model.ts:54`).

**Guest, web** (`features/guest/guest-home.tsx`) — what it does well and the member home lacks:
- **The band:** a deep brand-900→800 gradient with faint bullseye rings, the logo on a white tile, a two-line headline "Math quests. / Hit the target." with the second line amber, a **checklist** of 4 promises with amber checks, a white pill CTA, and the console's home-bar line.
- **TodayCard ("Today's 5"):** a card raised over the band's edge, 5 target rings that fill as hits, the line "Five questions. Can you hit all five?", an **amber** "Play today's 5" button, and "You hit 3 of 5 today / A new five tomorrow" afterwards.
- **The grade radio row:** 1–8 pills, 44 px targets, remembered on the device.
- **QuestCards:** a coloured top band — primary for count, **amber for timed**, a light tint with a big **lock** for locked — with an icon (Target, Timer, PencilLine, Lock).
  - Human titles: "Quick 5", "10 in a row", "5-minute dash", "Show your work".
  - A detail line: "5 questions", "Beat the clock".
  - "Free account" with a lock, "Best: N", elevation shadows, rounded-2xl.
- **Curricula hidden:** "Grade 4" and "Adv G3–4", never "Beast Academy"; an "Advanced" section.
- **"Play together":** a big example code, an avatar stack, and a CTA.
- FAQ details; a 3-link footer.
- **App guest home:** `apps/mobile/src/features/guest/guest-home.tsx` mirrors all of this.

## Where the app's homes differ from the web's

**Only the app has:**
- A greeting on the space's clock.
- A **TodayCard** for admin, tutor, parent and student.
- **Phase 43's Now card and brief** (Record it now, Start lesson, directions).
- **ChildCard** per child and for the student themselves (next lesson, month meter, celebration).
- Finish write-up.
- Analytics and Recent Activity moved to More → Dashboard.
- The "+" hump.
- The QuestCard on the space home.

**Only the web has:**
- The Analytics row on Home.
- Recent Activity on Home.
- A "Getting started" button on every dashboard.
- The PageHeader H1 "Dashboard" / "Home".

## The 10 biggest UX problems, ranked

1. **The web tutor home has no primary action.** Recording today's lesson is about 6 taps through ☰ → Sessions, and the form defaults to a hard-coded 16:00–17:00 instead of the schedule. The app's Now card (Record it now / Start lesson) is app-only, and the parity tracker records "Web owed".
2. **There is no single member home.** At least five layouts are stitched together by space type × role: Dashboard, AssessmentHome, PlayHome bolted above (and *above the H1*), a PlayFavorites row, and the app's SpaceHome. The web and the app also order things differently (Today, Now and Child cards exist only on the app).
3. **The parent's web home leads with money and never shows the next lesson.** Charged and Outstanding come first, with per-child $ balances. The next lesson needs ☰ → Schedule. The app solves this with Today and child cards.
4. **Multi-role landing picks the wrong hat.** admin > tutor > parent > student lands Maria (no pupils) on an empty tutor dashboard while her daughter has a lesson today. Sanjay (student+tutor) would get the student Play home stacked over the tutor dashboard.
5. **The newcomer's home breaks the guest's promise.**
   - The personal space offers Beast Academy only, so "Grade 4 · Quick 5" becomes "BEAST ACADEMY · BA1Q5 · Beta".
   - The Daily becomes BA1D, and guest favorites don't carry over.
   - There is no grade row and no "Show your work" tile.
   - The assessment card asks for a student from an empty list.
   - Teens are shown admin actions the API refuses.
6. **Member tiles are flat internal codes.** BA3Q5 and G4T10 are the headline, every tile is an identical neutral card, every one is "Beta", and the curriculum names are exposed. The guest's coloured, iconed, named, lockable cards are missing, as is the target-ring TodayCard; the Daily is a plain outline button.
7. **Quest is either invisible or doubled.**
   - It is off in every seeded tutoring space.
   - Where it is on, the Play home competes with Question Quest: the "Quest · Beta" nav item, `QuestLanding` auto-redirecting to `/quest/play`, and the app's extra "Question Quest — Open Quest" card under the Play home.
   - The "+" sheet never offers Play.
8. **Phone chrome eats the first screen on the web.**
   - Admin: about 350 px before any content (H1, brand line, Getting started, a full-width role Select, the full-width view-as picker, tabs).
   - Parent and student: stat cards in one column (`sm:grid-cols-3`), about 280 px for three numbers.
9. **The habit layer is thin and narrowly placed.** `MyProgressCard` appears only inside PlayHome — students, or spaces without Tutoring. Tutors, parents and admins never see a streak, and a parent can't see a child's. Its copy is passive ("Start a streak", "Your first badge is one quest away") and there are no weekly dots.
10. **Empty and dead-end states, and nothing to do.**
    - A tutor with no pupils gets Analytics of zeros and empty sections.
    - "No assessments yet." has no call to action.
    - The student's tutoring home shows no assessments and no next lesson.
    - Nothing on the web home flags lessons that were scheduled but never recorded; the seed has 7 weeks of them.
