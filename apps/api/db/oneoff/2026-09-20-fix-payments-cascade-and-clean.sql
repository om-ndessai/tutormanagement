-- One-off production fix + cleanup. Run once, then delete this file.
--
-- 1. Rebuilds `payments` so student_user_id cascades instead of nulling.
--    The old SET NULL left a from_parent row violating its own CHECK when a
--    student was purged, which made the delete fail outright.
-- 2. Removes the seeded fiction and end-to-end artifacts that an earlier
--    test run against production left behind, keeping the real staff.
--
-- Safe only while production's payments are all test data. Check first:
--    npx wrangler d1 execute tmi-portal-db --remote --command="SELECT * FROM payments"

DROP TRIGGER IF EXISTS payments_set_updated_at;
DROP TABLE IF EXISTS payments;

CREATE TABLE payments (
  id                  TEXT PRIMARY KEY,

  --   from_parent - a family paying the institute
  --   to_tutor    - the institute paying a tutor
  direction           TEXT NOT NULL CHECK (direction IN ('from_parent', 'to_tutor')),

  -- The parent who paid, or the tutor who was paid.
  party_user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Which student the money is for. Charges attach to a student, not to a
  -- parent, because a student may have two guardians and either may pay.
  -- Required for from_parent (see the CHECK below) so every family payment
  -- lands against exactly one balance; meaningless for to_tutor.
  --
  -- CASCADE, not SET NULL: nulling this on a purge would leave a from_parent
  -- row violating that CHECK, and the delete would fail outright. A payment
  -- "for Sofia" also means nothing once Sofia is gone. Matches how
  -- sessions.student_user_id behaves.
  student_user_id     TEXT REFERENCES users (id) ON DELETE CASCADE,

  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),

  -- "The payment form need to be supported are venmo, zelle, cash, check."
  method              TEXT NOT NULL CHECK (method IN ('zelle', 'venmo', 'cash', 'check')),

  -- When the money actually moved, which is not when it was typed in.
  paid_at             TEXT NOT NULL,

  -- Cheque number, transfer confirmation, whatever makes it findable later.
  reference           TEXT,
  notes               TEXT,

  recorded_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- A family payment with no student would belong to no balance at all.
  CHECK (direction <> 'from_parent' OR student_user_id IS NOT NULL)
);

CREATE INDEX payments_party_idx   ON payments (party_user_id, paid_at DESC);
CREATE INDEX payments_student_idx ON payments (student_user_id, paid_at DESC);
CREATE INDEX payments_recent_idx  ON payments (paid_at DESC);

CREATE TRIGGER payments_set_updated_at
AFTER UPDATE ON payments FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE payments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

DELETE FROM users WHERE email NOT IN (
  'ndessai@gmail.com', 'om.ndessai@gmail.com', 'skarmali@gmail.com', 'ved.ndessai@gmail.com'
);
