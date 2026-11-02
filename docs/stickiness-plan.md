# Play first, sign up second (Phases 62-64, plan, 2026-10-31)

**Status: plan approved by the owner, 2026-10-31; built 2026-11-01/02; released 2026-11-02 (tag
`release-20261102`).** Guest play, the guest Assessment and the Daily set ship switched off in the console. Web and the app together (parity), each feature behind its switch.

The owner's brief is `docs/UnauthPlan.md` (2026-10-31):

> Now that the app/portal are in good shape for next level, the goal I am trying to solve is improving
> stickiness. The app/platform should take the users right into usability. We will use quest as the
> bait for that scenario. Then the nudge should be for people to sign up. For logged in users the
> usability of the app with one click quest start should be priority.

The brief lists the items numbered 1-9 below in "The owner's items". The owner asked for a comprehensive
recommendation from a marketing point of view, not limited to those items.

| Phase | Name | What it holds | Requirements |
| --- | --- | --- | --- |
| 62 | One tap | Members start a quest in one tap, from tiles and favorites, and family games need no code. Checked questions are on per space, and game answers count toward approval. The cost fixes that make one tap affordable come first. | P1-P8 |
| 63 | Open door | Anyone plays without signing in: a guest Play home of tiles, some locked, a guest Assessment, nudges to sign up, a sign-up sheet with no Welcome screen, and anonymous counts. | P9-P16 |
| 64 | Habit | A weekly streak, badges and "My progress", the Daily set with its share grid, and beating your best. It replaces the never-started Phase 44. | P17-P20 |

**Why Phase 62 comes first:** a guest who signs up in 63 must land among tiles and favorites (decision
2), and 62 gives today's members value without opening anything to the public.

---

## The owner's items (`docs/UnauthPlan.md`)

1. Users are not required to authenticate to use or try features → P10, P11.
2. 10 questions per curriculum level are guest questions, served only to unauthenticated quests or
   assessments → P9, P11.
3. A home screen where people quickly use the platform, instead of one asking them to log in → P10.
4. One tap into a single-player quest, from tiles named `<Curriculum><QuestFormat>` (G4T10, BA3Q5) → P5,
   P6, P10.
5. Many tiles greyed out with a lock, unlocked only for members → P5, P10.
6. Guests nudged that non-repeated questions need an account → P12.
7. After the first question, a popup pauses the time and shows the benefits of signing up → P12.
8. (also numbered 7) The console lets platform admins configure this, such as which tiles guests may
   use → P5, P16.
9. (numbered 8) The home page nudges people to sign in → P12.
10. (numbered 9) Members get a favorites section and one tap starts. A multiplayer favorite leads
    straight to its code. A family favorite names its players: they see the game on their own page and
    join with no code, and the host starts at once → P6, P7, P8.

## The owner's decisions (2026-10-31)

1. **Everything is built behind switches**, turned on and off in the console. Sign-up buttons follow
   `SIGNUP_OPEN`: while it is closed (production today), a nudge offers "Sign in" only.
2. **The newcomer Welcome goes.** After sign-up there is a short logo splash, and the person lands back on
   the page they were on, able to start quests from favorites and tiles at once.
3. **Anonymous counts are allowed**, with a new privacy-notice version the owner approves.
4. **Checked questions are open in the soft launch, and two right answers approve them.**
   - Every space, the institute included, starts with checked questions on: games, tiles and
     Assessments. Guests get them too.
   - A platform admin switches them per space in the console (`checked_questions`), which replaces the
     space admins' own switch (`canvas_assessments_unreviewed`).
   - Two right answers approve a question, by **the rule that already exists** (owner, 2026-10-24:
     `approveByConsensus`, `QUEST_CONSENSUS_CORRECT` = 2, `approved_via = 'quest_consensus'`). Today
     only Question Quest's answers feed it; game answers now count too. Nothing else about the rule
     changes, Phase 51's "trusted spaces count" included.
   - Guests do not count: they are not users, and their answers are never stored.
   - While a question is still checked, it wears a small "Beta" chip.
5. **`tutoring` is the platform's address; `tmi-portal` is to be retired.** The institute's people move to
   `tutoring` later. Guest play is offered on `tutoring` and the demo, not on `tmi-portal`.
6. **A guest Assessment is part of the guest phase.** It is answered on the device and stored nowhere.

---

## The strategy

### Two people are being won

- **The player** is usually a child or teen. They want a quick, fair game and a score.
- **The account holder** is a parent, a tutor, or a teen of 13 or more. They want proof that the
  practice is good and that it is safe.

Under-13s cannot sign up (Phase 52). So every nudge has a second door, **"Ask a grown-up"**, which hands
a parent a link. It is never a dead end.

### Principles

1. **Value before identity.** The first question is one tap, under five seconds from landing: no form,
   no account. Ask for the account only once the person has something to lose ("lazy registration").
2. **Ask at earned moments.** Ask after an answer, at the results, and when the free questions run out,
   never at the door. The owner's pause after question 1 is kept. It can be dismissed, it is capped, and
   it is tested against "results only".
3. **Locks invite rather than punish.** A locked tile says what is inside and that it is **free** ("20
   minutes · 1,200+ questions · Free with an account"), never a bare padlock. About a third of tiles are
   open, so the home feels generous.
4. **Carry everything over.** The grade, the tiles played and the best scores move from the device into
   the account, so the first signed-in screen already feels like theirs.
5. **The loop for members.**
   - Trigger: a family game waiting, the week's streak, the Daily set.
   - Action: one tap.
   - Variable reward: a score, confetti, a new best, a badge.
   - Investment: favorites, a family roster, a streak, levels climbed.

   Investment is what brings people back.
6. **Social commitment beats reminders.** A family's standing game ("Sunday G4T10") is a ritual, so the
   roster favorite matters more than any badge.
7. **Codes are the brand's language.** "G4T10" is short, collectible and typeable. It works as a link
   (`/play/G4T10`), a flyer's QR code and a boast ("I got 9/10 on G4T10"). For first-time adults it is
   always paired with words: "Grade 4 · 10 minutes".
8. **Safe for children, honest with adults.**
   - No ads and no third-party trackers.
   - Nothing about a guest is stored on our side.
   - "Keep playing" is as visible as "Sign up".
   - The trust line is a selling point to parents: "No ads. No account needed to try. Written to NC
     standards, checked twice."

### Journeys

**First visit (a guest)**
1. The Play home. They pick a grade from chips, which the device remembers, and tap **G4Q5**.
2. A countdown, then question 1, an easy one.
3. The pause sheet: "Nice! 1 for 1", what a free account adds, **Sign up free** and **Keep playing**.
4. The results: score, ticks and crosses, worked solutions, **Save this score**, **Challenge a friend**,
   **Play again**.

**Coming back (a guest)**
- Unseen questions come first, from the device's memory.
- When the 10 free questions of a level are all seen, the tile says "Played all 10". Starting it offers
  "Sign up for 1,200+ new Grade 4 questions, never repeated", or "Play these again".
- A timed quest that runs out of free questions ends there, with the same offer.

**A guest Assessment**
- **G4A5** gives five questions, one page each, written on the canvas: choose a choice, or type the final
  number, with the canvas for working.
- The device marks them. The results show each page beside the key and the worked solution.
- Then the offer: "Save it as a PDF, keep a record, have a tutor review it — free account".

**A child**
- "Under 13? Ask a grown-up" opens the share sheet or a QR code, with a message ("I scored 4/5 on G4Q5 —
  can you set me up?") and a link.
- The parent lands on the Play home with a **For parents** strip: start your family's space, add your
  child, play together, follow progress, give assessments.

**Signing up**
1. A sheet over the current page: the provider, birth month and year, the terms.
2. A quiet personal space is made.
3. A logo splash, about a second.
4. Back on the same page, now a member: a paused quest resumes, the tiles they played are in Favorites,
   and their grade is the default. No Welcome screen, and no "space" talk until they invite someone.

**Daily use (a member)**
- The Play home: **Continue**, **Favorites**, **Waiting for you**, the tiles, **Have a code?**.
- Phase 64 adds the weekly streak, badges and the Daily set.

**A family**
1. A parent saves "Family G4T10" with four players.
2. One tap makes the game, with the parent already in it.
3. The other three see "Mom started Family G4T10 · Join" on their Play home, and join in one tap with no
   code.
4. The parent starts when ready. Latecomers may still drop in.

---

## What exists today (code survey, 2026-10-31)

**Signed-out visitors**
- Signed-out visitors see only a sign-in page (web `/login`; the app's `Welcome`).
- No Quest, question or game route is public.
- The only public play is Phase 56's challenge answer (`/api/public/challenge/:id/answer`), which is
  rate-limited and behind Turnstile.

**Which engine the tiles use**
- Tiles use **Quest Games** (Phases 46-48), not Phase 42 Quest:
  - Phase 42 Quest serves `checked` questions with no feedback, to students only. It is a review
    pipeline.
  - Games have count and timed modes, are marked at once, and a single player's game is "made and begun
    in one request" (`POST /quest/games`).
  - Games draw unseen questions first (`quest_game_seen`), so "no repeats once you sign up" is already
    true.

**Favorites** (`quest_game_favorites`)
- At most 12; `config` is the `createGameSchema` output.
- Reachable only from the wizard: step 1, then Review, then Start.
- No one-tap start, and no list of players.
- A multiplayer host is not a player until they join.

**Game timing**
- No pause anywhere. Game time is the server's (`started_at` plus the duration, enforced in `QuestGame`).
- Single-player games still poll every `GAME_POLL_MS` (2 s): about 300 requests per 10-minute game.

**Names**
- `QUESTION_BANK_LEVEL_LABELS` / `levelLabel()` already say G4, BA3, Math 1, Kangaroo 3-4.

**Blockers found**
- **Sign-up:** closed in production (`SIGNUP_OPEN` "false").
- **Newcomers:** a newcomer lands on Welcome (join with a code, or start a space, adults only), and a
  space's maker is admin only.
- **Privacy:** the notice promised "No tracking and no analytics".
- **Questions:**
  - The bank is almost all `checked`: the export holds 50,068 checked and 12 approved.
  - Self-serve spaces draw approved questions only.
  - With checked included, every game start counts the whole curriculum (`countDrawableQuestions`, about
    30,000 D1 rows).
  - The draw sorts a whole level by `random()`.
- **Free-plan limits:** 100k Worker requests, 5M D1 reads and 100k Durable Object requests a day.
- **No edge cache:** the Cache API does nothing on `*.workers.dev`, and a cache hit still counts as a
  request.
- **Never started:** streaks, badges and rewards (Phases 44-45).

---

## Phase 62: one tap

### P0. Sign-in switches, per client, at runtime (owner, 2026-11-01)

> I want full set of social logins enabled for test app (not web portal) and have these configurable at
> the platform level so when I want to show/demo these to friends I can go to my production app enable it
> for time being and then disable again after a quest is done.

- The app sends `X-Client: app` on every request; anything else is the web.
- **Console > Settings > Sign-in** (web tab; the app's console header gear): for the web portal and the
  app separately, which providers besides Google (always on) and whether new people may sign up, for 1,
  3, 12 or 24 hours or until changed; **Back to defaults** clears it. Stored in `platform_settings`
  (`sign_in`), logged `platform.sign_in_updated` (`PUT /api/platform/sign-in`).
- While a setting is in force it replaces the Worker's vars; when it lapses they apply again. A provider is
  offered only while it is set up on that Worker (its ids and secrets).
- The test Worker's defaults: the web portal Google alone (`AUTH_PROVIDERS`), the app Google, Microsoft and
  Facebook (`AUTH_PROVIDERS_APP`). Apple waits for the paid Apple account.
- **For a demo on production:** Microsoft and Facebook must first be set up there and on the production app
  (`docs/sign-in-providers-setup.md`), and `SIGNUP_OPEN` stays "false" as the default the switch reverts to.

**Checks:** `e2e/tests/sign-in-settings.spec.ts` (each client's switches, closed sign-up refused in the app
only, lapse and Back to defaults, platform admins only, the console page); the app's Jest and the Maestro
flow `platform/sign-in-settings.yaml`.


### P1. Checked questions, per space

- **The column:** `organizations.checked_questions`, defaulting to 1. The release sets every existing
  space to 1: this is the soft launch.
- **Who sets it:** platform admins, with `PUT /api/platform/organizations/:id/features`. It sits in the web
  console's space dialog and the app's `features-section.tsx`, beside the feature sets.
- **One helper:** `checkedQuestionsOn(org)` in shared (like `featureOn`; never read the column directly)
  decides "include checked" for the game count and draw, the Assessment draw and the tiles' depth, so
  all of them always agree.
- **What goes:** `canvas_assessments_unreviewed` leaves the Space page. Its column stays and is no longer
  read.
- **What stays:** an Assessment PDF still marks a checked question "not yet reviewed".

**Checks:**
- a self-serve space with the switch on plays checked questions in games and Assessments;
- with it off, only approved questions are drawn;
- the switch is logged in the space's audit log;
- the Space page no longer shows the old switch.

### P2. Game answers count toward the two-right-answers rule

This reuses the existing rule. It does not make a new one.

- **Recording who got it right:** a new column, `quest_game_seen.correct`, is set when `writeGameResults`
  writes the results batch.
  - It goes on the answering player's own row, not their teammates'.
  - It costs no extra writes.
  - A partial index, `ON quest_game_seen (question_id) WHERE correct = 1`, serves the count.
- **One function:** `approveByConsensus` (`repositories/quest.ts`) stays the only one. Its count of
  distinct people now unions correct Quest attempts with correct game answers. The `quest_trusted` join,
  the threshold and the UPDATE stay exactly as they are.
- **When it runs:** once, at a game's end, for that game's correctly answered checked questions. That is
  one grouped count and one `UPDATE … WHERE status = 'checked'`. `reviewed_by` is the latest correct
  answerer, as today.
- **Taking it back:** a tutor's flag still takes such an approval back.

**Checks:**
- two people in trusted spaces answer one checked question correctly, one in a game and one in Question
  Quest: it becomes approved, `approved_via = 'quest_consensus'`;
- a teammate who did not answer it does not count;
- a self-serve, untrusted space's answers do not count;
- the console's list of quest approvals shows it.

### P3. The Beta chip

- `status` is selected into `SeriesQuestion.beta`, stored in the game object's series (old series read
  false), and copied to `GameView.me.question` and the results items. All of these are additive fields.
- The play screen shows a small "Beta" chip, with **Report a problem**, which follows Phase 51:
  - in a trusted space it flags the question;
  - elsewhere it is a suggestion to the console.
- The chip goes once the question is approved.

**Checks:**
- a checked question shows the chip on the web and in the app;
- an approved one does not;
- a report from a self-serve space becomes a console suggestion.

**Built 2026-11-01:** the chip on the web and in the app. **Report a problem is split out as P3b** (not
built): the existing flag path needs a Quest review, and `question_suggestions` holds approvals, not
problems, so a report needs a small table of its own and a list in the console, and the owner's word on
who may flag a question for every space.

### P4. One tap must be affordable

These fixes come before any one-tap start, or one-tap play would spend the free plan's quota.

1. **Single-player games stop polling.** Each answer's reply carries the new view, and the client
   refetches only when the countdown ends and at `ends_at`. A 10-question game drops from about 300
   requests to about 12. Multiplayer keeps polling.
2. **Counts are cached.** Playable counts per level are kept as JSON in `platform_settings`, refreshed by
   the console and once a day by the `tutoring` Worker's cron. `GET /quest/games/levels` reads the
   cached JSON, and a one-tap start skips the count (`begin` already answers 409 when a level is short).
3. **The draw reads a random window of the index** instead of `ORDER BY random()` over a whole level. It
   still draws unseen questions first and climbs levels as Phase 48 does.

**Checks:**
- a solo game's network log shows no polling between answers (web and the app);
- a one-tap start reads no whole-curriculum count (a test on D1's `rows_read`);
- a draw of a 2,000-question level reads a few hundred rows at most;
- multiplayer games are unchanged.

**Built 2026-11-01, with two changes from the plan above:**
- Single-player games are read at the countdown's end, when a timed game's time is up, and every
  `GAME_SOLO_CHECK_MS` (30 s) besides, so a dropped connection or a game ended elsewhere is still noticed:
  about 20 requests for a 10-minute game instead of about 300 (`gameRefetchDelay` in shared).
- Counts are cached per level in `platform_settings` ('level_counts'). A status change marks its level
  dirty ('level_counts_dirty'), and the next read recounts only that level, so a count follows an approval
  at once. The cron refreshes all of them once a day.
- **Deferred:** the random window over the index. Measured against the draw as it is, it saves about two
  thirds of a solo game's draw (~2,000 rows read to ~600) at the cost of variety across standards. Do it if
  the daily read counts show the need.

### P5. Tiles and their names

**The code**
- **Grammar:** `<level tag><Q|T|A><number>`, letters and digits only.
  - Q is a number of questions.
  - T is minutes.
  - A is a handwritten Assessment of N questions (guests, P11; members later).
- **Examples:** `G4Q5`, `G4T10`, `BA3Q5`, `M1T20`, `MK34Q10`, `G4A5`. Later, `G4D` is Grade 4's Daily set
  (P19).
- **Level tags:**
  - NC 2026: `GK`, `G1`-`G8`, `M1`, `M2`.
  - Beast Academy: `BA1`-`BA5`.
  - AoPS: `PA`, `AL`, `GE`.
  - Math Kangaroo: `MK12`-`MK1112`.
  - NC 2017 and the upper NC 2026 courses get theirs when their first tile is made.
  - They are one shared table, `TILE_LEVEL_TAGS`, beside `QUESTION_BANK_LEVEL_LABELS`.
- **Shared code** (`packages/shared/src/quest-tiles.ts`):
  - `tileCode()` and `parseTileCode()`;
  - the tile schema.

**The tiles**
- **The table:** `quest_tiles`, platform data with no organization. Its columns: `code` (unique), `kind`
  (quest | assessment), `config` (JSON validated by `createGameSchema`, as favorites are, via
  `toFavorite`), `guest` (open | locked | hidden), `members` (shown or not) and `sort`.
- **Validation:** the level is checked against `QUESTION_BANK_LEVEL_IDS`, and the code must match the
  config.
- **A member's tap** goes straight to `POST /quest/games`.
- **A tile shows:**
  - the code, large, with words under it ("Grade 4 · 10 minutes");
  - a curriculum colour band;
  - the best score;
  - "Beta" while its level draws checked questions;
  - for guests, a lock and a "Free" chip.
- **Members** see tiles unlocked, filtered to their space's curricula (`bankLevelOffered`) and to levels
  at or above the console's minimum depth (default 50 playable questions).

**Default set** (seeded; edited in the console)

| Levels | Open to guests | Locked for guests |
| --- | --- | --- |
| Grades 3-8, Math 1 | Q5, T5, A5 | Q10, T10, T20 |
| Grades K-2 | Q5 | — |
| BA1-BA5 | Q5 | T10 |
| AoPS, Kangaroo | — | all |

"Family game", "Join with a code" and Random ("G4 and up") are locked tiles too.

**The console's Play tab** (web, and a screen in the app's console):
- add, edit and order tiles;
- the **Play home** switch;
- the minimum depth.

Every change is a platform audit line.

**Checks:**
- a tile whose code does not match its config is refused;
- a member's tile list leaves out curricula their space does not offer and levels below the depth;
- the console's edits are logged.


**Built 2026-11-01 (web):** tiles live as one list in `platform_settings` ('tiles', with 'play' for the switch and the depth) rather than a `quest_tiles` table: no row is `DEFAULT_TILES` (64 tiles). NC 2017 tags are `NK`, `N1`-`N8`, `NM1`-`NM4`, `NPC`; the upper NC 2026 courses `LR`, `DS`, `MM`.
### P6. The members' Play home

**Where it is the home**
- In spaces without Tutoring (self-serve, personal, family).
- For **students** in every space.

Staff and parents in Tutoring spaces keep their dashboard, with a compact favorites row and the Quest menu.

**Sections, in order**
1. **Continue**: the last settings, kept on the device; one tap.
2. **Favorites**: one tap each. A star on any tile adds one.
3. **Waiting for you** (P8).
4. **Tiles**, with the person's grade first.
5. **Have a code?**: 6 characters is a game (searched across the person's own spaces); 8 is a space
   (Phase 52's join request).
6. **New Quest**: the wizard, unchanged.

In the app, Home leads with this. The long-press quick actions offer "Play <last tile>" and the top
favorite.

**Checks:**
- a student's home is the Play home, on the web and in the app;
- a tutor's dashboard is unchanged;
- one tap on a tile starts a running game;
- a 6-character code from another of the person's spaces finds the game;
- an 8-character code makes a join request.


**Built 2026-11-01 (web):** as above. The code box asks the current space for a game code (searching all the person's spaces waits for games between spaces). Found and fixed on the way: single-player favorites never read back (a stored `max_teams` of 1 failed the schema), since Phase 47.
### P7. Favorites in one tap, and the lobby

- **A single-player favorite:** tap, and the game is made and begun (the existing one-request path), then
  the countdown.
- **A multiplayer favorite:** tap, and the game is made with **the host already playing**:
  - through a `hostPlays` flag on the object's `create()`, which runs `addTeam(host)` without `begin()`;
  - the host's team is solo when `max_team_size` is 1, otherwise "Team <first name>".

  Then the lobby: the code, large; a QR code; **Share** (the system share sheet, "Join my Aimtrue game:
  code XXXXXX"); and **Start**.
- **The wizard's Save as favorite** gains "Players: just me / anyone with the code / these people" (P8).

**Checks:**
- one tap on a single favorite starts a running game;
- one tap on a multiplayer favorite opens the lobby with the host listed as a player;
- Share produces the code's text on both platforms.


**Built 2026-11-01 (web):** `host_plays` on the create request; the lobby's QR code leads to `/?code=`, which fills the Play home's code box. Staff and parents in Tutoring spaces get a compact favorites row above their dashboard.
### P8. Family rosters and Waiting for you

**The roster**
- **Where it lives:** an optional `roster` (members of this space) in `gameFavoriteSchema`, stored in a new
  column, `quest_game_favorites.roster`.
- **Older apps:** `saveFavorite` leaves `roster` alone when it is absent, so an older app cannot wipe it.
- **Choosing a roster:** a non-admin uses a small members read route that returns the first names of this
  space's members. It gets a new exposure rule and a place in the exposure crawl.

**Starting a roster game**
- **What one tap does:** it makes the game (host playing, `late_join` on) and writes `quest_game_invites`
  rows `(organization_id, game_id, user_id)`.
  - The table carries the org-member and fixed-organization triggers, is listed in `PURGE_ORDER` before
    `quest_games` and in the org-scope check's `ORG_TABLES`, and is indexed on `(organization_id,
    user_id, created_at)`.
- **Who is dropped:** roster members who have left the space, or who cannot sign in.

**Waiting for you**
- **The route:** `GET /quest/games/waiting` lists the reader's invitations from the last 24 hours to games
  in the lobby or running with joining open. It returns each game's code, so they join through the
  existing lookup and `JoinChoices`, in one tap and with no code to type. Joining by id already works,
  so `canSee` does not change.
- **Refreshing:** on focus or visibility, at most once a minute, stopping after a while.

**Playing**
- The host starts whenever they like. Everyone plays on their own, unless the favorite says teams.

**Checks:**
- A saves a roster with B. A's tap makes the game. B sees it under Waiting for you, on the web and in the
  app, and joins without typing a code;
- A starts before C arrives, and C may still join;
- someone not on the roster does not see it;
- a person who left the space is dropped;
- the exposure crawl covers the members route and the waiting route.


**Built 2026-11-01 (web):** the roster is chosen in a **Players** dialog on a multiplayer favorite on the Play home, rather than in the wizard. R27 in `docs/data-exposure.md`, crawled by `play-family.spec.ts`.
---

## Phase 63: open door

### P9. The guest pool, reserved

- **The pool:** each level holds 10 guest questions (the console may set 5-30), in `guest_questions
  (question_id, level_id, position)`. This is platform data.
- **The suggestion:** the console suggests the 10, and a platform admin confirms or swaps them.
  - Approved questions come first, then checked ones (Beta).
  - No topic that needs a figure.
  - They are spread across units.
  - 4 easy, 4 medium and 2 hard, served easy first, so the first answer is likely a win.
- **Reserved:** guest questions are never served to members, so no member meets a question whose key was
  public. Every draw leaves them out:
  - `drawLevelQuestions`, `drawQuestionIds` and `nextQuestQuestion`;
  - the counts, which subtract the pool's count per level instead of probing each row.

**Checks:**
- a guest question is never drawn in a member's game, Quest or Assessment;
- the console's suggestion has the difficulty mix and no figure topics;
- the counts shown to members exclude the pool.


**Built 2026-11-01 (web, API):** a member draw reads the levels' guest ids first (an index read of ~10 rows) and leaves them out in the query, so reservation costs no per-row probe; counts leave the pool out at refresh and recount. The suggestion takes approved questions first, then checked, spreading across topics within each.
### P10. The guest Play home, and play on the device

**When it shows**
- It needs both the console's **Guest play** switch and the Worker's `GUEST_PLAY` var: "true" on
  `tutoring` and the demo, "false" on `tmi-portal`.
- When both allow it, a signed-out visit to `/` (web) or the app's first screen shows the guest Play
  home. Otherwise the sign-in page shows, as today.

**The data, on `workers.dev`**
- Tiles, switches and the nudge's words ride in `GET /api/auth/config`, which every client already calls.
- Each level's pool is served at `GET /api/public/guest/<version>/<level>`, with
  `Cache-Control: immutable`.
  - The browser and the app keep it.
  - The version is bumped in `platform_settings` by every console edit.
  - The Worker memoises it in a module variable with a time limit.
- A guest visit costs about 4 requests (config, session, one pool, one beacon) and nothing from D1 or
  Durable Objects.

**One set of play screens, two engines**
- A `GameEngineContext` whose default is the existing remote engine.
- **The local engine** runs the shared rules unchanged (`serveNext`, `answerQuestion`, `gameEndReason`,
  `teamTotals`, `rankTeams`) plus a copy of the object's `toView`. It uses the same TanStack query keys
  with local functions and no polling.
- **Pause** is a virtual clock (`Date.now()` minus the time paused). A fresh view is published on
  resume, and the clock is hidden while paused.
- **The series** is unseen first, from local storage. A timed guest quest that runs out of pool questions
  ends there (P12's "out of questions").

**Guest variants**
- `ShareButton` becomes the sign-up nudge.
- The exits (web `QuestFrame`, mobile `exitQuest`) go to the Play home.
- The guest game routes sit outside `RequireAuth` (web) and outside both `Stack.Protected` guards (the
  app), so signing up mid-game does not unmount them.

**The page itself**
- Grade chips, remembered on the device.
- The open tiles, large.
- "More with a free account": the locked tiles.
- A **For parents** strip.
- The trust line, the terms and the privacy notice.

**Checks:**
- signed out, a guest plays G4Q5 end to end, on the web and in the app;
- the network log shows no request between answers;
- pausing stops the clock;
- a locked tile cannot be started;
- with either switch off, the sign-in page shows;
- `tmi-portal` shows the sign-in page.


**Built 2026-11-01 (web):** guests have a light player of their own (`features/guest/`) reusing the question pieces, not the members' engine adapter -- simpler and nothing changes for members. The guard waits for the config before choosing guest home or sign-in (the session's 401 can arrive first).
### P11. The guest Assessment

- **What it draws:** an `A` tile draws its N questions (default 5, set in the console) from the same
  reserved pool.
- **How it is answered:** one page each, on the Assessment canvas, reused through the same local-engine
  idea.
  - A choice question is answered by choosing.
  - A number question is answered by typing the final number, with the canvas for working.
- **Marking:** `checkAnswer` marks them on the device.
- **The results:** each page is redrawn with the key and the worked solution.
- **What is not done:** no PDF is built, nothing is stored, and nothing is sent. The PDF, a tutor's review
  and progress are the sign-up offer.
- **Its own switch:** **Guest Assessment**. If needed, it is built as Phase 63's second step.

**Checks:**
- signed out, a guest completes G4A5 on the web and in the app;
- choices and numbers are marked correctly;
- no request is made between pages or at the end, except the beacon;
- the results show the work beside the key.


**Built 2026-11-01 (web).**
### P12. The nudges

| Moment | What shows | Rules |
| --- | --- | --- |
| After question N (default 1) | A sheet; the clock pauses. Its headline follows the answer ("Nice! 1 for 1" / "Good try, 4 to go"), then 3-4 benefits, **Sign up free** / **Keep playing**, and "Under 13? Ask a grown-up". | Once per quest; after a dismissal, at most once a day; N = 0 turns it off. |
| A locked tile is tapped | "G4T20 is free with an account", and the benefits, this tile's first. | Every tap. |
| The free questions run out | "You've played all 10 free Grade 4 questions." **Sign up for 1,200+ more** / **Play these again**. | When the pool is used up. The number is the level's playable count, rounded down. |
| Results (quest or Assessment) | Score, ticks and crosses, and solutions. **Save this score**, **Challenge a friend** (text and `/play/<code>`, no name), **Play again**. | Always. The main conversion moment. |
| Home | A slim bar: "Playing as a guest. Sign up free to save scores and unlock every quest." **Sign in** at the top. | Always, quietly. |

**The benefits** follow what is switched on:
- "1,200+ more Grade 4 questions, never repeated";
- "Every quest unlocked: longer, timed, Random";
- "Family games: one tap, no codes";
- "Saved assessments with a PDF for your tutor";
- "Scores and streaks saved".

**The wording**
- It is edited in the console (P16), and `check-ui-words` still guards it.
- While sign-up is closed, the buttons say **Sign in**.

**"Ask a grown-up"**
- It opens the system share sheet, or a QR code, with a short message and a link to the Play home.
- It collects nothing.
- Sharing the score names nobody.

**Checks:**
- the sheet appears after question 1, pauses the clock, and resumes on Keep playing;
- it does not reappear in the same quest, nor the same day after a dismissal;
- the out-of-questions offer appears when the pool is used up;
- with sign-up closed, every button says Sign in;
- Ask a grown-up makes no request.


**Built 2026-11-01 (web).**
### P13. Sign-up as a sheet, a personal space, and back to the page

**The sheet**
- The sign-up step (age, then terms) is a sheet over the current page, on the web and in the app.
- A guest's quest, Assessment and progress live in local storage. So they survive Google's popup and the
  redirect providers' reload.
- The redirect flow returns to `kept.returnTo` instead of `/` (`routes/auth.ts`, near line 582). The
  provider buttons pass the return path.

**The personal space**
- **When it is made:** in the same batch as the account (`createSignedUpPerson` with `createSpace`).
  Every game table is per space, so a member needs one to play.
- **How it is marked:** a new column, `organizations.personal`. `created_via` is untouched: its CHECK
  cannot be widened additively.
- **What it is:**
  - its name is "<First name>'s space";
  - it is self-serve, with Quest and Assessment on, no Tutoring, and `checked_questions` on;
  - it offers NC 2026 and Beast Academy, plus the curriculum of the tile they played;
  - its maker is its admin, and it becomes their last-opened space.

**Teens (13-17)**
- A teen gets a personal space with no code and `join_by_code` off.
- Adding people (`routes/users.ts`, and the join switches) is refused for anyone not an adult. This
  replaces "only adults start a space".

**Housekeeping**
- **The space cap:** a personal space does not count toward `spaces_per_person`.
- **Deleting the account:** purges any personal space where the person is the only live member (App Store
  rules: deletion must be easy).
- **The wizard:** the onboarding wizard does not open by itself on a personal space's first visit.
- **The console:** hides personal spaces by default. They have their own audit action, so the console's
  Activity list is not flooded.

**After the sheet**
1. The logo splash, about a second.
2. Back to the same page.
3. The device's played tiles become favorites.
4. Its grade becomes the default.

A pending invitation shows as Phase 60's banner.

**What stays**
- Phase 61's Welcome stays only for someone who belongs to no space (after leaving every one).
- "Start a space" and "Invite people" stay on the Spaces page and on a **Play with your family** card.
- Tests to rewrite: `spaces-welcome.spec.ts`, and the Maestro `sign-up.yaml` and `join.yaml`.

**The limit, stated plainly:** a game code works only inside one space. A family plays together by being
in one space: the parent's, with the others invited. Friends in different spaces wait for "games between
spaces" (Later).

**Checks:**
- signing up mid-quest by Google returns to the paused quest;
- signing up by a redirect provider returns to the same page;
- the person has one personal space and lands in it with favorites from the device;
- a teen's personal space has no code and refuses adding people;
- deleting the account removes the personal space;
- no Welcome screen is shown;
- the console's space list hides personal spaces by default.


**Built 2026-11-01 (web, API):** as above; the personal space is made after the account (best effort, logged `account.personal_space`) rather than in one batch, and the redirect providers return to `returnTo` with the sign-up in the fragment, which opens the sheet at the age question.
### P14. `/play/<code>` links and Challenge a friend

- **The link:** `/play/<code>` opens the tile directly, for a guest or a member.
- **The preview:** it joins `run_worker_first` in all three Workers' `assets` blocks. Its preview tags are
  written by HTMLRewriter, as `lib/share-page.ts` does for `/s/<id>`. They are built from
  `parseTileCode` alone, with no D1 read ("G4T10 · Grade 4 · 10 minutes · Free math quest").
- **Challenge a friend:** shares text and the link ("I got 8/10 on G4T10 — can you beat it?"), with no
  name. A member's server-built share card (Phase 56) stays as it is.

**Checks:**
- `/play/G4T10` signed out starts the guest tile;
- `/play/G4T10` signed in starts the member's tile;
- an unknown code lands on the Play home;
- the preview tags show without D1.


**Built 2026-11-01 (web):** the link opens the tile; the preview tags (HTMLRewriter) are not built yet.
### P15. Anonymous counts, and the privacy notice

**How counts are sent**
- To an Analytics Engine dataset, `PLAY_EVENTS`, bound on each Worker. The unused `SHARE_VIEWS` binding
  is bound at the same time.
- Through `POST /api/public/events`, batched with `sendBeacon` at a quest's end and when the page is
  hidden, at most 20 events a batch.
- No cookie, id, IP or third-party SDK, and no `RateLimiter`, which would cost a Durable Object request
  per beacon.

**What is counted**
- The home viewed; a tile started; question 1 answered.
- The nudge shown, accepted or dismissed, with its variant.
- A quest or Assessment finished; the pool used up; a locked tile tapped.
- Sign-up started and finished, with its source; "Ask a grown-up" used.
- A member's one-tap start (tile, favorite, continue or waiting); a family join.

**The privacy notice** gains a new version after 2026-10-31, for the owner's approval: "Anonymous counts
of how the site is used, such as how many quests are started, with no cookies, identifiers or IP
addresses, and no third-party analytics. A guest's device remembers its grade and the free questions it
has played; nothing about a guest is sent to us."

The guest funnel is read in Cloudflare's Analytics Engine dashboard. Members' weekly players come from D1,
on demand in the console.

**Checks:**
- a beacon carries only the allowed fields;
- an oversized batch is refused;
- the privacy page shows the new version;
- no request carries a cookie or id from a guest.

### P16. The console's guest settings

On the Play tab (P5):
- **Switches:** **Guest play** and **Guest Assessment**.
- **Guest pool:** per level, the suggested questions, with swap, confirm and size; how many questions a
  guest Assessment draws.
- **The nudge:** after which question, the cooldown, the headline and benefits, and the home bar's text.
- **Tiles:** each tile is open, locked or hidden for guests (P5).

Every change is a platform audit line (`recordAudit(..., 'platform', ...)`), with new `AUDIT_ACTIONS`
and a prefix in `listPlatformAudit`. Each change bumps the pool version.

**Checks:**
- each setting is visible on the guest home within a minute of saving;
- each change is logged;
- the app's console shows the same settings.


**Built 2026-11-01 (web, API).**
---

## Phase 64: habit

### P17. A weekly streak, and today's ring

- **The streak** counts weeks in a row with at least 3 days played. It is weekly, not daily, because that
  is kinder to children (as `docs/roadmap/open-to-public.md` argued). A "played today" ring sits beside
  it.
- **The data:** a game's end writes `activity_days` in the results batch.
  - A new column, `game_answers`, holds it. `answers` is not used, because Question Quest's totals sum
    it.
  - Only players who answered get a row.
  - Each insert is guarded by `WHERE EXISTS` membership, so one departed player cannot fail the batch and
    loop the alarm.
  - The day is on the space's clock, from a `time_zone` stored on `EngineGame` at create (with a default
    in `normalizeEngineGame`).
- **Points:** games still award none.

**Checks:**
- three days of play in a week extend the streak;
- a departed player does not fail the results;
- the day follows the space's time zone.

**Built 2026-11-01, with three changes from the plan above:**
- **The day comes from the space's own row at the game's end** (one read of `organizations.time_zone`),
  not a `time_zone` stored on `EngineGame`: games made before the release then count on the right day
  too.
- **Badges are derived, never stored:** there is no `user_badges` table. `earnedBadges` (shared) reads
  the counts the platform keeps anyway (finished games, invitations, Daily results, the best weekly
  streak), so a badge is earned once by construction and nothing needs purging. "Cleared every G4
  tile" is replaced by **Seven Dailies** (a Daily played on 7 days), which the data answers cheaply.
- **My progress is the reader's own** (`GET /api/quest/me/habit`, no person parameter, R28). A parent's
  view of their children waits for the parent's "This week" card (`docs/roadmap/stickiness-later.md`).

### P18. Badges and My progress

- **Where they are kept:** `user_badges (organization_id, user_id, badge, earned_at)`, with the
  org-member triggers. It is listed in the purge order.
- **The badges:**
  - the first quest;
  - 10, 50 and 100 quests;
  - "Cleared every G4 tile";
  - the first family game;
  - 4 and 12 weeks in a row.
- **Where they show:** on a **My progress** card on the Play home. Its audience is the person, their
  guardians, their current tutors and the space's admins (the progress audience). It needs an exposure
  rule and a crawl.

**Checks:**
- each badge is awarded once;
- the card shows to its audience and to nobody else.

### P19. The Daily set

- **The set:** `G4D` is five questions per level per day, the same for everyone on the platform.
  - They are drawn by a seed of the date: approved first, then checked, never the guest pool.
  - One play a day.
- **The share grid:** "Aimtrue G4D #42 ✓✓✗✓✓ 4/5 · 2:13".
- **Its switch:** **Daily set**. For guests it is a second switch, off by default.

**Checks:**
- two people get the same five questions on the same day;
- a second play the same day is refused;
- the grid names nobody.

**Built 2026-11-01, with one change:** the Daily's questions come **without keys**; the answers go to
the server once, at the end (`POST /api/quest/daily/:level/result`), which marks them by code
(`checkAnswer`), keeps the marks (never the answers) in `daily_results`, and returns the keys with the
result (R20). A space with Checked questions off gets the approved-only Daily (memoised per variant). A
Daily counts as a day played. The console's Settings > Play has a **Daily set** switch (on by default);
the guests' Daily waits for a later phase.

### P20. Beat your best

- Each tile keeps a personal best: on the device for guests, and on the account for members (derived from
  `quest_games`, never stored).
- The results say "New best!".

**Checks:** a better score shows "New best!", and a worse one does not.

**Built 2026-11-01:** `GET /api/quest/tiles` carries each tile's `best` (the reader's highest score of
that shape: level, mode and length, single player, finished games), and a single player's results say
**New best!** when the game beat every earlier one of its shape.

---

## Rules to add (with the build)

- **R26 (guests).** A guest reads only the tiles, the switches, the nudge's words and the reserved pool,
  with nothing of any space or person. Guest questions never reach a member. A guest's answers reach us
  only as anonymous counts. The exposure spec crawls the public routes: only the allowed fields, and no
  key outside the reserved pool.
- **R27 (rosters and waiting games).** A roster names members of the space only. A waiting game is seen
  only by its host and its invitees. The members route gives first names only.
- **R28 (the habit layer, built with Phase 64).** Streak, badges, a tile's best and New best! are the reader's own;
  the Daily's questions travel without keys until played, and only the marks are kept.
- **`CLAUDE.md`** gains rule paragraphs for the tiles and Play home, guest play, personal spaces,
  `checked_questions`, and game answers in the two-right-answers count.
- **`docs/data-model.md`** gains personal spaces and the new tables.

## Data (additive; fenced `release=phase-NN` in `docs/database.md`)

| Phase | Tables | Columns | Indexes |
| --- | --- | --- | --- |
| 62 | `platform_settings` (key PK, value JSON, updated_at), `quest_tiles`, `quest_game_invites` | `organizations.checked_questions` (default 1, set to 1 on every existing space), `quest_game_seen.correct`, `quest_game_favorites.roster` | the partial index on `quest_game_seen` |
| 63 | `guest_questions` | `organizations.personal` | — |
| 64 | `user_badges` | `activity_days.game_answers` | — |

## Quota and safety

**Requests**
- A guest visit costs about 4 Worker requests, and nothing from D1 or Durable Objects. That is roughly
  25k guest visits a day on the free plan.
- A member's 10-question solo game costs about 12 requests (from about 300), and a few hundred D1 rows
  read (from about 30,000).

**When to buy Workers Paid ($5 a month)**
- Above 60k requests a day for 3 days running, or reads above the existing 2.5M alert.
- Guest play is the first advertised surface. That reopens the Phases 49-52 decision to stay on the free
  plan.

**Abuse**
- The public GETs are versioned and read-only.
- The events route caps its batch and writes only counts.
- No Turnstile is needed, since nothing per person is written.

**Children**
- Nothing about a guest is stored on our side.
- No identifiers, and no third-party code.
- Sign-up still refuses under-13s.
- "Ask a grown-up" collects nothing, and share text names nobody.

**App Store:** playing without an account fits guideline 5.1.1(v) (do not force sign-in), which helps
review.

## Targets (hypotheses for the 8 weeks after Phase 63)

| Metric | Target |
| --- | --- |
| Home viewed → first question answered | ≥ 60% |
| First quest finished | ≥ 50% of starts |
| Guest who finished → sign-up finished | ≥ 5% (started ≥ 10%) |
| Members who return in week 1 / week 4 | ≥ 30% / ≥ 15% |
| Members' quests started in one tap | ≥ 40% |

**The north star:** weekly players, the people who finished at least one quest that week.

**First experiments,** read as anonymous counts by variant:
- the nudge after question 1, against results only;
- how many tiles are open;
- the code first, or the words first.

## Risks

- **Interrupting after question 1 may lower completion.** It is capped, can be dismissed, and is measured
  against results only.
- **Beta questions may carry a wrong key.**
  - Every checked question already passed the code's checks and Claude Opus's blind solve.
  - Two people making the same mistake could still approve a key that matches a common misconception.
  - Safeguards: a member's report, a tutor's flag, and the console's list of quest approvals, where a
    platform admin retires a bad one.
- **Families in separate spaces** cannot share games until they are in one space.
- **The free plan's request cap:** see the trigger above.
- **Phase 63 is the largest.** The guest Assessment may be built as its second step, inside the same
  phase and switch.

## How it is tested

- `npm run typecheck`, with the org-scope, ui-words, purge and catalog guards.
- `npm run smoke` on the web, iOS and Android, after every API or schema change.
- **Web specs:**
  - `guest-play.spec.ts` (P9-P14);
  - `play-home.spec.ts` (P5-P8);
  - `checked-questions.spec.ts` (P1-P3);
  - `play-habit.spec.ts` (P17-P20);
  - the exposure crawl for R26 and R27;
  - a reservation test;
  - a D1 `rows_read` test for one-tap starts.
- **Maestro flows:** `play/*` on both platforms, with the smoke-tagged path: the Play home, a one-tap
  start, a guest tile.
- **curl, signed out:** the public routes answer 200; every member route answers 401.
- **`npm run test:compat`** against the last `release-*` tag, since the schema changes.

## Later (unscheduled)

These are listed in `docs/roadmap/stickiness-later.md`:
- retiring `tmi-portal`;
- games between spaces;
- push notifications;
- WebSockets for multiplayer games;
- an installable web app;
- a parent's "This week" card;
- Assessment tiles for members;
- Family Quest Night;
- the Phase 45 rewards shelf and an opt-in family leaderboard;
- "You beat 62% of players";
- a real domain and pages per tile for search.
