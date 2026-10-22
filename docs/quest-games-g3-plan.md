# Quest Games, round three: a series curated against what the players have seen (Phase 48)

The owner's brief is "Phase G3" in `docs/gamification.md` (2026-10-22). It builds on Phases 46 and 47
(`docs/quest-games-plan.md`, `docs/quest-games-g2-plan.md`). Where the brief left a choice open, the
default chosen is marked **(default)**, for the owner to change.

## The brief, point by point

- **The series is built when the host starts the game, after the lobby.** This was already so: since
  Phase 46, the game's object draws the series when the host presses "Start the Quest" (a single
  player's game, at once, its host being its one player). What G3 adds is that the draw now knows who
  is playing.
- **Record which questions each person has seen.** A new table, `quest_game_seen`: one row per person
  and question, in an organization.
- **Leave out every question any player in the game has seen.** The draw excludes a question if any
  one of the game's players has seen it.
- **When the bank runs short, go up a level.** The draw then takes unseen questions from the next level
  of the family, then the next, until the series is long enough.

## How the draw works now

When the host starts the game, the object draws the series from D1 in up to three steps. Each step
reads only while the series is still short.

1. **The game's own levels, unseen.** At random, leaving out anything any player has seen. For a level
   game that is the one level; for Random it is the level and every one above it in its family.
2. **Climbing, unseen.** While the series is short, the same from each level above in the family, one
   at a time, in order (`gameClimbLevelIds`: for G4, G5, then G6, and so on; for BA3, BA4, then BA5,
   and so on). Only levels the organization offers and has questions in. Random has nowhere left to
   climb: its levels already run to the top of the family.
3. **Seen, the oldest first (default).** If the whole family has nothing unseen left, the series is
   filled with questions the players have seen, the least recently seen first, so a game still starts.
   A count game is refused only when the bank itself does not hold enough questions.

The series keeps that order: the game's own level first, harder ones after it, repeats last. Every team
plays the same series, as before.

A count game's size is checked at creation against the level **and** the levels it can climb into. So
a 30-question G4 game is allowed where G4 alone holds 20 approved questions, and it climbs into G5 for
the rest.

## What counts as seen

- **Seen:** every question a team answered or skipped, and any still in a player's hand when the game
  ended (`teamSeenIndices`).
- **Each teammate has seen all of their team's questions:** the results show every one of them, with
  its key, to each player on the team.
- **One row per person and question.** Seeing a question again moves its row to that game and that
  moment, which keeps "least recently seen" true.
- **Per organization**, like everything else about a person there (R13). A person in two organizations
  starts fresh in each **(default)**.
- **Games only (default).** Phase 42's Question Quest play (`quest_attempts`) does not count: it serves
  questions still waiting for review, while games mostly serve approved ones, so the two rarely meet.
  Counting them is one more `NOT EXISTS` if wanted.
- **Not counted:** a player who leaves while the game runs (their hand goes back to the team). Neither
  is a game they are playing at the same moment in another tab: its rows arrive when it ends.

## When it is written: at the end, not as each question is served

The brief says to record a question as it is presented. The object does know that moment. But it writes
the rows to D1 **once, when the game ends**, in the same batch as the results, as one more statement:
- **Serving stays free of D1.** That is what makes "the next question no teammate has been served"
  exact, and it keeps an answer's reply fast (Phase 46).
- **One statement, not one per question.** A game of 4 players and 25 questions is 100 rows in one
  `INSERT ... SELECT` over JSON, well inside the free plan's per-request query limit.
- **Nothing is lost.** The list is kept in the object's own storage until D1 has it. A failed write is
  retried by the alarm, as the results already are. A game left running ends by its alarm (`expired`),
  and writes its rows then.

The only difference from writing as each question is served: a game that is still running has not yet
excluded its questions from another game started by the same person at the same time.

## Cost (D1's free plan)

- **Reads.** The draw already read every eligible question of the level (`ORDER BY random()`). Each
  candidate now also probes `quest_game_seen` once per player, on its primary key `(organization_id,
  user_id, question_id)`, so no second index is needed. A 4-player game at a level of 1,500 questions
  reads about 7,500 index rows more. A climb step reads the next level the same way, and only when it
  is needed.
- **Writes.** One row per player and question seen, at the end. A big game (20 teams of 6, 150
  questions each) could write 18,000. A usual one writes about 100. The free plan allows 100,000 writes a
  day.

## Data (additive; carried to production by hand, `docs/database.md`)

`quest_game_seen (organization_id, user_id, question_id, game_id, seen_at)` has:
- the primary key `(organization_id, user_id, question_id)`;
- a same-organization trigger, which checks the person against `org_members` and the game against the
  organization;
- the usual organization-fixed trigger.

The game's object also gains `climb_level_ids`. A game stored before Phase 48 reads it as empty
(`normalizeEngineGame`), so it does not climb.

## Exposure (R20)

- **No route reads `quest_game_seen`.** Only the draw does, to leave questions out.
- **Nothing new reaches a client.** The questions still reach a player one at a time, with keys only on
  their own team's results.
- **No audit line.** Seeing a question is not an action (answers were never audit lines either).

## Screens

None change. The series is what changes: fewer repeats, and harder questions once a level is used up.
The web app and the app call the same routes as before, so both are smoke-tested and neither is edited
(`docs/mobile/parity.md`).

## Tests

- **Unit** (the app's Jest suite, on the shared rules): `gameClimbLevelIds` (upward only, never below,
  none for Random or at the top of a family) and `teamSeenIndices` (answers, skips and hands, each
  once).
- **Web:** `e2e/tests/quest-games.spec.ts`, "Quest Games, curated (Phase 48)", with only approved
  questions, where G4 holds 12 and G5 none until three are approved for the test:
  - a single player plays all of G4 once;
  - their next G4 game climbs to G5 and repeats nothing;
  - a game larger than G4 alone may be made;
  - a two-player game repeats neither player's most recent questions;
  - the second player's next game leaves out what they saw in it.
- **Smoke:** `npm run smoke` on both clients.

## Release

Owner, 2026-10-22: the test account's D1 has used up its day.
- After the local suite and smoke pass, the change goes **straight to production**: back up, apply this
  phase's SQL, then `npm run deploy`.
- The demo waits until the test account's limit resets.
- The app has no change of its own, so the phones need no reinstall.
