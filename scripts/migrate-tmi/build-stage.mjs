#!/usr/bin/env node
/**
 * Turns a DATA-ONLY export of the institute's tmi-portal-db into stage.sql:
 * every production row, copied verbatim into `mig_*` staging tables in
 * tutoring-db. Nothing is transformed here -- ids, timestamps and text arrive
 * exactly as production holds them; migrate.sql does the mapping, in SQL a
 * reviewer can read.
 *
 *   npx wrangler d1 export tmi-portal-db --remote --no-schema --output out/tmi-data.sql
 *   node scripts/migrate-tmi/build-stage.mjs out/tmi-data.sql out/stage.sql
 *
 * The staging tables carry no constraints and no triggers: they hold the
 * source as-is. The script REFUSES when the export has a table or a column it
 * does not know -- production's schema has drifted from the repo before, and a
 * column silently left behind is data silently lost.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Every table the institute's portal holds, with every column, as of main at
 * 2026-10-05 (checked against the 2026-10-04 production export). The
 * curriculum is reference data both databases already share, and is not
 * migrated: migrate.sql's preflight checks every topic and level a row names
 * exists in tutoring-db.
 */
export const SOURCE_TABLES = {
  users: ['id', 'email', 'full_name', 'phone', 'status', 'google_sub', 'created_at', 'updated_at', 'last_login_at', 'deleted_at'],
  user_roles: ['user_id', 'role', 'created_at'],
  tutor_profiles: ['user_id', 'highest_education', 'school', 'area', 'availability_notes', 'virtual_available', 'default_rate_in_person_cents', 'default_rate_virtual_cents', 'topup_amount_cents', 'max_session_minutes', 'created_at', 'updated_at', 'ssn_received_on', 'address_line1', 'address_line2', 'city', 'state', 'postal_code'],
  student_profiles: ['user_id', 'school', 'current_math_course', 'academic_year_goal', 'virtual_available', 'charge_rate_in_person_cents', 'charge_rate_virtual_cents', 'max_session_minutes', 'created_at', 'updated_at'],
  admin_profiles: ['user_id', 'tin', 'created_at', 'updated_at'],
  payment_handles: ['user_id', 'method', 'handle', 'created_at', 'updated_at'],
  availability_slots: ['user_id', 'day_of_week', 'hour', 'created_at'],
  guardianships: ['guardian_user_id', 'dependent_user_id', 'relationship', 'is_primary', 'created_at'],
  assignments: ['id', 'tutor_user_id', 'student_user_id', 'rate_in_person_cents', 'rate_virtual_cents', 'is_active', 'notes', 'created_at', 'updated_at'],
  sessions: ['id', 'tutor_user_id', 'student_user_id', 'occurred_on', 'started_at', 'ended_at', 'duration_minutes', 'mode', 'tutor_rate_cents', 'tutor_amount_cents', 'charge_rate_cents', 'charge_amount_cents', 'notes', 'auto_stopped', 'recorded_by_user_id', 'created_at', 'updated_at'],
  scheduled_sessions: ['id', 'tutor_user_id', 'student_user_id', 'day_of_week', 'start_time', 'duration_minutes', 'mode', 'starts_on', 'ends_on', 'location', 'notes', 'is_active', 'created_at', 'updated_at'],
  schedule_cancellations: ['schedule_id', 'occurs_on', 'note', 'cancelled_by_user_id', 'cancelled_as', 'created_at'],
  session_drafts: ['id', 'tutor_user_id', 'student_user_id', 'author_user_id', 'occurred_on', 'started_at', 'ended_at', 'mode', 'notes', 'progress_json', 'write_up_json', 'assessment_json', 'created_at', 'updated_at'],
  session_write_ups: ['session_id', 'planned', 'previous_review', 'homework_review', 'homework_status', 'homework_assigned', 'created_at', 'updated_at'],
  session_assessments: ['session_id', 'author_user_id', 'author_role', 'rating', 'body', 'created_at', 'updated_at'],
  session_reflections: ['session_id', 'learned_new', 'difficulty', 'understanding', 'pace', 'homework_notes', 'comment', 'entered_by_user_id', 'entered_as', 'created_at', 'updated_at'],
  active_sessions: ['tutor_user_id', 'student_user_id', 'mode', 'started_at', 'notes', 'created_at'],
  payments: ['id', 'direction', 'party_user_id', 'student_user_id', 'amount_cents', 'method', 'paid_at', 'reference', 'notes', 'recorded_by_user_id', 'created_at', 'updated_at'],
  audit_events: ['id', 'actor_user_id', 'actor_name', 'subject_user_id', 'subject_name', 'action', 'description', 'entity_type', 'entity_id', 'created_at'],
  comments: ['id', 'author_user_id', 'target_user_id', 'target_session_id', 'target_assignment_id', 'target_scheduled_session_id', 'body', 'created_at', 'deleted_at'],
  assessments: ['id', 'student_user_id', 'assessor_user_id', 'assessed_on', 'school_course', 'recommended_level_id', 'summary', 'created_at', 'updated_at'],
  assessment_topic_ratings: ['assessment_id', 'topic_id', 'rating'],
  learning_plans: ['id', 'student_user_id', 'assessment_id', 'goal', 'target_level_id', 'starts_on', 'target_on', 'sessions_per_week', 'session_minutes', 'recommendation', 'status', 'created_by_user_id', 'created_at', 'updated_at'],
  learning_plan_topics: ['plan_id', 'topic_id', 'position'],
  session_progress: ['session_id', 'plan_id', 'goal_rating', 'created_at', 'updated_at'],
  session_topic_ratings: ['session_id', 'topic_id', 'rating'],
  user_onboarding: ['user_id', 'tour_finished_at', 'tour_outcome', 'details_confirmed_at', 'created_at', 'updated_at'],
};

/** Present in the export, deliberately not migrated. */
const IGNORED = new Set(['d1_migrations', 'sqlite_sequence', 'curriculum_levels', 'curriculum_topics', '_cf_KV']);

/** SQL statements, split on semicolons that are not inside a quoted string. */
function splitStatements(sql) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    // A -- comment runs to the end of its line; its apostrophes are not quotes.
    if (!quoted && char === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      current += '\n';
      continue;
    }
    if (char === "'") {
      // '' inside a string is an escaped quote, not its end.
      if (quoted && sql[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      quoted = !quoted;
    }
    if (char === ';' && !quoted) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function main() {
  // Since 2026-10-06 tmi-portal reads and writes tutoring-db, so the copy in
  // tmi-portal-db is frozen and stale. Migrating it again would replace the
  // institute's live records with it.
  if (process.env.MIGRATE_TMI_AGAIN !== 'yes, replace the live records') {
    console.error(
      'Refusing: the institute already lives in tutoring-db (docs/migration-tmi.md). ' +
        'Migrating again would overwrite its live records with tmi-portal-db\'s frozen copy.',
    );
    process.exit(1);
  }
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: node build-stage.mjs <tmi-data.sql> <stage.sql>');
    process.exit(2);
  }

  const source = readFileSync(input, 'utf8');
  const problems = [];
  const rows = Object.fromEntries(Object.keys(SOURCE_TABLES).map((table) => [table, 0]));
  const statements = [];

  // Split into statements on semicolons OUTSIDE quoted text: a lesson's notes
  // may hold a newline or a semicolon, and a row must arrive whole.
  const insert = /^INSERT INTO "?(\w+)"? \(([^)]*)\) VALUES/;
  for (const statement of splitStatements(source)) {
    if (!statement.startsWith('INSERT INTO')) {
      if (!/^(PRAGMA|BEGIN|COMMIT|CREATE|END$|DELETE FROM "?sqlite_sequence)/i.test(statement)) {
        problems.push(`unexpected statement: ${statement.slice(0, 80)}`);
      }
      continue;
    }
    const match = insert.exec(statement);
    if (!match) {
      problems.push(`unparsed insert: ${statement.slice(0, 80)}`);
      continue;
    }
    const [, table, columnList] = match;
    if (IGNORED.has(table)) continue;
    const known = SOURCE_TABLES[table];
    if (!known) {
      problems.push(`unknown table "${table}" -- add it to SOURCE_TABLES and to migrate.sql`);
      continue;
    }
    const columns = columnList.split(',').map((column) => column.trim().replace(/"/g, ''));
    const unknown = columns.filter((column) => !known.includes(column));
    if (unknown.length) {
      problems.push(`"${table}" has columns this migration does not carry: ${unknown.join(', ')}`);
      continue;
    }
    rows[table] += 1;
    statements.push(`${statement.replace(/^INSERT INTO "?\w+"?/, `INSERT INTO "mig_${table}"`)};`);
  }

  if (problems.length) {
    console.error('Refusing to build stage.sql:');
    for (const problem of [...new Set(problems)].slice(0, 30)) console.error(`  ${problem}`);
    process.exit(1);
  }

  const header = `-- ===========================================================================
--  STAGING for the institute's migration -- GENERATED by build-stage.mjs
-- ===========================================================================
--  Every row of tmi-portal-db as exported from production, copied verbatim
--  into mig_* tables in tutoring-db. No constraints, no triggers, no mapping:
--  migrate.sql reads these and writes the institute's organization.
--  Safe to re-run: the staging tables are dropped and recreated first.
--  Source: ${input}
--  Rows: ${Object.entries(rows).filter(([, count]) => count).map(([table, count]) => `${table} ${count}`).join(', ')}
-- ===========================================================================
`;
  const ddl = Object.entries(SOURCE_TABLES)
    .map(([table, columns]) => `DROP TABLE IF EXISTS mig_${table};\nCREATE TABLE mig_${table} (${columns.join(', ')});`)
    .join('\n');

  writeFileSync(output, `${header}\n${ddl}\n\n${statements.join('\n')}\n`);
  console.log(`${output}: ${statements.length} rows staged`);
  for (const [table, count] of Object.entries(rows)) if (count) console.log(`  ${table.padEnd(24)} ${count}`);
}

main();
