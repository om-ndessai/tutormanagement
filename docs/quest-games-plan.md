# Quest Games: play the question bank together with a code (Phase 46)

The owner's brief (2026-10-21): under Quest, anyone can start a game, and anyone can join it with a
code, on their own or as a team; a team has its own code too. The starter sets the game: the level of
the bank its questions come from, either a number of questions or a time limit, and whether a wrong
answer costs a point. A team wins by solving all the questions, or by getting the most right in the
time. In a team, the next question served to a member is the next of the series not yet served to
any teammate. The series is built when the game starts, in memory, so the next question comes at once.
Only approved questions are played, unless the organization includes questions not yet reviewed.

This document is the plan. Where the brief left a choice open, the default chosen is marked
**(default)**, for the owner to change.

## The game

**Who.** Anyone signed in to the organization (an admin, a tutor, a parent or a student) may start a
game or join one. Like Question Quest, games are behind the organization's Quest switch
(`gamify_question_quest`) -- they live under Quest, and need no switch of their own **(default)**. A
student who cannot sign in cannot play, as in Quest.

**Inside one organization (default).** A code works only in the organization it was made in: a
game is one organization's, its players are its members, and nothing crosses organizations (R13).
Games between organizations are a later proposal (`reports/Math challenge platforms market.md`, phase
C), with parental consent first.

**Setting it up.** The starter (the host) chooses:
- **Level**: a level of the question bank the organization offers (NC 2026's grades G3-G8 and Math 1;
  Beast Academy's levels and the AoPS books where the organization offers Beast Academy), the same
  list as the Assessment menu, with how many questions each has.
- **Length**: a number of questions (1-50), or a time limit (1-30 minutes).
- **Negative marking**: on or off. A right answer scores +1; with negative marking a wrong answer
  scores -1 (otherwise 0). A skipped question always scores 0, so negative marking makes skipping a
  real choice.
- **Team size**: the most players a team may have, 1-6 (default 4). At 1, everyone plays alone.

The game gets a six-character code (letters and digits that cannot be misread: no 0/O, 1/I/L).

**Joining.** Before the start, a player types the game's code and then either plays on their own, or
starts a team (naming it; the team gets its own code), or types a team's code to join that team. A
team code alone also works: it joins that team's game and that team. The host need not play; they
may join like anyone else. Players may leave before the start. Joining after the start is not allowed
**(default)**: the teams are fixed when the game begins.

**Questions.** When the host starts, the Worker draws the series once, at random, from the level:
approved questions only, or approved and checked ones while the organization's "include questions
not yet reviewed" (`canvas_assessments_unreviewed`, the switch the Assessment menu already uses) is on.
Standards that need a figure are left out, as everywhere. A count game draws exactly its count (and
cannot start if the level has fewer); a timed game draws up to 150. **Every team plays the same
series in the same order**, so no team is luckier than another.

**Playing (full screen, web and app).** Each player holds one question at a time. When they ask for
one, they get the next question of the series that no teammate has been served -- the team's queue,
held in the game's memory, so no two teammates ever see the same question. A player answers (a
choice, or a number) or skips; there is no going back. Code marks the answer at once (`checkAnswer`)
and the player sees right or wrong and their team's score; the right answer itself is shown only on
the results, after the game, so a quick team cannot pass keys to a slow one mid-game. Everyone sees the
scoreboard live: each team's name, its players' first names, its score, and how far it has got.

A player who leaves mid-game hands their question back: it goes to the front of the team's queue. A
question held for more than two minutes while a teammate has nothing left to do passes to that
teammate, so one idle player cannot stop a team finishing.

**The end.**
- A **count** game ends when every team has answered (or skipped) every question, or when the host
  ends it. A team that has done every question is *finished*, with its time.
- A **timed** game ends when the time is up (the game's own alarm, and every read after it), or when
  the host ends it. A question still in a player's hand at the end does not count.

**Winning.** The highest score wins.
- Count game: a tie goes to the team that finished all the questions, then to the earlier finish.
- Timed game: a tie goes to fewer wrong answers, then to the team that reached its score first.
Teams still tied share the place. The results show each team's place, score, right / wrong /
skipped, and -- to each player -- their own team's questions with the right answers and solutions,
for learning from (feedback after the game, `reports/Question Quest gamification market.md`).

**No Quest points (default).** A game awards nothing in the Quest ledger: Quest's points are for
checking the bank, and a game plays questions already approved. The owner may decide otherwise later
(for example a point per game played, never per rank).

## How it runs: one Durable Object per game

Cloudflare's free plan has no shared in-memory cache across requests -- a Worker's memory lasts one
isolate, and the next request may land on another -- but it does include **Durable Objects** (the
SQLite-backed kind, on the free plan since April 2025: 100,000 requests and 13,000 GB-s a day, 5 GB of
storage). A Durable Object is one instance with its own memory, addressed by name, that handles one
request at a time. That is exactly a game:

- `QuestGame` (`apps/api/src/durable/quest-game.ts`), one per game, named `<organization>:<game id>`
  -- so a game id from another organization reaches an empty object and answers 404, by construction.
- It holds the game in memory: the settings, the teams and players, the **series with its keys**
  (never sent to a client), each team's cursor and the questions in players' hands, every answer, the
  scores. It writes each change to its own storage too, so an object evicted from memory wakes with
  the game intact; a timed game sets an alarm for its end.
- **Serving the next question reads nothing from D1**: it is the next index of an array in memory,
  and the object's one-request-at-a-time rule is what makes "not yet served to any teammate" exact,
  even when two teammates ask in the same instant.
- The Worker's route checks the person (signed in, a member, `requireOrg`) and passes the request to
  the object by RPC; the object checks they are the host, a player or an admin.
- D1 keeps the record: the game (for the code lookup, the list of games and the audit), the teams
  (for team codes) and the players, written when they join; at the end the object writes every team's
  totals, place and answers (one JSON column per team, so the end is a handful of statements, well
  inside the free plan's per-request query limit). Nothing during play writes to D1.
- The clients poll the game every 2 seconds for the scoreboard and the clock (the object answers from
  memory; the only D1 reads are `requireOrg`'s usual membership check). WebSockets (the object's
  hibernation API) are the later improvement if polling ever shows.
- Bindings: `durable_objects` and `migrations` (`new_sqlite_classes: ["QuestGame"]`) restated on all
  three Workers, as every binding is.

## Data model (additive)

- `quest_games`: id, organization_id, code (unique), host_user_id, level_id, mode (`count` |
  `timed`), question_count, duration_seconds, negative_marking, max_team_size, include_unreviewed
  (what the organization's switch was at the start), status (`lobby` | `running` | `finished`),
  created_at, started_at, ended_at.
- `quest_game_teams`: id, organization_id, game_id, code (unique; NULL for a player on their own),
  name, solo, created_by_user_id, created_at; written at the end: score, correct, wrong, skipped,
  finished_at, place, answers (JSON).
- `quest_game_players`: game_id, organization_id, team_id, user_id, joined_at; at the end: correct,
  wrong, skipped. Primary key (game_id, user_id): one team per player per game.
- Same-organization triggers on all three (the host, the team's creator and each player must be
  members; a team and a player belong to their game's organization); organization fixed.

## Audit and exposure

- Audit: `quest.game_created`, `quest.game_joined` (on their own, or the team they started or
  joined), `quest.game_started`, `quest.game_ended` (by the host). Each names the person and the level,
  never an answer or a score. Answers are not audit lines (as Quest's are not).
- Exposure, **R20**: a game -- its settings, teams, players' first names and scores -- is read by its
  host, its players and the organization's admins, and nobody else (404). A team's code is shown to
  its own players, the host and admins. The questions' keys are sent only on the results, after the
  game, and only to the players of that team and the host and admins. Names are first names only, the
  way a child is shown to other children. The list of games is a person's own (hosted or played);
  an admin's is the organization's.

## Screens (web and app together)

- **Quest page / Quest tab**: a "Games" card for everyone with Start a game and Join with a code, and
  the person's recent games.
- **Start a game**: level, length (questions or minutes), negative marking, team size.
- **Lobby** (full screen): the code, large, for the host to read out; the teams and players as they
  join; Play on my own / Start a team / Join a team; the host's Start.
- **Play** (full screen, the Quest frame): the question, the answer (choices or a number), Submit and
  Skip, the clock or the count left, the team's score; the scoreboard beside (iPad, desktop) or under
  (phone) it.
- **Results**: places, scores, and the team's questions with the right answers.

## Tests

- Unit: the shared game rules (scoring, serving, ranking, ties) with the mobile Jest suite.
- Web: `e2e/tests/quest-games.spec.ts` -- a team of two and a solo player, the team's queue never
  serving one question twice, negative marking, the end and the winner, R20 for an outsider; the new
  read routes in `exposure.spec.ts`.
- App: Maestro flows in `apps/mobile/.maestro/flows/quest/` (start a game, join with a code, play).
- `npm run smoke` on both clients (an API, contract and schema change).
