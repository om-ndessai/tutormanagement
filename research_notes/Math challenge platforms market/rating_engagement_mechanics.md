# Rating, matchmaking, scoring and engagement mechanics for math challenges and clashes (as of October 2026)

Scope: how competitive puzzle, learning and game products rate people and items, score speed and
accuracy, run tournaments and keep people coming back, and what the evidence says about
competition and gamification for children's math learning; plus anti-cheating for timed online
quizzes. Written for designing "challenges" (timed tournaments on a shared question set) and
"clashes" (live head-to-head) on a tutoring platform whose users are mostly children.
Researched 2026-10-21. Product facts are from live help pages where reachable; where only forum,
secondary or vendor sources were reachable, that is said beside the claim.

## 1. Chess-world puzzle mechanics: Chess.com Puzzles/Rush/Battle, Lichess puzzles/Storm/Racer, and tournament formats

### Takeaway
Both big chess sites split a slow, RATED puzzle mode (player vs. puzzle, both carrying ratings) from
fast, UNRATED score-attack modes (Puzzle Rush, Puzzle Storm) whose only number is a personal best;
the live head-to-head (Chess.com Puzzle Battle) has its OWN rating that measures you against
opponents, not puzzles. Lichess gives Storm no leaderboard at all because "where there is a
leaderboard, there is cheating". For tournaments, Arena (continuous re-pairing, points with win
streak bonuses, ties by performance) and Swiss (fixed rounds, Dutch pairing, Sonneborn-Berger
tie-break) are the two live templates.

### Cited Findings
**Chess.com rated puzzles**
- Rating rises on a correct solve and falls on a miss; the change depends on the puzzle's rating relative to yours (a lower-rated puzzle earns fewer points, a higher-rated one more). Puzzle rating "may not accurately reflect your chess rating". — [Chess.com Help: How do puzzles work?](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
- Speed counts on rated puzzles only as a bonus: a "Speed Bonus" is "awarded based on how close you get to the target time"; Target Time is a suggested solve time based on your current puzzle rating (no formula published). — [Chess.com Help](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
- Hints: correct moves before a hint earn progression points but no rating points; a hint before the first correct move earns nothing. Custom Puzzles: no time pressure, no rating impact. — [Chess.com Help](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
- Daily Puzzle: refreshes at local midnight; a "Hearts" system lets you recover from mistakes instead of ending the attempt; the streak survives if each puzzle is completed within 48 hours of release (a built-in grace window). — [Chess.com Help](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
- Freemium gating: Basic = 3 rated puzzles/day plus one Puzzle Rush and one Puzzle Battle per day; Premium unlimited; limits reset at midnight in the account's time zone. — [Chess.com Help](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
- The help page does not name the algorithm, starting rating, floor or provisional rule. — [Chess.com Help](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)

**Chess.com Puzzle Rush (solo score attack)**
- 3 or 5 minutes, as many puzzles as possible; three wrong answers end the run whatever time is left. Survival mode drops the clock but keeps three strikes. Puzzle Rush does NOT change puzzle rating; Chess.com tells players to chase a high score without worrying about rating; leaderboards include friends' rankings and personal bests. — [Chess.com Help](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com); [Chess.com: Announcing the Updated Puzzle Rush](https://www.chess.com/news/view/new-puzzle-rush-chess)
- When Puzzle Rush was updated, all scores of 50 and higher were reset and the puzzle pool was expanded and audited (announcement undated in results). — [Chess.com: Updated Puzzle Rush](https://www.chess.com/news/view/new-puzzle-rush-chess)

**Chess.com Puzzle Battle (live head-to-head)**
- Each player has a 3-minute window and must avoid three wrong; both scores are visible live; a player with three mistakes is eliminated but the opponent may play on until time ends; most correct wins; a tie on correct answers goes to fewer incorrect answers. — [Chess.com Help: What is Puzzle Battle?](https://support.chess.com/en/articles/8708930-what-is-puzzle-battle-on-chess-com)
- Battle has its own rating used to pair similar-strength opponents, separate from all other ratings, and Chess.com says it "has nothing to do with the puzzles' difficulty" — it reflects results against opponents. — [Chess.com Help](https://support.chess.com/en/articles/8708930-what-is-puzzle-battle-on-chess-com); [Chess.com: New Feature Puzzle Battle](https://www.chess.com/news/view/new-feature-puzzle-battle)
- Season points: earned every match, win or lose; leaderboard resets monthly; points per correct puzzle grow with consecutive wins (1 per correct for a loss, draw or first win; 2 on a second straight win; 3 on a third; rising after). — [Chess.com Help](https://support.chess.com/en/articles/8708930-what-is-puzzle-battle-on-chess-com)

**Lichess puzzles, Storm, Racer**
- Lichess uses Glicko-2; new players start at 1500 with very large uncertainty (community posts cite 1500 ± 1000 as shown on site), so early results swing ratings by hundreds of points. Community understanding: a puzzle attempt is treated as a game against the puzzle's rating, solving above your rating gains more, failing above your rating costs less, and both sides settle as plays accumulate. FORUM sources, not official documentation. — [Lichess forum: How does Glicko-2 work](https://lichess.org/forum/general-chess-discussion/how-does-glicko-2-rating-works)
- A Lichess blogger argues the implementation is not textbook Glicko-2 (each game effectively a rating period; fractional rating periods). Contested. — [Toadofsky: Lichess ratings are not Glicko-2](https://lichess.org/@/Toadofsky/blog/lichess-ratings-are-not-glicko-2/x1bpwn38)
- Puzzle Storm: 3 minutes; one point per solved puzzle; puzzles come from the puzzle database and get harder through the run; every correct MOVE fills a combo bar, and a full bar adds time (5 moves +3s, 12 +5s, 20 +7s, 30 +10s, then +10s every 10 moves); a wrong move empties the bar and costs 10 seconds. Storm is unrated; there is no leaderboard — "Where there is a leaderboard, there is cheating" — only a daily best on the dashboard and a personal best on the profile. — [Lichess: Puzzle Storm](https://lichess.org/page/storm); [Lichess blog: Puzzlers on the Storm](https://lichess.org/blog/YBCoVBUAANCqHhLv/puzzlers-on-the-storm)
- Puzzle Racer (multiplayer race on Storm puzzles): combo bonuses are points (1, 2, 3, 4 at the same move thresholds, then +4 every 10 moves); each player may skip one move per race; the race skips every other Storm puzzle so difficulty climbs twice as fast. — [Lichess: Puzzle Racer](https://lichess.org/page/racer)

**Tournament formats and tie-breaks (Lichess)**
- Arena: a win is 2 points, a draw 1, a loss 0; two consecutive wins start a "streak" during which wins are 4 and draws 2 until you fail to win; "Berserk" halves your clock for +1 point on a win (only if at least 7 moves are played); draws within the first 10 moves score nothing and only the first draw in a row scores; pairing is by rating at first, then by current rank among whoever is waiting in the lobby, so you may not meet everyone and playing fast earns more games; most points when the clock hits zero wins; ties are broken by tournament performance; games still running at zero do not count. — [Lichess: Arena tournament FAQ](https://lichess.org/tournament/help?system=arena)
- Swiss: Dutch-system pairings (bbPairings, per the FIDE handbook); an unpairable player gets a 1-point bye; a late joiner gets a single half-point bye; the event ends when all possible pairings are played; tie-break is Sonneborn–Berger (sum of the scores of opponents beaten plus half the scores of opponents drawn). A user reported that a full-point bye seemed not to count toward SB (unconfirmed). — [Lichess: Swiss tournaments FAQ](https://lichess.org/zu/swiss); [Wikipedia: Tie-breaking in Swiss-system tournaments](https://en.wikipedia.org/wiki/Tie-breaking_in_Swiss-system_tournaments)

### Inferences
- A three-tier split maps well onto a children's math platform: (a) a slow, adaptive, RATED practice mode that drives question selection; (b) UNRATED score-attack "challenges" whose number is a personal/daily best; (c) a separately rated head-to-head "clash". Keeping (b) unrated stops speed play and its cheating incentives from contaminating the rating that drives adaptivity.
- Puzzle Battle's rule set (fixed clock, three strikes, opponent plays on, tie to fewer errors) is a ready-made clash format that rewards accuracy as well as speed and never leaves a child stuck waiting for a slow opponent. Its monthly season points paid even for a loss are a participation-rewarding layer over a win/loss rating.
- Storm's "time for combos" (not points for speed) rewards fluency without docking a slow-but-accurate child per answer — they just earn less bonus time. Chess.com's speed BONUS on rated puzzles has the same shape: speed can add, never subtract.
- For a timed tournament on a shared set, Arena's continuous re-pairing is a live-match device and does not apply; the relevant borrowings are its "most points when the clock ends, ties by performance" rule and its anti-farming rules (no points for trivially short games). Swiss fits a scheduled multi-round clash league (e.g. a weekly class league of 1v1 rounds) with Sonneborn–Berger as the tie-break.
- Lichess's no-leaderboard stance for Storm is both an anti-cheat and an anti-anxiety default worth copying for children: show personal best and class-scoped ranks, not a global table.

### Gaps
- Exact Lichess puzzle-rating parameters (puzzle starting rating/RD, any deviation floor, whether puzzles' ratings are frozen after N plays, how puzzle difficulty presets work): the official 2020 puzzle blog post returned HTTP 403; only forum sources were reachable.
- Lichess Puzzle Streak rules were not confirmed from an official page in this pass.
- Chess.com's rating algorithm, starting rating, floor and provisional rules for puzzles and Battle are not published on its help pages; Chess.com tournament tie-break rules ([help page](https://support.chess.com/en/articles/8572860-how-do-ties-in-tournaments-work)) were found but not read.
- Knockout formats and their tie-break conventions (e.g. armageddon/blitz playoffs) were not researched.

## 2. Rating systems for people and items (Elo, Glicko-2, TrueSkill; Math Garden; Alcumus; Codeforces) and speed-accuracy scoring

### Takeaway
The proven pattern for learners is Elo applied to person-vs-ITEM "matches": both the child's ability
and the question's difficulty update after every answer, which calibrates a new question bank on
the fly. Math Garden (Netherlands, 450k+ children, 850M+ responses) is the reference
implementation, with a "signed residual time" scoring rule S = (2x − 1)(d − t) that makes fast
guessing costly — but its own authors report it can scare less confident, able children into
answering too slowly. Glicko-2 adds an explicit uncertainty (RD), which is the principled way to do
"provisional" ratings.

### Cited Findings
**Glicko-2 (Glickman)**
- Each player has a rating r, a rating deviation RD and a volatility σ; strength is best reported as an interval: rating ± 2·RD is a 95% interval (e.g. 1850 with RD 50 → 1750–1950). — [Glickman, "Example of the Glicko-2 system", Boston University, version dated March 22, 2022](http://www.glicko.net/glicko/glicko2.pdf)
- An unrated player starts at rating 1500, RD 350, volatility 0.06 ("this value depends on the particular application"). The system constant τ constrains volatility change; reasonable values are 0.3–1.2, tuned for predictive accuracy, and as small as 0.2 if extremely improbable outcomes are expected. — [Glickman 2022](http://www.glicko.net/glicko/glicko2.pdf)
- Games in a "rating period" are treated as simultaneous; Glicko-2 "works best when the number of games in a rating period is moderate to large, say an average of at least 10-15 games per player"; the period length is the administrator's choice. — [Glickman 2022](http://www.glicko.net/glicko/glicko2.pdf)

**Math Garden / Rekentuin (Oefenweb, University of Amsterdam)**
- Klinkenberg, Straatemeier & van der Maas (2011), Computers & Education 57(2), 1813–1824: the model builds on Elo; person ability and item difficulty are updated with every answered item ("on the fly item calibration"); the scoring rule accounts for accuracy and response time. — [UvA DARE record](https://dare.uva.nl/id/de65bb65-d198-4dbc-ac7b-bc25ca23e627); [S. Klinkenberg, UvA](https://www.uva.nl/en/profile/k/l/s.klinkenberg/s.klinkenberg.html)
- Scale (2018): almost 853,300,000 responses from over 452,000 K–12 children across 5,300 schools plus household subscriptions, in 26 arithmetic domains; the abstract says "over a billion responses". — [Brinkhuis, Savi, Hofman, Coomans, van der Maas & Maris (2018), "Learning As It Happens", Journal of Learning Analytics 5(2), 29–46](https://learning-analytics.info/index.php/JLA/article/view/5796)
- Scoring rule ("Signed Residual Time", from Maris & van der Maas 2012): S = (2x − 1)(d − t), x ∈ {0,1} accuracy, t response time, d the time limit (generally 20 seconds). A correct answer scores the remaining time; a wrong one scores MINUS the remaining time — so a fast wrong answer is the most costly — which "discourages fast guessing and imposes an explicit speed–accuracy trade-off". It is shown to children as coins: d coins at the start, one disappears each second, the remainder is added on a correct answer and subtracted on a wrong one; coins buy virtual prizes. — [Brinkhuis et al. 2018, JLA (full text)](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- Elo updates per response: θp ← θp + K(S − E(S)), δi ← δi − K(S − E(S)), where E(S) comes from the SRT model, E(S | θ, δ) = d·(exp(2d(θ−δ)) + 1)/(exp(2d(θ−δ)) − 1) − 1/(θ − δ). An expected-but-slow correct answer can even LOWER a rating. K is a bias–variance trade-off (high K adapts fast but is noisy). One rating system per game/domain, each assumed unidimensional. — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- Difficulty choice: children set the target success rate themselves — easy (about 90% correct), medium (about 75%), hard (about 60%); item selection also avoids recently seen items. Items are presented 20 seconds each, multiple-choice or open response. — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- The "question mark" button skips an item for a score of zero; children gamed it (skipping anything not instantly answerable to farm coins), so its use is now limited; a large online randomized experiment (Savi, Ruijs, Maris & van der Maas 2018) found that simply DELAYING when the question mark becomes available reduced its use and increased effort, and the delay was rolled out system-wide. — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- Documented downside of high-stakes speed scoring: "the particular form of the scoring rule can have a negative effect on less confident, yet high ability users. They might be scared by the high stakes associated to fast responding and produce a slow response resulting in a score that is too low for their actual ability"; and "despite this explicit penalizing of fast incorrect responses, a substantial amount of guessing remains". — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- Misfit: observed-minus-expected scores are bimodal — 21% of observations fall in a component centred at −0.90 (unexpected errors: typos, fast guessing) vs. 79% at +0.28; quick errors on easy items bias estimates, which could be removed e.g. by disregarding quick incorrect responses in updates. — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- Maris & van der Maas (2012), Psychometrika 77(4), 615–633: from an explicit scoring rule for time-limit tasks they derive a response model in the exponential family; the accuracy part reduces to the 2PL model and the time limit sets item discrimination. — [UvA DARE](https://dare.uva.nl/id/257c9569-e69c-466b-b813-c48c1e65942c); [RePEc/IDEAS](https://ideas.repec.org/a/spr/psycho/v77y2012i4p615-633.html)

**AoPS Alcumus**
- Alcumus gives a 0–100 rating per topic describing how well the system thinks the student understands it; the rating is the probability a student answers a question in that topic correctly; right answers raise it, wrong ones lower it; in AoPS courses a topic bar turns green at "pass" and blue at "mastery". — [AoPS blog: Alcumus, a peek under the hood](https://artofproblemsolving.com/blog/articles/alcumus-a-peek-under-the-hood-of-our-adaptive-learning-tool); [AoPS handbook: Alcumus](https://artofproblemsolving.com/school/handbook/current/alcumus)

**Codeforces (many-player Elo)**
- Public since October 2015, Codeforces' rating generalises Elo to many-player contests: each participant's expected place ("seed") is computed from everyone's ratings, and the rating moves by how far the actual place beats or misses it. A 200-point gap ≈ 0.75 chance the higher-rated finishes ahead; 400 ≈ 0.9. — [Mirzayanov: Open Codeforces Rating System](https://codeforces.com/topic/20847/en1)

### Inferences
- For a math bank (the platform's questions are already graded by NC 2026 standard and grade), an Elo-per-item rating gives every question a live empirical difficulty after a few hundred answers; seed it from grade/standard and let answers move it. One rating per domain/grade band, not a single global number, matches Math Garden's unidimensionality caution.
- Use Glicko-2-style RD (or Elo with a decaying K) to show a rating as "provisional" until RD falls below a threshold; hide a child's rating, or show only a level/band, while provisional. Glickman's 10–15 games per rating period suggests batching tournament results per event rather than per question for the clash ladder.
- To "score time without punishing slower students": (1) rank primarily on correct answers and use time only as a tie-break (ICPC/AtCoder style, Section 4); (2) give speed as an additive bonus (Chess.com speed bonus, Storm time bonus) rather than a signed penalty; (3) if an SRT-style rule is used, apply the negative side only to answers faster than a plausible floor, cap it, and let the child pick the target difficulty (90/75/60%) — Math Garden's own paper flags the anxiety cost of the full signed rule.
- Don't let skip buttons become a farming tool: a short delay before "skip" is an empirically tested fix (Savi et al. 2018).
- Never update a question's rating from tournament play where many children may have seen the same item under unusual conditions (time pressure, collusion); calibrate items from practice mode.

### Gaps
- TrueSkill (Microsoft's Bayesian team-rating system) was not researched in this pass; it is the obvious candidate for TEAM clashes, but no source was read.
- The original Klinkenberg et al. (2011) PDF and Klinkenberg (2014) "High speed high stakes scoring rule" chapter were not read; K values and any uncertainty-dependent K used in Math Garden are not stated in the 2018 overview.
- Alcumus's actual formula (IRT vs. Elo) is not published beyond the blog's description.
- Lichess/Chess.com puzzle rating floors were not found; Codeforces' handling of new accounts (hidden initial rating ramp) was not confirmed.

## 3. Duolingo and Brilliant engagement mechanics (leagues, streaks, XP, quests, friend challenges)

### Takeaway
Weekly leagues of ~30 similar-engagement learners with promotion/demotion, and streaks with
forgiveness (freezes/charges), are the two mechanics with the best-documented engagement effects
(Duolingo: +17% learning time from leagues; 7+ day streak share nearly 3x), but the evidence is
company-reported and measures engagement, not learning; documented downsides are streak anxiety
(loss aversion) and compulsive XP grinding in top leagues.

### Cited Findings
**Duolingo (company-reported)**
- Leagues: learners are matched with others of similar engagement in the prior week; adapted from Zynga's FarmVille 2 league system; top finishers move up weekly; everyone is opted in automatically, and reaching the top of the first league needs only consistent study. Results: overall learning time +17%; "highly engaged learners" (1+ hour a day, 5 days a week) tripled; D1 and D7 retention improved significantly. — [Jorge Mazal (former CPO), "How Duolingo reignited user growth", Lenny's Newsletter, 2023-02-28](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- Streaks: reaching a 10-day streak substantially reduced drop-off risk (Mazal flags correlation and selection bias); the first big win was a late-night "streak saver" notification; later calendar views, animations, streak-freeze changes and rewards; the share of DAU on a 7+ day streak rose almost 3x to over half of DAU. Overall DAU grew 4.5x in four years; current-user retention rate +21% (daily churn among the best users down >40%); a referral programme added only 3% new users; a "gamification moves counter" was neutral. Notifications rule: "protect the channel" — raising volume needed CEO approval. — [Mazal 2023](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- Streak A/B test: separating the daily goal from the streak gave +3.3% relative Day-14 retention, +1% daily active learners, +10.5% share of daily learners on a streak within 20 days (+19% among new learners). — [Duolingo blog: Improving the streak](https://blog.duolingo.com/improving-the-streak)
- 600+ streak experiments in four years; one winning CTA change was "continue" → "commit to my goal" (secondary podcast summary). — [Recall summary of Lenny's Podcast with Jackson Shuttleworth](https://www.recall.it/summary/lennys-podcast/behind-the-product-duolingo-streaks-or-jackson-shuttleworth-group-pm-retention-team)
- League structure (UNOFFICIAL teardown, figures conflict across sources): 30 users per weekly league ranked by XP; 10 tiers Bronze → Silver → Gold → Sapphire → Ruby → Emerald → Amethyst → Pearl → Obsidian → Diamond; promotions per week Bronze 20, Silver 15, Gold 10, Sapphire–Pearl 7, Obsidian 5, Diamond 0; Sunday deadline, at most one promotion per week; top-3 earn gems; a paid "League Repair". — [Deconstructor of Fun: Duolingo leagues](https://duolingo.deconstructoroffun.com/mechanics/leagues); other guides give different demotion zones — [We Got This Covered](https://wegotthiscovered.com/fyi/all-duolingo-leagues-explained/)

**Brilliant (official help pages)**
- Streak = consecutive days of learning; a day counts after 3 problems or one full lesson. "Streak charges" are earned by finishing lessons/practice, at most two held, applied automatically on a missed day (the streak is kept but not extended; no XP for the missed day). — [Brilliant: What is a streak?](https://brilliant.org/help/features/what-is-a-streak); [Brilliant: Streak charge FAQ](https://help.brilliant.org/en/articles/8507079-streak-charge-faq)
- Leagues: weekly XP competitions of 30 learners; weeks start and end Sunday 8 PM PT; you are placed after your first lesson or Daily Challenge of the week; at week's end you advance, drop or stay; 10 levels from Hydrogen to Einsteinium. — [Brilliant: Leagues FAQ](https://help.brilliant.org/en/articles/6399120-leagues-faq); [Brilliant: Leagues and leaderboards](https://brilliant.org/help/features/what-are-leagues-and-leaderboards)

**Downsides (commentary, not controlled studies)**
- Parent guides describe "streak anxiety": the reason for opening the app shifts from "I want to learn" to "I'm afraid of losing my progress", driven by loss aversion; Friend Quests and the friends feed are flagged as an emotional rather than privacy concern. — [ScreenWise parent guide: Duolingo and the streak obsession](https://screenwiseapp.com/guides/duolingo-and-the-streak-obsession); [ScreenWise: when gamification becomes stressful](https://screenwiseapp.com/guides/managing-duolingo-streaks-when-gamification-becomes-stressful)
- Diamond-league players describe needing 3,378 XP in a week just to avoid demotion and staying in Diamond becoming "a compulsion"; critics argue the app optimises for staying in it whether or not you learn. — [po-ru.com: Competitive learning](https://po-ru.com/2022/05/30/week-73-competitive-learning); [Substack: When a demotion is helpful](https://melisalw.substack.com/p/when-a-demotion-is-helpful); [PCWorld](https://www.pcworld.com/article/2924235/duolingo-got-easier-when-i-paid-for-it-that-was-the-problem.html)

### Inferences
- League design to copy for children: small cohorts (~20–30) of SIMILAR engagement/level (near-peer), weekly reset, generous promotion at the bottom tiers so nearly everyone moves up early, no paid repair. Rank by questions answered correctly (or learning-weighted points), not raw XP that rewards grinding easy items.
- Streaks: copy the forgiveness (Brilliant's two banked charges; Chess.com's 48-hour window); count the streak on a small daily goal decoupled from any target (Duolingo's split test); for children, send streak reminders to the parent, not the child, and never late at night.
- Engagement wins are not learning wins: the Duolingo numbers measure time and retention. Pair any league with the platform's progress measures (assessments against standards) before claiming it helps learning.
- Friend challenges/quests are cooperative (shared goal) rather than zero-sum — the friendlier social form for young children (see Section 5 on collaboration).

### Gaps
- No peer-reviewed study of Duolingo leagues or streaks on LEARNING outcomes was found; all figures are company-reported engagement metrics.
- Duolingo's official league rules (exact cohort size, demotion counts, Diamond tournament) were not confirmed from Duolingo's own help pages; third-party figures conflict.
- Duolingo Friend Quests / friend streak mechanics and any published results were not found in primary sources.
- Duolingo's policies for under-13 users (e.g. leaderboard visibility) were not researched.

## 4. Competitive programming contest scoring as a template (Codeforces, AtCoder, LeetCode)

### Takeaway
Programming contests give everyone the same problem set and rank by number solved (or points), with
time-plus-wrong-attempt "penalty" only as a tie-break — 20 minutes per wrong attempt (ICPC), 10
(Codeforces Educational), 5 (AtCoder, LeetCode) — and only wrong attempts on problems eventually
solved count. Ratings are many-player Elo variants, and contests declare a rated range so strong
players cannot farm beginner events.

### Cited Findings
- ICPC rules (as used on Codeforces): rank by number solved, then by penalty = sum of solve minutes + 20 minutes per wrong attempt on solved problems. "Extended ICPC" (Codeforces Educational rounds): 10 minutes per wrong attempt, and a wrong answer on test 1 does not count. — [Codeforces: what "ICPC rules" / "extended ICPC rules" mean](https://codeforces.com/blog/entry/105575)
- LeetCode: 5-minute penalty per incorrect submission on problems you eventually solve; wrong answers on unsolved problems add nothing; resubmitting an already-solved problem does not change finish time. — [LeetCode support: Finish/Penalty Time](https://support.leetcode.com/hc/en-us/articles/360011984773-What-does-the-Finish-Penalty-Time-column-mean-in-the-ranking)
- AtCoder: rank by total score, then penalty = time to reach your current score + 5 minutes × incorrect attempts. AtCoder Beginner Contests (e.g. ABC 460, ABC 465) run 100 minutes and are rated for 0–1999 (older ABCs were rated 0–1199); early AGCs were "Everyone is rated". — [AtCoder ABC 465](https://atcoder.jp/contests/abc465); [AtCoder ABC 460](https://atcoder.jp/contests/ABC460); [AtCoder AGC002](https://atcoder.jp/contests/AGC002?lang=en)
- Codeforces' rating is a many-player Elo generalisation (Section 2), and contests are split into divisions by rating. — [Mirzayanov: Open Codeforces Rating System](https://codeforces.com/topic/20847/en1)

### Inferences
- Template for a math "challenge": same question set for all (or same-difficulty variants), score = correct answers (optionally weighted by question difficulty, AtCoder-style points), tie-break = total time to last correct answer plus a SMALL penalty per wrong attempt on questions later answered correctly (5 minutes in a 100-minute contest is ~5%; scale proportionally, e.g. 10–20 s in a 10-minute challenge). Wrong attempts on unanswered questions cost nothing, which encourages trying.
- Declared rated ranges (rated only for children below a level, like ABC's 0–1999) stop strong students farming beginner events; others can still play "unrated" for fun.
- "Virtual participation" (replaying a past contest against its frozen standings, unrated) is a natural way to let a child who missed a scheduled challenge play it later without affecting the live ranking.

### Gaps
- Codeforces' current rules for virtual participation, hacking/uphacks and plagiarism (Mirzayanov's skipped-submission rules) were not read in this pass; the current division cut-offs were not confirmed (search snippets gave both 1900 and an older 1500).
- LeetCode's contest rating formula and AtCoder's performance/rating formula (official PDF) were not read; ARC/AGC current rated ranges not confirmed.
- No source was found on how these platforms detect AI/LLM-assisted solutions in 2025–2026.

## 5. Research evidence on competition and gamification in K-12 math

### Takeaway
Gamification has small, positive average effects on learning (g ≈ .49 cognitive, robust in rigorous
studies) and weaker, less stable effects on motivation and behaviour; competition specifically is
double-edged — leaderboards help those near the top and demotivate those near the bottom, a
semester-long competitive gamification lowered motivation and grades in one well-known study, and a
children's math experiment found competition (unlike collaboration) produced gender-dependent
effects. Near-peer, private or team framing is the safer default for children.

### Cited Findings
- Sailer & Homner, "The gamification of learning: a meta-analysis", Educational Psychology Review 32(1), 77–112 (online 2019): cognitive g = .49 [0.30, 0.69], k = 19, N = 1,686; motivational g = .36 [0.18, 0.54], k = 16, N = 2,246; behavioral g = .25 [0.04, 0.46], k = 9, N = 951; only the cognitive effect held in the high-rigor subset; game fiction and social interaction were among the moderators tested. — [Springer](https://link.springer.com/article/10.1007/s10648-019-09498-w); [Uni Augsburg OPUS](https://opus.bibliothek.uni-augsburg.de/opus4/frontdoor/index/index/docId/109056)
- A 2026 SAGE Open meta-analysis reports a far larger pooled effect (d = 1.12) with extreme heterogeneity (I² = 98.84%) — not comparable to Sailer & Homner, and a sign of inconsistent outcome measures across studies. — [SAGE Open 2026](https://journals.sagepub.com/doi/10.1177/21582440261421375)
- Hanus & Fox (2015), Computers & Education 80, 152–161: two sections of one course (about 80 students) over a 16-week semester, one gamified with a leaderboard, badges, virtual coins and pseudonyms; the gamified students showed less motivation, satisfaction and empowerment over time and lower grades; the authors attribute it to competition (rankings) and long exposure, and suggest rewards on an already interesting subject can feel "controlling". — [Dichev & Dicheva (2017) critical review, table](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-017-0042-5/tables/13); [M. Hanus publications](https://osu.academia.edu/MichaelHanus)
- Rank position matters: high leaderboard positions raise motivation and low positions harm it (citing Domínguez et al. 2013), which may explain mixed leaderboard findings; a classroom case reports bottom-ranked students felt it "was not worth trying" because they could never catch the leaders. — [Online Versus Offline Perspectives on Gamified Learning (GamiFIN 2017)](https://ceur-ws.org/Vol-1857/gamifin17_p7.pdf)
- Children's math, competition vs. collaboration: 274 first and second graders learned a hard proportion concept in a competitive, collaborative or solo game; both social conditions raised perseverance and task attitudes, but competition yielded gender differences — older boys underperformed under competition (attention to proportion amid competing cues). — [Child Development 94(5) (OUP; search summary dated it 2024, volume suggests 2023)](https://academic.oup.com/chidev/article/94/5/1239/8255182); [ECR Hub summary](https://ecrhub.org/publications/whos-winner-childrens-math-learning-competitive-and-collaborative-scenarios)
- Math anxiety by sex: Hyde et al. (1990) meta-analysis d = .15; Stoet et al. across large datasets (n = 761,655) d = .23–.28, with girls showing "excess" math anxiety beyond achievement differences (d = .21–.25). — [Frontiers in Psychology 2019 (search excerpt)](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.01613/pdf); [PMC6876627](https://pmc.ncbi.nlm.nih.gov/articles/PMC6876627)
- Barroso et al. (2021, Psychological Bulletin) meta-analysed the math anxiety–achievement relation (results not retrieved in this pass) — [NSF PAR record](https://par.nsf.gov/biblio/10442998); Zhang et al. (2019) list gender, grade level, region and the measures used as potential moderators of the anxiety–performance link — [Frontiers in Psychology 2019](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.01613/pdf)
- Math Garden's own designers report that its high-stakes speed rule can make less confident, able children answer too slowly (Section 2). — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)

### Inferences
- Default for children: compete against your own past (personal bests, progress), against a small near-peer group of similar level, or as a TEAM/class against a goal — not on a global public leaderboard. Show a child their rank only within a band near their own position, never "27th of 30".
- Time pressure plus public ranking is the combination most likely to raise anxiety, and the anxiety evidence is strongest for girls; offer untimed or generous-time "practice" versions of every challenge, and make the timed, ranked version opt-in.
- Limit exposure: short seasons (weekly/monthly) with resets, as Hanus & Fox's decline came over a long semester.
- Measure: run challenges as A/B experiments against learning outcomes (Math Garden's practice), not just engagement.

### Gaps
- Sailer & Homner's moderator results for competition vs. collaboration vs. competition-plus-collaboration were not retrieved (Springer redirected to login; the Augsburg PDF refused the connection). Background recollection (unverified here) is that combining competition with collaboration did best for behavioral outcomes — check the paper before citing.
- No controlled study comparing global vs. relative/near-peer leaderboards with children was found.
- Team vs. individual competition meta-analyses (e.g. Johnson & Johnson cooperative-learning work) were not retrieved.
- No K-12-specific meta-analysis of competition effects on math anxiety by gender was found.

## 6. Anti-cheating in online timed quizzes

### Takeaway
The robust defences are structural, not surveillance: unrated or class-scoped rankings (no global
leaderboard to cheat for), server-authoritative timing, per-player question variants and shuffled
choices from large item pools, and response-time anomaly checks; tab-switch and fullscreen controls
are weak signals that cannot see a second device (phone camera solvers, LLMs), and AI answer tools
now return answers within seconds.

### Cited Findings
- Lichess removed any leaderboard from Puzzle Storm: "Where there is a leaderboard, there is cheating." — [Lichess: Puzzle Storm](https://lichess.org/page/storm)
- Chess.com reset all Puzzle Rush scores of 50+ when it updated the mode and audited the pool. — [Chess.com: Updated Puzzle Rush](https://www.chess.com/news/view/new-puzzle-rush-chess)
- Response-time evidence from Math Garden: 21% of responses fall in an "unexpected error" cluster (typos, fast guessing); fast errors on easy items distort ratings; children farmed a free skip until a delay was added. — [Brinkhuis et al. 2018](https://learning-analytics.info/index.php/JLA/article/view/5796/6478)
- AI-assisted cheating: browser extensions can read a question from text or a screenshot and answer within seconds; very few studies detect AI-assisted cheating from exam-taking behaviour (logs), most work centres on proctoring and physical behaviour; prevalence unknown. — [arXiv 2510.18881, "Detecting AI-Assisted Cheating in Online Exams through Behavior Analytics" (Oct 2025)](https://arxiv.org/pdf/2510.18881)
- Contract-cheating speed: a QUT audit found answers to online exam questions for more than half of 41 subjects on Chegg (Chegg disputes use during live exams); by 2020 half of questions had answers within about 84 minutes, down from 216 minutes in 2015. — [Times Higher Education](https://www.timeshighereducation.com/news/researchers-find-exam-answers-half-their-modules-chegg)
- Item design against ChatGPT: a tool to help test-makers avoid questions ChatGPT is vulnerable to (2024) — [arXiv 2402.14881](https://arxiv.org/pdf/2402.14881v1); proctoring and AI-text detectors "unlikely to be foolproof" — [ChatGPT: The End of Online Exam Integrity? (2022)](https://ar5iv.labs.arxiv.org/html/2212.09292)
- Vendor practice: focus-loss logging distinguishes tab switch from leaving the window, and even glancing at the taskbar clock registers — [Redmenta](https://help.redmenta.com/en/article/13hjcy4/); per-student tab-switch counts plus flags for answers "exceedingly similar" to classmates' — [CodeChum](https://help.codechum.com/teachers/about-activities/how-to-check-for-potential-cheating); a maximum number of tab switches with a warning each time and auto-submit beyond it — [FlexiQuiz](https://www.flexiquiz.com/Help/configure/restrict-tab-switching); copy/paste blocking and fullscreen enforcement act only inside the browser and do not stop a second device — [Quiz and Survey Master: Quiz Proctor](https://quizandsurveymaster.com/downloads/quiz-proct)

### Inferences
- Server-authoritative timing: the server issues each question with a timestamp and accepts answers against its own clock (with a small latency allowance); never trust a client-reported duration. For live clashes, reveal the next question only after the server records the previous answer.
- Variants over secrecy: give each child the same STANDARD and difficulty but different numbers (parameterised items), and shuffle choice order; a shared set still works for fairness if it is drawn from a large pool per tournament and released only at start. (The platform's bank already checks each question's `compute` expression exactly; parameterised numbers would need a variant generator and re-checking per variant.)
- Timing anomalies are the best cheap detector: flag correct answers far faster than the item's (rated) difficulty predicts, sudden jumps in accuracy on hard items, near-constant answer times (a tool's latency), and identical wrong answers across children in one event. Treat flags as review prompts for a teacher, never automatic accusations against a child.
- Tab-switch/fullscreen: log as a soft signal and show it to the tutor; do not auto-submit a child's work, given false positives (taskbar clock, notifications).
- LLM/photo solvers: short per-question timers on fluency items make external lookup costly; questions needing work shown (the platform's canvas answers) are more resistant; keep rated, high-stakes events supervised (in a tutoring session) and keep unsupervised challenges unrated or class-scoped so the payoff to cheating is small.

### Gaps
- No peer-reviewed evaluation of response-time-based cheat detection in K-12 math quizzes was retrieved (psychometric aberrance literature, e.g. van der Linden's response-time models, not read).
- The methods and results of arXiv 2510.18881 were not read beyond its introduction.
- No primary source was found on how Lichess/Chess.com detect puzzle cheating, or how Kahoot/Prodigy-style children's products handle it.
- Photomath/Google Lens and LLM accuracy on grade 3–8 multiple-choice items (i.e. how exposed such a bank is) was not measured by any source found.
