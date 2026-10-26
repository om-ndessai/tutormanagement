#!/usr/bin/env node
/**
 * Phase 53: the test database's invited list must never reach production. Fails if
 * `invited_users` appears in apps/api/db/schema.sql or in a production SQL block of
 * docs/database.md (```sql release=...```), and if db/test-only.sql ever grows a table that is
 * not test-only. Run by `npm run typecheck`.
 */
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const problems = [];
if (/\binvited_users\b/.test(read('apps/api/db/schema.sql'))) problems.push('apps/api/db/schema.sql names invited_users');
for (const [, label, sql] of read('docs/database.md').matchAll(/^```sql release=([\w.-]+)\s*\n([\s\S]*?)^```/gm)) {
  if (/\binvited_users\b/.test(sql)) problems.push(`docs/database.md block ${label} names invited_users`);
}
const tables = [...read('apps/api/db/test-only.sql').matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map((m) => m[1]);
// invited_users_next is the Phase 55 rebuild's scratch copy, renamed to invited_users at once.
for (const t of tables) if (t !== 'invited_users' && t !== 'invited_users_next') problems.push(`db/test-only.sql creates ${t}, which is not test-only`);
if (problems.length) {
  console.error(`check-test-only: the test database's invited list would reach production:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('check-test-only: invited_users stays in the test database.');
