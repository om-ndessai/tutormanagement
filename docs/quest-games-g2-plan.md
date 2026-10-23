# Quest Games, round two: the start wizard, scoring, knockout and the countdown (Phase 47)

The owner's brief is "Phase G2" in `docs/gamification.md` (2026-10-22). It improves the games of Phase 46
(`docs/quest-games-plan.md`) and reaches the web and the app together. Where the brief left a choice
open, the default chosen is marked **(default)**, for the owner to change.

## Is there an in-memory cache of the game's questions? Yes, one per game

The owner asked. There is no cache shared by every game or every request: Cloudflare's free plan
has none, since a Worker's memory lasts one isolate and the next request may land on another. The
in-memory store is **the game's own Durable Object** (`QuestGame`, Phase 46):
- When the host starts the game, the object draws the whole series from D1 in **one** query (`ORDER BY
  random()` over the level's topics). It keeps the series, with its keys, **in memory**, and also
  writes it to the object's own SQLite storage.
- Every "next question" after that is the next index of that in-memory array. It reads nothing from D1
  and makes no network hop beyond the Worker reaching the object.
- If Cloudflare evicts an idle object, it wakes up with the series from its own storage, not from D1.
  The series is drawn once per game, ever.
- The cost is the one draw. `ORDER BY random()` reads every eligible row of the level to choose from
  them: about 1,000 to 2,000 rows for one grade, and up to about 10,000 for a "Random, G3 and up" game
  that spans a family. That is well inside D1's 5 million reads a day. If games ever become frequent, the
  improvement is to pick ids by random seeks, so the draw reads only what it returns.

## The wizard (web and app)

"Start a game" becomes its own full-screen page (web: `/quest/games/new`; app: `quest/new-game`), in
five steps, with Back and Next. The steps are listed here, and the review is the fifth.

1. **Questions.**
   - Tiles, not a drop-down: one tile per level of the bank the organization offers, each with its
     number of questions.
   - A **Random** tile, with a "Starting at" picker. Random draws from the starting level **and every
     level above it in the same family** (NC 2026: K to Math 2; Beast Academy: BA1 to the AoPS books,
     `QUEST_LEVEL_FAMILIES`), never below it. A level outside any family (NC's fourth-year courses)
     draws only itself.
   - The person's **favorites**, when they have any, are listed first on this step as their own named
     tiles. Choosing one fills every step and goes straight to the review.
2. **Length.** A number of questions (1-50) or a time limit (1-30 minutes), each with a − / + counter.
3. **Scoring.**
   - Points for a right answer, 1 to 10 (default 1), and for a wrong answer, −10 to 0 (default 0),
     each with a − / + counter. A skip always scores 0, so a negative wrong answer makes skipping a
     real choice.
   - **Knockout**, a checkbox: the game ends mid-play as soon as one team can no longer be caught (see
     below). It means something only with two teams or more.
4. **Players.**
   - **Single player**: the host plays alone, for practice, with no code to share.
   - **Multiplayer**, with these choices:
     - the most teams, 2 to 20 (default 10);
     - **Everyone on their own**, where each team is one player, or **Teams**, with a team size of 2
       to 6 (default 4). At a size of 2, a third player is refused;
     - **Joining**: closed once the game starts (default), or open while it runs.
5. **Review.**
   - Every choice, in words.
   - **Save as a favorite**, with a name (up to 40 characters). Saving under an existing name replaces
     that favorite (default). A person keeps up to 12 favorites in each organization (default), and can
     delete one from step 1.
   - The action is **Generate game code** for multiplayer and **Start game** for a single player. After
     it there is no going back: the wizard is replaced by the game. A multiplayer game opens its lobby
     with the code. A single-player game goes straight into the countdown.

## Joining

- **Two codes for a team.** In a game of teams, a player first types the game's code, then either
  **starts a team** (naming it, and getting the team's own code to share) or **types a team's code**
  to join that team. A teammate therefore types two codes: the game's, then the team's. A team code
  typed on its own in the Quest page's box still finds its game and team, as in Phase 46.
- **Everyone on their own:** the game's code alone joins.
- **Refused:**
  - a team past its size;
  - a new team past the game's most teams;
  - anyone joining a single-player game;
  - joining after the start, unless the host left joining open. With joining open, a late team plays
    the same series from its first question, and a late teammate takes the team's next question.

## The game status page and the countdown

- **The lobby is the game's status page.**
  - It shows every team, its players and how each team stands.
  - The host's action is **Start the Quest**.
  - When the host starts, every screen shows a short countdown at once: two doors swing open on 3, 2,
    1, "Go!". The game then begins together for everyone.
  - How the countdown is shared: the object starts the clock 5 seconds after "Start the Quest"
    (`GAME_COUNTDOWN_MS`). Each screen counts down to that moment against the server's clock (`now` in
    every reply). No question is served before it, and a timed game's time starts then.
- **When a player has nothing left** (their team has answered every question, or its last ones are in
  teammates' hands), they land on the status page: every team's score and progress, live, until the
  game ends.
- **The end.**
  - Winners get **confetti**. Everyone else gets a line of encouragement that is about their own game,
    such as how many they got right, never about how far behind they were.
  - When knockout ended the game, the status page plays a short **knockout** animation first.
  - Under reduced motion there are no doors, confetti or knockout animation, only the words.

## Knockout

The game ends early when one team's lowest possible final score is above every other team's highest
possible final score.
- A finished team's final score is its score.
- An unfinished team could still gain, at most, its remaining questions × the points for right. It
  could still lose, at most, its remaining questions × the points for wrong (when that is negative).
- A team's remaining questions are the series length less what it has answered.

The brief's example: one team has finished on 20 of 25. The other is at question 6 on 0 and can reach
at most 19. The game ends.

Knockout applies only to multiplayer games with knockout on and at least two teams with players. In a
timed game the series is the most it draws (150), so knockout ends a timed game only in a lopsided
case. The game's `end_reason` records why it ended: `complete`, `time`, `knockout`, `host` or
`expired`.

## Scoring and winning

The highest score wins, with Phase 46's tie-breaks:
- a count game: finishing every question, then the earlier finish;
- a timed game: fewer wrong answers, then reaching the score first.

`negative_marking` is kept on the record and in replies, derived as "wrong points below 0", for the app
builds already on the phones. A create request without points (an older app) means right +1, and wrong
−1 or 0 by its negative-marking choice.

## Beta

The Quest menu item carries a **Beta** badge: the web sidebar's Quest item and the Quest page's header,
and the app's Quest entry.

## Data (additive; carried to production by hand, `docs/database.md`)

- New columns on `quest_games`, all with defaults: `level_scope` (`level` | `upward`),
  `right_points`, `wrong_points`, `knockout`, `players` (`single` | `multi`), `max_teams`, `late_join`
  and `end_reason`. They describe Phase 46's games correctly as they stand.
- A new table, `quest_game_favorites`: one person's named settings in one organization. It holds
  `(organization_id, user_id, name)`, unique and case-insensitive, and `config`, the create request's
  JSON, checked again by the shared schema on every read. It has the usual same-organization and
  organization-fixed triggers.
- A game's object keeps the extra settings in memory and in its own storage. A game stored by Phase 46
  is filled in with the defaults when it is read (`normalizeEngineGame`).

## API

- `POST /api/quest/games` takes the new settings. For a single player it creates the game, enters the
  host as the one player and starts the countdown, all in one request.
- `GET /api/quest/games/favorites`, `PUT /api/quest/games/favorites` (by name: save or replace) and
  `DELETE /api/quest/games/favorites/:id`. A person's own favorites only (a favorite is not a game).
- Audit: `quest.game_favorite_saved` and `quest.game_favorite_deleted`. A favorite's name is in the
  line; its settings are not.
- Exposure (R20 grows): a favorite is read and written only by its owner, in its organization; anyone
  else gets 404.

## Tests

- Unit (the app's Jest suite, on the shared rules):
  - custom scoring;
  - knockout, with the brief's example, the case of negative points, and a game knockout cannot end;
  - the countdown, where nothing is served before the start;
  - late joining;
  - the upward level list;
  - the create schema's old and new forms.
- Web: `e2e/tests/quest-games.spec.ts` grows to cover:
  - the wizard, and favorites (save, list, replace, delete, 404 for another person);
  - single player;
  - the countdown;
  - custom points;
  - a knockout end;
  - most teams, team size and late joining.
  The favorites routes' R20 checks (another person, an admin) are in that spec too. Quest is off
  during the exposure crawl, as it was for Phase 46.
- App: the Maestro flows in `apps/mobile/.maestro/flows/quest/` follow the wizard. `npm run smoke` runs
  on both clients.

## Release

Owner, 2026-10-22: the test account's D1 has used up its day.
- After the local suite and smoke are green, the change goes **straight to production**: back up,
  apply this phase's SQL, then `npm run deploy`.
- The demo (`deploy:test` and `db:reset:test` on `tutoring-test`) waits until the test account's limit
  resets.

## Fixes after the release (owner, 2026-10-22)

- **The Players step's wording.**
  - It now asks **How do people play?** first: **Each on their own**, or **In teams**.
  - Then it gives the numbers, each with a line saying what it counts:
    - **Players, at most**, or **Teams, at most**;
    - **Players per team, at most**: "Once a team is full, nobody else can join it."
  - The summary reads "Up to 3 teams, at most 2 players per team" (`gamePlayersLabel`). It used to read
    "Up to 3 teams of up to 2".
- **"This game was not found, or you are not in it" in the middle of a game.**
  - **The cause:** both clients showed that message on *any* failed poll, so a single dropped connection
    or server hiccup replaced a live game. The app was worse: it stopped polling after one failure, so the
    message stayed until the game was reopened. The game itself was never lost on the server.
  - **The fix:** only a 404 or 403 means the game is missing (`gameIsMissing`). Any other failure is
    retried three times, a second apart, and polling carries on. The game stays on screen with a
    "Reconnecting to the game…" line until a poll gets through.
  - **Before the first read:** if a game cannot be reached before it has loaded at all, the screen says
    so, with **Try again**.
  - **Tests:** the web spec drops the connection mid-game, and the app's Jest suite covers a dropped
    connection and a real 404.

## The wizard and joining, reworked (owner, 2026-10-23)

- **New Quest.** The Quest page's button, and the wizard's title, say **New Quest** (it said "Start a game").
- **Four steps, not five.**
  - **Select level** (it was "Which questions?"). The tiles are smaller (three to a row on a phone, six on
    a wide screen) and show the level's name alone: no count of questions. Random is a tile like the rest.
  - **Score Setup** merges the old Length and Scoring steps, under two sub-headings: **Game limit** (a
    number of questions or the minutes) and **Points** (right, wrong and Knockout).
  - Then the players and the review, as before. The review keeps one card per setting.
- **The lobby** says **Game code** over the code. The "Game status · waiting to start" label is gone.
- **Joining a game of teams.**
  - **The host** only starts a team. There is no team code field and no tab bar.
  - **Everyone else** chooses on a tab bar: **Join a team** (a team's code) or **New team** (a name). New
    team opens while the game has no team yet; otherwise Join a team does.
  - **One action:** **Join the game**. The old "Start a team" and "Join a team" buttons are gone, and a team
    code that names a team also says "Join the game".
  - **A new team's name** is filled in as **Team <first name>** (`defaultTeamName` in shared), for the person
    to keep or change.
- **No server change.** The routes and the join request are as before.
