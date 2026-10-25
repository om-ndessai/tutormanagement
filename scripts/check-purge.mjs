#!/usr/bin/env node
/**
 * Phase 52: deleting a self-serve space must delete everything it holds. Fails when a table that
 * carries organization_id, or references one that does (other than the platform's own reference
 * data and users), is missing from PURGE_ORDER in apps/api/src/repositories/purge.ts.
 */
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../apps/api/db/schema.sql', import.meta.url), 'utf8');
const purge = readFileSync(new URL('../apps/api/src/repositories/purge.ts', import.meta.url), 'utf8');
const listed = new Set([...purge.matchAll(/table: '(\w+)'/g)].map((m) => m[1]));

const tables = [...schema.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)].map(([, name, body]) => ({
  name,
  hasOrg: /\borganization_id\b/.test(body),
  refs: [...body.matchAll(/REFERENCES (\w+)/g)].map((m) => m[1]),
}));
const withOrg = new Set(tables.filter((t) => t.hasOrg).map((t) => t.name));
// The platform's own: the catalog and the bank are reference data; a person is not the space's.
const PLATFORM = new Set(['users', 'questions', 'question_bank_topics', 'curriculum_levels', 'curriculum_topics', 'ai_task_settings', 'platform_accounts', 'platform_admins', 'user_onboarding']);
const owed = tables.filter(
  (t) => t.name === 'organizations' || withOrg.has(t.name) || (!PLATFORM.has(t.name) && t.refs.some((r) => withOrg.has(r))),
);
const missing = owed.map((t) => t.name).filter((name) => !listed.has(name));
if (missing.length > 0) {
  console.error(`check-purge: deleting a space would leave rows in: ${missing.join(', ')}. Add them to PURGE_ORDER.`);
  process.exit(1);
}
console.log(`check-purge: deleting a space reaches all ${owed.length} of its tables.`);
