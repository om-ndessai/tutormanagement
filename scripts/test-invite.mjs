#!/usr/bin/env node
/**
 * Phase 53, moved in Phase 65: the TEST platform's sign-up list (tutoring-test-db's access_list, the list
 * the console's Sign-up access keeps; used while the mode is Pre-approved). Never production:
 * every command runs with --env tutoring-test, whose account the wrangler config pins to TEST, and
 * scripts/check-test-account.mjs runs first.
 *
 *   npm run test:invite -- list
 *   npm run test:invite -- add <email or pattern> [note]      e.g. '*@trianglemathinstitute.com'
 *   npm run test:invite -- add-google <sub> [note]
 *   npm run test:invite -- remove <email or pattern | sub>
 *
 * Direct SQL works too: npx wrangler d1 execute tutoring-test-db --env tutoring-test --remote --command "..."
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const API = join(here, '..', 'apps', 'api');
execFileSync('node', [join(here, 'check-test-account.mjs')], { stdio: 'inherit' });

const [action, value, ...rest] = process.argv.slice(2);
const note = rest.join(' ') || null;
const q = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const id = "lower(hex(randomblob(16)))";
let sql;
switch (action) {
  case 'list':
    sql = 'SELECT COALESCE(email, provider || ":" || subject) AS who, note, added_at FROM access_list ORDER BY added_at';
    break;
  case 'add':
    if (!value) throw new Error('add needs an email or a pattern');
    sql = `INSERT INTO access_list (id, email, note) VALUES (${id}, ${q(value.trim().toLowerCase())}, ${q(note)})`;
    break;
  case 'add-google':
    if (!value) throw new Error('add-google needs a Google account id (sub)');
    sql = `INSERT INTO access_list (id, provider, subject, note) VALUES (${id}, 'google', ${q(value.trim())}, ${q(note)})`;
    break;
  case 'remove':
    if (!value) throw new Error('remove needs what was added');
    sql = `DELETE FROM access_list WHERE lower(email) = ${q(value.trim().toLowerCase())} OR subject = ${q(value.trim())}`;
    break;
  default:
    console.error('usage: npm run test:invite -- list | add <email|pattern> [note] | add-google <sub> [note] | remove <email|pattern|sub>');
    process.exit(2);
}
execFileSync('npx', ['wrangler', 'd1', 'execute', 'tutoring-test-db', '--env', 'tutoring-test', '--remote', '--command', sql], {
  cwd: API,
  stdio: 'inherit',
});
