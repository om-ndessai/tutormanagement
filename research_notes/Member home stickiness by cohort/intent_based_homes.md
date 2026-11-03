# Intent-based onboarding and adaptive homes: routing users who arrived for different things

Research date: 2026-11-03. Scope: how products learn a user's intent (sign-up question, first action,
usage history), how the signed-in home adapts (primary card, ordering, hiding), and what is measured about
the effect on activation and retention. Applies to Aimtrue's three feature sets (Tutoring, Assessment,
Quest) and its arrival paths (guest Quest play leading to sign-up, or an invitation from a tutoring business).

Source-quality legend used below: **[primary]** = the product's own help center, the company's own paper,
or peer-reviewed HCI work; **[secondhand]** = a blog or teardown that reports someone else's numbers;
**[vendor]** = a number published by a company that sells onboarding or personalization tools (marketing).

---

## 1. Classroom quiz and assessment tools: host/teacher home vs. player/student home, and the role of the join-code box

### Takeaway
The classroom quiz tools split the product into two front doors, not one adaptive home. A **join** surface
(a code box on its own URL, no account needed) serves players, and a signed-in **library/host/assign**
dashboard serves creators. The role is fixed by an account-type question at sign-up. Kahoot's choice is
sticky: changing it means contacting support. For a player, the code box is the whole product, and for a
host it is an output (the code their Host button generates), never an input.

### Cited Findings
- **Kahoot! asks for an account type at sign-up, with four choices.** "Professional: For business or
  nonprofit training… Teacher: For K-12 and Higher Education instructors needing classroom tools. Student:
  For learners wanting access to study modes and creation tools. Personal: For hosting quizzes with friends
  and family." The flow is: go to kahoot.com, click Sign up, then choose the account type. [primary] —
  [Kahoot! Help: How to change account type](https://support.kahoot.com/hc/articles/14826253303315);
  [Kahoot! Help: How to create an account](https://support.kahoot.com/hc/articles/115000499448)
- **Kahoot's account type is hard to change once chosen.** The help article says certain account types
  cannot be changed. Otherwise a user must contact support through the request form, which may ask for a
  reason, the context of use, the organization name and, for teachers, the audience age. I found no
  self-service switch. [primary] —
  [Kahoot! Help: How to change account type](https://support.kahoot.com/hc/articles/14826253303315)
- **Kahoot players need no account.** Kahoot's help center has a page on using Kahoot free as a
  participant or student. Players join a live game with a PIN on kahoot.it or through the app's
  "Join"/"Enter PIN" control, then pick a nickname. A PIN works only while the game is live and expires when
  it ends. [primary for the free-participant page; the PIN details are secondhand] —
  [Kahoot! Help: free as a participant or student](https://support.kahoot.com/hc/en-us/articles/4409807867539);
  [Digital Citizen: Kahoot game PIN](https://www.digitalcitizen.life/what-is-the-kahoot-game-pin/);
  [Digital Citizen: How to join a Kahoot game](https://www.digitalcitizen.life/how-to-join-a-kahoot-game-web-mobile/)
- **Wayground (formerly Quizizz) has a separate join URL and a teacher dashboard.** Students go to
  wayground.com/join (the older joinmyquiz.com still works), enter a code (usually 6 digits, valid only while
  the session is live) and type a name. They need no account for a live game. The teacher hosts from an
  account and watches scores update live on a dashboard. Teachers can also share a join link through an
  LMS, or show a QR code. [secondhand: third-party blogs and a K-12 tech page; I could not fetch the
  official help center, support.wayground.com] —
  [K20 Center: Wayground](https://learn.k20center.ou.edu/tech-tool/2444);
  [Brittany Washburn: How to use Wayground](https://www.brittanywashburn.com/2018/05/how-to-use-quizizz-in-classroom.html)
  (2018 post, older); [LPS IT Tools Matrix: Wayground](https://apps.lps.org/matrix/detail.cfm?app=476)
- **Blooket and Gimkit work the same way.** A teacher picks a set and clicks **Host** to generate the join
  code and QR, or clicks **Assign** to set it as homework with a due date. Students join with a code (Gimkit
  at gimkit.com/join). One comparison says none of the three requires a student account to play; another
  says students may create free accounts, with approval, to track progress or homework. [secondhand; one
  comparison comes from TriviaMaker, a competing product, and sources disagree on code length and the
  Blooket join URL] — [TriviaMaker: Blooket vs Gimkit vs Kahoot (2026)](https://triviamaker.com/blooket-vs-gimkit-vs-kahoot/);
  [Eastern Herald: How to host Blooket (2025)](https://easternherald.com/hub/host-blooket-guide/);
  [Eastern Herald: Blooket login, student vs teacher](https://easternherald.com/hub/blooket-login-student-teacher/);
  [Wikipedia: Gimkit](https://en.wikipedia.org/wiki/Gimkit)
- **The host dashboard is private.** "The code lets students in, but only you see the dashboard"
  (Blooket). [secondhand] — [TriviaMaker comparison](https://triviamaker.com/blooket-vs-gimkit-vs-kahoot/)

### Inferences
- These tools give each intent its own **verb on its own surface**: players get *Join* (a code box,
  zero-friction, anonymous allowed), creators get *Host / Assign* (from a library). Aimtrue's Quest has both
  verbs (start a game, join with a code). A member's home could carry the code box as a persistent,
  always-visible element for "I was told a code" arrivals. Aimtrue's Play home already has "one code box".
  A host's primary action is **Start/Host** from favorites or tiles, so the code box need not lead for
  someone who mostly hosts.
- The **Host vs. Assign** split (live game vs. homework with a due date) maps onto Aimtrue's Quest Games vs.
  Assessment. Classroom tools put both buttons on the same content item, not on different homes. Applied
  here, the *content* (a level or tile) is the shared anchor, and the intent is the verb chosen on it.
- Kahoot's hard-to-change account type is a cautionary example for a product like Aimtrue, where one person
  can hold several roles: a declared intent should be a **soft default** the home can revise, not a locked
  type.

### Gaps
- I found no primary sources for **Formative, Edulastic (now part of Pear Assessment), Google Forms quizzes
  or Socrative** home screens. No public data shows how much the code box on the home is used versus other
  entry points.
- I could not fetch the official help centers for Wayground, Blooket or Gimkit (HTTP 403 or no official
  result), so code formats and URLs above are unverified. None of the tools publish activation or retention
  figures for students who joined by code and later created accounts.
- I found no evidence on what Kahoot's signed-in *Student* home shows first (study modes vs. join). Reviewing
  its app screens directly would answer that.

---

## 2. Sign-up questions that set intent ("What brings you here?"): Duolingo, Notion, Canva, Slack, Spotify, Pinterest, Khan Academy, and their published effects

### Takeaway
Asking one or two questions at sign-up and using the answers to pick templates, a feed or a starter path is
near-universal (Duolingo, Notion, Canva, Pinterest). **None of these companies has published a controlled
result isolating the question's effect on retention.** The available numbers are secondhand or vendor
marketing. The most interesting secondhand result (Duolingo) suggests that **answering a commitment
question helped retention even when the answer was not used**.

### Cited Findings
- **Duolingo** asks about motivation ("Why are you learning?") right after the language choice, then
  asks for a daily goal or study time. A 2022 review says this made the goal feel concrete. [secondhand] —
  [ReallyGoodUX/Appcues: Duolingo onboarding](https://goodux.appcues.com/blog/duolingo-user-onboarding);
  [UX Collective: The Duolingo Diaries, part 1 (2022)](https://uxdesign.cc/the-duolingo-diaries-an-honest-ux-review-part-1-onboarding-ed0165d44c58)
- **Duolingo's goal-commitment test.** A secondhand summary of a Duolingo staff thread says the
  streak/daily goal a new user chose **was not stored or used**, yet users who were asked retained better
  for weeks. A separate summary says Duolingo ran hundreds of experiments in 2022 and names goal-commitment
  copy among four that mattered for retention. [secondhand, from a third-party write-up of a social thread;
  not Duolingo's own publication] —
  [Lazyweb: How Duolingo used streak goals](https://lazyweb.com/research/duolingo-streak-goals-retention.md);
  [Lazyweb: Duolingo retention experiments](https://www.lazyweb.com/research/duolingo-retention-experiments.md)
- **Notion** asks one use-case question at sign-up (reported as "How do you want to use Notion?" with Work /
  Personal / School; some teardowns also report team-size and function follow-ups). The answer sets which

  templates and starter workflows appear and what the default workspace looks like. Sources disagree on
  the exact wording. [secondhand] —
  [Candu: How Notion crafts a personalized onboarding](https://candu.ai/blog/how-notion-crafts-a-personalized-onboarding-experience-6-lessons-to-guide-new-users);
  [Supademo: Notion user flow](https://supademo.com/user-flow-examples/notion);
  [Tear Them Down: Notion onboarding](https://tearthemdown.substack.com/p/notion-onboarding);
  [Onboard Me: How Notion solved the blank page](https://onboardme.substack.com/p/how-notion-solved-the-blank-page-product-strategy-deepdive)
- **Canva** asks at sign-up what you will use it for (social media, presentations, marketing materials) and
  routes you to matching templates and tutorials. [secondhand/vendor, from Appcues' 2026 onboarding
  articles; I did not check Canva's own pages] —
  [Appcues: user onboarding personalization](https://www.appcues.com/blog/user-onboarding-personalization);
  [Appcues: onboarding examples (2026-08-19)](https://www.appcues.com/blog/casey-winters-pinterest-user-onboarding)
- **Pinterest** asks new users to pick interests at sign-up to build the home feed. A localization
  experiment that combined declared interests with the browser's country reportedly raised activation
  abroad by **5-10%**, depending on country and demographic. Casey Winters (former growth lead) is quoted on
  removing complexity "so we got people to the core value of the product as soon as possible."
  [secondhand: Appcues citing Pinterest; I did not retrieve Pinterest's own post. The Appcues URL now
  redirects to a different 2026 article, so I could not re-verify the figure] —
  [Appcues: Casey Winters on Pinterest onboarding](https://www.appcues.com/blog/casey-winters-pinterest-user-onboarding);
  [GoodUX: Pinterest's value-driven onboarding](https://goodux.appcues.com/blog/pinterests-value-driven-onboarding-flow)
- **Slack** built its onboarding around a team reaching **2,000 messages**, which it identified as the
  strongest predictor of long-term retention. That is an activation threshold, not an intent question.
  [secondhand, an older and widely repeated figure] —
  [Appcues: onboarding strategies](https://www.appcues.com/blog/8-user-onboarding-strategies)
- **Auth0** added an option to meet sales during onboarding. Activation rose, and fewer people landed on the
  generic dashboard. The lesson the team drew was that one-size-fits-all onboarding fails, because some want
  DIY, some guidance and some sales. [secondhand: ProductLed] —
  [ProductLed: 3 SaaS experiments](https://productled.com/blog/activation-rate-saas)
- **Pipefy** "more than doubled user retention after transitioning from generic horizontal onboarding to
  role-specific vertical flows." No base rate or exact figure is given. [vendor: Chameleon's marketing for
  its own product] — [Chameleon: onboarding best practices (2026)](https://www.chameleon.io/blog/user-onboarding-best-practices)
- "Personalized onboarding increases user retention by 40% compared to generic flows." No company is named
  and the citation link is broken. [vendor, unsourced] —
  [Chameleon](https://www.chameleon.io/blog/user-onboarding-best-practices)
- **Movii**: personalized onboarding was linked to a **36% reduction** in churn during onboarding. [vendor:
  CleverTap customer story] — [CleverTap: app onboarding](https://clevertap.com/blog/app-onboarding/)
- An industry "30-50% activation lift from personalization" figure is repeated across SaaS blogs, sometimes
  attributed to Reforge. **I could not trace it to a primary source**, so treat it as unverified. —
  [×marble: personalization for SaaS onboarding (2026)](https://timesmarble.com/blog/personalization-for-saas-onboarding);
  [SaaSFactor](https://www.saasfactor.co/blogs/saas-user-activation-proven-onboarding-strategies-to-increase-retention-and-mrr)

### Inferences
- The pattern repeated across consumer and education-adjacent products is **one short question at sign-up,
  used to pick the first content and the first action, not to lock a mode**. Aimtrue already has a stronger
  signal than any question for most newcomers: **what they did before signing up** (a guest who played
  Quest tiles; an invitee whose invitation names a role in a Tutoring space). Behavioral arrival context
  should outrank a self-reported answer, and a question is worth asking only where that context is missing
  (for example, someone who signs up cold).
- The Duolingo summary suggests part of the benefit comes from **commitment**, not tailoring. A goal or
  intent prompt ("What do you want to do first? Play / Give an assessment / Run lessons") may help even
  when the routing is crude. This is a secondhand finding and should be tested, not assumed.
- Every hard number here is vendor or secondhand. Aimtrue would need its own A/B or cohort comparison:
  D1/D7/W4 return by arrival path, comparing an intent-led home with the current one.

### Gaps
- **Spotify and Khan Academy**: I found no sourced description of their current intent questions or any
  published effect. Khan Academy's learner / teacher / parent role choice at sign-up is widely known, but I
  did not verify it in this session.
- No company in scope has published a randomized result **isolating the intent question** (asked vs. not
  asked, or answer used vs. ignored) on retention. Duolingo's is the closest, and it is secondhand.
- Canva's exact current question wording, and whether it changes the home or only the templates, is
  unverified.

---

## 3. Usage-adaptive homes ("jump back in", recently used, most-used first): evidence and risks

### Takeaway
The best controlled evidence comes from HCI research on adaptive menus. Adapting to usage helps **only when
the prediction is accurate and the layout stays predictable**. The winning designs **copy** the predicted
item to a prominent spot and leave everything else where it was (split or elective interfaces). They do
not reorder or hide. Hiding unused features measurably lowers users' **awareness** of them. Netflix is the
strongest industry evidence that a personalized home lifts engagement: about 4-12% more than simpler
recommenders, per Netflix's own 2025-26 paper. Its retention rationale is stated rather than measured in
public.

### Cited Findings
- **Adaptive vs. adaptable (user-controlled) vs. static menus** (Findlater & McGrenere, 2004). The static
  split menu was significantly faster than the adaptive split menu. The adaptable (user-customized) menu was
  also significantly faster than the adaptive one, and most users preferred the control that adaptable gave
  them. [primary, peer-reviewed; older, 2004] —
  [Findlater & McGrenere 2004 (PDF)](https://www.cs.ubc.ca/labs/edapt/papers/findlater2004.pdf)
- **Accuracy is decisive** (Gajos et al., AVI 2006, "Exploring the Design Space for Adaptive GUIs"). They
  compared Split, Moving and non-adaptive interfaces at 30% and 70% prediction accuracy. Both adaptive
  designs were faster at **70%**. The Split design **copies predicted items to the top while leaving the
  originals in place**. [primary; I saw abstract-level detail only, not the full 30% results; older, 2006] —
  [Gajos et al. 2006 (PDF)](https://kgajos.seas.harvard.edu/papers/kgajos-avi06.pdf);
  [slides](https://www.eecs.harvard.edu/~kgajos/papers/2006/kgajos-avi06-slides.pdf)
- **Elective beats mandatory, and instability is the cost.** Findlater & Gajos' review (AI Magazine, 2009)
  reports that an elective split interface (the user may use the adapted area or ignore it) was faster
  and preferred over the mandatory version. It also notes that adaptation brings spatial instability, so
  items may not be where users expect. [primary review; older, 2009; I could not parse the PDF myself, so
  these are search-extracted findings] —
  [Findlater & Gajos, AI Magazine 2009 (PDF)](https://kgajos.seas.harvard.edu/papers/AIMag09-AUIs.pdf)
- **Ephemeral adaptation** (Findlater, Moffatt, McGrenere & Dawson, CHI 2009) shows predicted items first
  and fades the rest in a moment later, keeping the layout spatially stable. It improved visual search time
  over both static menus and adaptive highlighting. [primary; older] —
  [Findlater et al. 2009 (PDF)](https://www.cs.ubc.ca/labs/edapt/papers/findlater2009.pdf)
- **The cost to awareness.** Findlater's UBC dissertation reports that while personalization "can increase
  the accessibility of features useful to a user's current task, it may in turn negatively impact the
  user's awareness of the full set of available features." Across three studies, personalization lowered
  both recognition of unused features and performance on new tasks that needed them. The 2007 INTERACT paper
  introduced *feature findability* and *feature awareness* as separate measures. [primary; older] —
  [Findlater, PhD thesis, UBC](https://open.library.ubc.ca/collections/24/items/1.0051322);
  [Findlater & McGrenere, INTERACT 2007 (PDF)](https://faculty.washington.edu/leahkf/pubs/Interact2007-findlater.pdf)
- **NN/g (Amy Schade, 2016)**: "Customization gives control to the user and personalization gives control
  to the site." Personalization works when users "do not know exactly what they need and must filter
  through a large information space." It leaves users "at the mercy of the computer's ability to guess,"
  can be "unnerving," and "requires regular reviews." Customization "imposes higher interaction cost," and
  most users won't do it. Neither should be "a fix for a broken site." The article cites no studies.
  [primary NN/g guidance; older, 2016] —
  [NN/g: Customization vs. Personalization](https://www.nngroup.com/articles/customization-personalization/)
- **Netflix (Gomez-Uribe & Hunt, ACM TMIS 2015)**: most of the recommender's algorithms "come together on the
  Netflix homepage," and "if a user doesn't find something of interest, the risk of the user abandoning our
  service increases substantially." The paper is widely cited for recommendations driving about **80% of
  hours streamed** (secondary accounts differ on hours vs. titles). [primary paper; older, 2015; 80% figure
  from secondary accounts] —
  [Gomez-Uribe & Hunt 2015 (PDF)](https://gwern.net/doc/reinforcement-learning/exploration/2015-gomezuribe.pdf);
  [Crossref record](https://api.crossref.org/works/10.1145%2F2843948);
  [Northeastern News](https://news.northeastern.edu/?p=47145)
- **Netflix (Zielnicki, Aridor, Bibaut, Tran, Chou, Kallus; arXiv 2511.07280, Nov 2025, rev. June 2026)**:
  a structural choice model fit to Netflix viewing finds that replacing today's recommender with matrix
  factorization would cut engagement by about **4%**, and with a **popularity-based** system by about
  **12%**. Both alternatives also reduce diversity. The gain comes mainly from targeting, not more exposure,
  and is largest for mid-popularity titles. Retention is not reported in the abstract. [primary, current] —
  [arXiv 2511.07280](https://arxiv.org/abs/2511.07280)

### Inferences
- For Aimtrue's home, the research favors a **stable layout with one adaptive "primary" slot**: a Continue /
  Jump-back-in card or a "your usual" action, **copied** to the top while every feature keeps its usual
  place below. That is the split/elective design. Reordering whole sections by frequency, or hiding sections
  a person hasn't used, is the version that measured worse and costs awareness.
- **Only adapt when confident.** The 70%-vs-30% result implies a rule-based trigger. Examples: "this person's
  last N sessions were all Quest games", "this tutor has a lesson in the next hour", "an assessment is
  waiting for your review". These are more accurate than a learned guess on thin data, and Aimtrue
  newcomers will have little data at first.
- Time-bound obligations (a lesson now, a review waiting, a game invite) are near-100%-accurate predictions
  of the next action. They are the safest things to put in the adaptive slot, ahead of frequency-based
  guesses. Aimtrue's tutor Home "Now" card and Play's "Waiting for you" already work this way.
- The awareness finding argues against **hiding** Assessment from a Quest-first user (or Quest from an
  assessment-first user). Demote the unused feature and keep a visible entry point, or the cross-feature
  discovery that would make the product stickier is lost.
- Netflix's 4-12% engagement gap over simpler baselines comes from a very large, very accurate system. A
  small product should expect smaller gains from personalization *ranking*, and larger gains from getting
  the **first card right for each arrival path**.

### Gaps
- I found no sourced, current description of how **Google Workspace, Canva ("Recent designs"), Spotify
  ("Jump back in") or Microsoft 365 ("Recommended")** build their adaptive home sections, and no published
  retention effect from any of them. These are well-known patterns but are unsourced here.
- I found no published A/B result showing that putting the most-used action first raises **return rate**
  (as opposed to task speed in a lab). The HCI evidence is about speed, preference and awareness, not
  retention.
- NN/g's newer (2023-2026) articles on AI-driven or adaptive homes were not found by my searches. The only
  NN/g item here dates from 2016.

---

## 4. One person, several roles (a parent who tutors, an admin who teaches): role switchers vs. merged homes

### Takeaway
Products where the two roles have **different jobs and different data** use an explicit mode switch:
Airbnb's "Switch to hosting" / "Switch to traveling", and Kahoot's separate account types. I found little
published evidence comparing switchers with merged homes.

### Cited Findings
- **Airbnb** keeps one account with two modes. "Your account must be set to hosting to manage reservations
  at your properties and communicate with your guests." In the app you tap Profile, then *Switch to
  hosting*; the browser has a matching *Switch to traveling* control by the profile photo. The modes are
  explicit and user-chosen. [primary help center] —
  [Airbnb Help: Switching between hosting and traveling](https://www.airbnb.com/help/article/3546)
- **Kahoot** puts the role in the account itself: one of four types, chosen at sign-up and changed only
  through support. In effect, one person who is both a teacher and a casual host needs two accounts.
  [primary] — [Kahoot! Help](https://support.kahoot.com/hc/articles/14826253303315)
- NN/g's guidance on personalization notes that an intranet (Intermountain Healthcare) tailored content
  **by role and by individual**, an example of layering role-based defaults with personal ones. [primary
  guidance, 2016; example only, no data] —
  [NN/g](https://www.nngroup.com/articles/customization-personalization/)

### Inferences
- Two patterns exist. **(a) A switcher** (Airbnb) makes sense when the roles' data must never mix on screen.
  In Aimtrue, a tutor's student-facing screens must carry no money, and a parent's view is their own
  child's. **(b) A merged home** led by whichever role has something due *now*, with the other role's
  primary action one tap away, makes sense when the roles are light. A parent who also plays Quest is an
  example.
- Aimtrue's rules already push toward a hybrid. A role's dashboard shows that role's data only (CLAUDE.md:
  "narrow it for someone who holds several"), and the tutor's carousel is filtered to their own pairings.
  So the merged home should be **sections per role, ordered by urgency or usage**, not one mixed feed. An
  explicit switcher fits only for the staff-vs-family split, which has strict money rules.
- Airbnb's precedent says the mode should be **remembered and reachable from the profile menu**, and that
  the person chooses it. That matches the research in section 3 favoring user-controlled (adaptable) over
  system-controlled changes.

### Gaps
- I found **no published study or A/B result** comparing role switchers with merged multi-role homes for
  activation or retention.
- I did not find sourced descriptions of **Google Classroom** (one account both teaching and enrolled,
  shown as classes on one home), **Canvas LMS**, **Uber/DoorDash** (separate apps per role) or **Slack**
  (multi-workspace) from this session's searches. All are commonly cited patterns, and each is a gap here.

---

## 5. Overall: measured effect of intent-based or usage-based homes on activation and retention

### Takeaway
The evidence base is thin and mostly marketing. The published, controlled evidence covers (a) lab speed and
preference for adaptive menus (HCI, 2004-2009), (b) Netflix's engagement value from personalized homes
(2015; 2025-26 paper), and (c) secondhand single-company anecdotes (Pinterest +5-10% activation abroad;
Duolingo commitment prompts; Auth0; Pipefy). **I found no peer-reviewed or company-published randomized
result in education showing that an intent-based home raises retention.**

### Cited Findings
- Pinterest localization plus interests: +5-10% activation abroad. [secondhand via Appcues] —
  [Appcues](https://www.appcues.com/blog/casey-winters-pinterest-user-onboarding)
- Pipefy: retention "more than doubled" with role-specific flows. [vendor: Chameleon] —
  [Chameleon](https://www.chameleon.io/blog/user-onboarding-best-practices)
- Generic claim of "+40% retention from personalized onboarding" (unsourced) [vendor: Chameleon]; "30-50%
  activation lift" (untraceable, attributed to Reforge) [secondhand/unverified] —
  [Chameleon](https://www.chameleon.io/blog/user-onboarding-best-practices);
  [×marble](https://timesmarble.com/blog/personalization-for-saas-onboarding)
- Movii: -36% churn during onboarding with personalized onboarding. [vendor: CleverTap] —
  [CleverTap](https://clevertap.com/blog/app-onboarding/)
- Netflix: a popularity-ranked home instead of the personalized one would cut engagement about 12%.
  [primary, 2025-26] — [arXiv 2511.07280](https://arxiv.org/abs/2511.07280)
- Adaptive interfaces help only at high prediction accuracy, and elective/split designs are preferred.
  Personalization lowers awareness of unused features. [primary HCI, older] —
  [Gajos et al. 2006](https://kgajos.seas.harvard.edu/papers/kgajos-avi06.pdf);
  [Findlater & Gajos 2009](https://kgajos.seas.harvard.edu/papers/AIMag09-AUIs.pdf);
  [Findlater thesis](https://open.library.ubc.ca/collections/24/items/1.0051322)

### Inferences
- A defensible design for Aimtrue combines the strongest-evidenced pieces:
  1. Set the **first-session home from arrival context**: guest Quest play leads with Quest; a Tutoring
     invite leads with Tutoring. An Assessment invite would lead with Assessment, but I have no evidence on
     how such users arrive.
  2. Keep **one adaptive primary card**, fed first by time-bound obligations, then by the user's dominant
     recent activity.
  3. Keep the **rest of the layout stable**, with unused feature sets demoted but visible.
  4. Let the user **pin or choose** their default (adaptable beats adaptive).
- Because the external numbers are weak, measure it internally: return rate by cohort (arrival path ×
  first-week dominant feature), comparing the intent-led home with the current Play/dashboard homes.

### Gaps
- No education-sector company (Kahoot, Wayground, Blooket, Gimkit, Khan Academy, Duolingo) publishes
  controlled data on intent-routed homes.
- I could not reach Appcues, Pendo or Amplitude primary benchmark reports on onboarding personalization
  within this session. The aggregate figures circulating in blogs are untraceable.
