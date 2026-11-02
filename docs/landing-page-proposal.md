# Landing page proposal: the signed-out home (2026-11-02)

The owner asked for market research and a few proposals for the signed-out landing page, the guest
Play home (`GuestHome` on the web, `apps/mobile/src/features/guest/guest-home.tsx` in the app):
"Everything from header to footer needs fixes. The footer details are unnecessary. Only privacy
policy and terms link, and contact us is needed." It is the most significant page for conversion.

The proposal page with working mockups is published as an Artifact, "Aimtrue Front Door"
(https://claude.ai/artifact/LTXzTFVPwdXKA2XuyYaLwB, private to the owner). This
file is its record in the repo. **Nothing here is scheduled** until the owner picks a direction.

## The page today (tutoring-test, 2026-11-02)

- On a phone the first quest is below the first screen: 25 grade and curriculum chips fill it.
- Tiles lead with codes ("G4Q5") that mean nothing to a child or a parent.
- The grey "Playing as a guest" bar is read first, before anyone has played: a warning, not a welcome.
- Locked tiles carry a "Free" badge, so they look playable; a tap opens the sign-up offer.
- The parent's only sign-up button is outlined, at the bottom, labelled "Get started free"; the header
  offers only Sign in.
- Nothing shows the product: no question, no progress.
- The footer line mixes claims ("No ads… checked twice") with two small grey links, and there is no
  way to contact anyone. The privacy notice (`packages/shared/src/legal.ts`) names no operator,
  address, phone or email either.

## What the research says

| Finding | Source |
| --- | --- |
| Deferring sign-up raised Duolingo's DAU ~20%; tuning soft walls later +8.2%. Soft walls before a hard wall; a quiet "Later" beat a loud "Discard". | First Round Review interview (not a paper) |
| 57% of viewing time is on the first screenful, 74% on the first two; visitors decide in ~10 s. | NN/g, scrolling and attention; how long users stay |
| "Get started" pulls people in before they understand; name the outcome. | NN/g, "Get Started" stops users |
| Don't make visitors pick an audience; lead with the task, keep grown-up links quiet. | NN/g, audience-based navigation; children's websites |
| Children reject anything aimed below their age ("for babies"); teens prefer clean designs. | NN/g, children's websites; teenagers on the web |
| Product images are studied; decorative ones ignored. | NN/g, photos as web content |
| COPPA: a prominent, clearly labelled privacy link on the home page (tiny grey footer print is not prominent); the notice lists the operator's name, address, phone and email. | 16 CFR 312.4(d); FTC COPPA FAQ C.7 |
| Small counters backfire as social proof; show specifics. | VWO case study (vendor) |
| Faster pages convert: Vodafone's 31% better LCP gave +8% sales. | web.dev case study |

## What the market does (checked 2026-11-02)

Each home page was loaded at phone and desktop size and its main button clicked through (* = from
articles, not clicked through). Most kids' math brands still ask for an account first.

| Product | To the first question | Account before play? | Main button | Stands out |
| --- | --- | --- | --- | --- |
| Brilliant K–5 practice (beta) | 1 click | No ("no account required") | Start | Closest to Aimtrue; "Coming soon" grades; soft banner sells the next step |
| Duolingo Math | ~13 taps of setup | No; asks after the first lesson* | GET STARTED | Every setup answer gets a cheer |
| IXL | ~2 clicks to a skill | No, daily cap* | Join now (phones) | Live counter; names NC standards |
| Math Playground | 1-2 clicks | No | Game tiles | Full-screen ad drawn as grade buttons |
| 99math | A live game, by code | Code to join | Enter code (header) | Plain trust list: no ads, COPPA, inactive accounts deleted |
| Brilliant | ~12 setup screens | Then "ask a parent" at age 12 | I'm a learner / I'm a parent or teacher | Real problem cards as hero; kidSAFE seal |
| Prodigy | None as a guest | Sign-up form on Play now | Teachers, get full access for free | Full-screen role picker first |
| Khan Academy | None as a guest | Date of birth first | Student / Family / Teacher / School | Written for districts |
| SplashLearn | None as a guest | Parent account | Parents, try for free | "Kids see fun. You see real learning outcomes." |
| Synthesis Tutor | None as a guest | Parent account | Try it for free | Parents only; product video |
| Beast Academy | None as a guest | Yes | ENROLL NOW | Comic style; "20,000+ problems" |

- **What the best share:** one job above the fold with one filled button; the real product in the
  hero; a grade picker as the way in; a child-safety block for parents ("Is it safe for my child?").
- **Worth borrowing:** "no account required" said outright (Brilliant K–5); a plain trust list (99math);
  naming North Carolina's standards (IXL); a human note from whoever writes the questions; later, a
  "Have a code?" entry for family games.
- **To avoid:** setup that ends in a consent wall (Brilliant); stacked pop-ups on phones (IXL,
  Prodigy); ads, worst disguised as navigation (Math Playground); sign-up or payment as the first
  button; stale dates and copy errors.

## The fixes all three directions share

1. **Header:** mark and name; "Sign in" a quiet text link; no tagline on phones. The grey guest bar
   goes (the console's `home_bar` text with it, or as a small line under the headline).
2. **Headline a child can read:** about ten words at a grade 2-4 reading level ("Free math quests for
   K–8"), then "No account. No ads."
3. **Grades in one row:** K, 1-8 and Math 1 in one scrolling row, in order; Beast Academy, Math
   Kangaroo and AoPS behind "More". The quests stay in the first screen at 360×640.
4. **Quests in words:** "5 questions · about 3 minutes", "5-minute dash", with an icon and Play. The
   code stays for share links (`/play/G4Q5`).
5. **Locked quests as one offer:** one card or line ("Free with a grown-up's account: 10-question
   quests, 20-minute challenges, family games"), no "Free" badge on something that can't be tapped.
6. **A grown-ups section:** progress against NC standards, family games with one code, hand-written
   assessments; the button says what it does ("Create a free family space"); and three short answers:
   Is it free? Is it safe for my child? Which grades?
7. **Claims you can prove**, near the play area: no ads, guests aren't tracked, every question
   checked twice, NC standards (2017 and 2026).
8. **Footer:** Privacy · Terms · Contact us, at body size and in the link colour.
9. **The app** gets the same layout (feature parity); touch targets ≥ 44 px, bigger for K–2.

## Three directions

- **A. Clear path** (small; no API change). Today's page tidied: one headline, the grade row, two big
  quest cards (the first filled), one unlock card, the grown-ups section, the footer. 2-3 days on
  both clients. Still shows no product to a parent who doesn't play.
- **B. Question first** (medium; recommended). The hero is question 1 of a real quest from the
  grade's guest pool (already public, versioned and cached): answering it starts the quest, so the
  first answer is one tap from arriving, and the question is the product shot for a parent. "Or pick
  a quest" and the unlock line follow; then the grown-ups section. About a week on both clients; one
  more request on arrival (the pool). The grade defaults to the device's last, else Grade 4.
- **C. Quest board** (large). A deep slate band with the bullseye's rings, an amber play accent, a
  guest "Today's 5" card (new: a date-seeded draw from the guest pool on the device; members' Daily
  stays theirs), quests as game cards, a family-game preview with a join code and a progress preview
  for parents. About two weeks, and a brand decision first.

## Recommendation

1. **Step 1 (days):** the shared fixes on web and app, and the contact address in the privacy notice.
2. **Step 2 (about a week):** B's question-first hero.
3. **Later, if the counts say so:** C's game cards, amber accent or a guest "Today's 5".

Measure with the anonymous counts that already exist (`packages/shared/src/play-events.ts`):
`home_viewed → first_answer → quest_finished → nudge_accepted → signup_started → signup_finished`.
They are dropped today: Analytics Engine (`PLAY_EVENTS`) is not bound.

## Decisions for the owner

1. Which direction (A, B, C, or a mix)?
2. What does "Contact us" open: an email address (which?) or a form? The same contact belongs in the
   privacy notice.
3. May the page say who's behind it (e.g. "Written with the tutors of the Mathematics Institute of the
   Triangle")?
4. The console's "home bar" text: drop it (recommended) or keep it as one small line?
5. Which grades lead: K, 1-8 and Math 1, with Beast Academy, Math Kangaroo and AoPS under "More"?
