-- Reset Question Quest's points and play data, in every organization.
--
-- Run it against production (from apps/api), after a backup:
--   npx wrangler d1 export tutoring-db --remote --output ~/tmi-portal-backups/prod-$(date +%F)-before-quest-reset.sql
--   npx wrangler d1 execute tutoring-db --remote --file ../../scripts/reset-quest-data.sql
--
-- What it removes:
--   points_ledger     every award; a balance is a sum of these
--   activity_days     the per-day rollup of answers, reviews and points (streaks and days active)
--   quest_attempts    every student answer and its tutor review (the review queue empties)
--   quest_game_seen   what each person has seen in games (the next game's draw starts fresh)
--   quest_games, quest_game_teams and quest_game_players: FINISHED games only
--
-- What it keeps, on purpose:
--   - Questions approved through Quest stay approved (approved_via = 'quest'), and questions flagged
--     through Quest stay flagged in the console: those are the bank's, for every organization.
--   - The audit log (reviews and level changes were logged there): audit_events is never deleted.
--   - Games in the lobby or running: their Durable Object still writes its results into these rows
--     when the game ends. End them first if they should go too, then run this again.
--   - Favorites (quest_game_favorites): a person's saved game settings, not play.
--   - Each student's Quest level (student_profiles.quest_level_id) and every organization's switches.
--
-- The points ledger is append-only (CLAUDE.md, Phase 42): only an UPDATE is refused by a trigger, and
-- this owner-requested reset is the one deliberate DELETE of it.

-- Before: what is about to go.
SELECT
  (SELECT COUNT(*) FROM points_ledger) AS points_ledger,
  (SELECT COUNT(*) FROM activity_days) AS activity_days,
  (SELECT COUNT(*) FROM quest_attempts) AS quest_attempts,
  (SELECT COUNT(*) FROM quest_game_seen) AS quest_game_seen,
  (SELECT COUNT(*) FROM quest_games WHERE status = 'finished') AS finished_games,
  (SELECT COUNT(*) FROM quest_games WHERE status != 'finished') AS games_kept;

-- Points first: an award references the answer it was for.
DELETE FROM points_ledger;
DELETE FROM activity_days;
DELETE FROM quest_attempts;

-- Games: what was seen, then each finished game's players, teams and the game itself.
DELETE FROM quest_game_seen;
DELETE FROM quest_game_players WHERE game_id IN (SELECT id FROM quest_games WHERE status = 'finished');
DELETE FROM quest_game_teams WHERE game_id IN (SELECT id FROM quest_games WHERE status = 'finished');
DELETE FROM quest_games WHERE status = 'finished';

-- After: all zero, but for the games still in the lobby or running.
SELECT
  (SELECT COUNT(*) FROM points_ledger) AS points_ledger,
  (SELECT COUNT(*) FROM activity_days) AS activity_days,
  (SELECT COUNT(*) FROM quest_attempts) AS quest_attempts,
  (SELECT COUNT(*) FROM quest_game_seen) AS quest_game_seen,
  (SELECT COUNT(*) FROM quest_games) AS games_left;
